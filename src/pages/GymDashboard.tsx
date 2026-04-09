import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGymManager } from "@/hooks/useGymManager";
import { useBrazilLocations } from "@/hooks/useBrazilLocations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dumbbell, Users, Package, Search, Plus, Trash2, Ticket,
  UserPlus, Zap, Edit3, Trophy, Loader2, ArrowUpDown, Calendar, AlertTriangle,
  LogOut,
} from "lucide-react";

const GymDashboard = () => {
  const { user, signOut } = useAuth();
  const { managedGym, isGymManager, isLoading: loadingManager } = useGymManager();

  if (loadingManager) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isGymManager || !managedGym) {
    return <Navigate to="/" />;
  }

  return <GymDashboardContent gymId={managedGym.id} gym={managedGym} userId={user!.id} onSignOut={signOut} />;
};

type SortField = "expiration" | "name" | "joined";
type SortDir = "asc" | "desc";

const GymDashboardContent = ({ gymId, gym, userId, onSignOut }: { gymId: string; gym: any; userId: string; onSignOut: () => void }) => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("members");
  const [memberSearch, setMemberSearch] = useState("");
  const [newEquip, setNewEquip] = useState({ name: "", category: "musculação", quantity: "1" });
  const [showCoupon, setShowCoupon] = useState(false);
  const [newCoupon, setNewCoupon] = useState({ code: "", discount_percent: "10", description: "", max_uses: "" });
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [workoutPrompt, setWorkoutPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [logoUrl, setLogoUrl] = useState(gym.logo_url || "");

  useEffect(() => {
    setLogoUrl(gym.logo_url || "");
  }, [gym.logo_url]);

  // Edit gym
  const [showEditGym, setShowEditGym] = useState(false);
  const [editGym, setEditGym] = useState({
    name: gym.name || "",
    state: gym.state || "",
    city: gym.city || "",
    address: gym.address || "",
    phone: gym.phone || "",
    website: gym.website || "",
  });
  const { states, cities, loadingCities } = useBrazilLocations(editGym.state);

  // Bulk workout
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [showBulkWorkout, setShowBulkWorkout] = useState(false);
  const [bulkPrompt, setBulkPrompt] = useState("");
  const [bulkGenerating, setBulkGenerating] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>("expiration");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Challenge creation
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [newChallenge, setNewChallenge] = useState({
    title: "",
    description: "",
    challenge_type: "workout_count",
    goal_value: "10",
    end_date: "",
    visibility: "private",
  });

  // Members with workout expiration
  const { data: members } = useQuery({
    queryKey: ["gym-dashboard-members", gymId],
    queryFn: async () => {
      const { data } = await supabase.from("gym_members").select("id, user_id, joined_at, status").eq("gym_id", gymId);
      if (!data?.length) return [];
      const userIds = data.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, full_name, avatar_url, allow_gym_workout" as any)
        .in("user_id", userIds);
      // Fetch active training program expiration for each member
      const { data: programs } = await supabase
        .from("training_programs")
        .select("user_id, expires_at")
        .in("user_id", userIds)
        .eq("is_active", true)
        .order("expires_at", { ascending: true });
      // Get nearest expiration per user
      const expirationMap: Record<string, string> = {};
      programs?.forEach((p) => {
        if (!expirationMap[p.user_id]) {
          expirationMap[p.user_id] = p.expires_at;
        }
      });
      return data.map((m) => {
        const profile = profiles?.find((p: any) => p.user_id === m.user_id);
        return {
          ...m,
          profile,
          workout_expires_at: expirationMap[m.user_id] || null,
          allow_gym_workout: (profile as any)?.allow_gym_workout ?? true,
        };
      });
    },
  });

  // Sorted members
  const sortedMembers = useMemo(() => {
    if (!members) return [];
    const sorted = [...members].sort((a: any, b: any) => {
      let cmp = 0;
      if (sortField === "expiration") {
        const aExp = a.workout_expires_at || "9999-12-31";
        const bExp = b.workout_expires_at || "9999-12-31";
        cmp = aExp.localeCompare(bExp);
      } else if (sortField === "name") {
        const aName = a.profile?.full_name || a.profile?.username || "";
        const bName = b.profile?.full_name || b.profile?.username || "";
        cmp = aName.localeCompare(bName);
      } else if (sortField === "joined") {
        cmp = (a.joined_at || "").localeCompare(b.joined_at || "");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [members, sortField, sortDir]);

  // Equipment
  const { data: equipment } = useQuery({
    queryKey: ["gym-dashboard-equipment", gymId],
    queryFn: async () => {
      const { data } = await supabase.from("gym_equipment").select("*").eq("gym_id", gymId).order("category");
      return data ?? [];
    },
  });

  // Coupons
  const { data: coupons } = useQuery({
    queryKey: ["gym-dashboard-coupons", gymId],
    queryFn: async () => {
      const { data } = await supabase.from("gym_coupons").select("*").eq("gym_id", gymId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Gym challenges (only created by this gym's managers)
  const { data: gymChallenges } = useQuery({
    queryKey: ["gym-dashboard-challenges", gymId],
    queryFn: async () => {
      // Get all managers of this gym
      const { data: managers } = await supabase.from("gym_managers").select("user_id").eq("gym_id", gymId);
      if (!managers?.length) return [];
      const managerIds = managers.map((m) => m.user_id);
      const { data } = await supabase
        .from("challenges")
        .select("*")
        .in("created_by", managerIds)
        .order("created_at", { ascending: false });
      // Also get participant counts
      if (!data?.length) return [];
      const challengeIds = data.map((c) => c.id);
      const { data: participants } = await supabase
        .from("challenge_participants")
        .select("challenge_id")
        .in("challenge_id", challengeIds);
      const countMap: Record<string, number> = {};
      participants?.forEach((p) => {
        countMap[p.challenge_id] = (countMap[p.challenge_id] || 0) + 1;
      });
      return data.map((c) => ({ ...c, participant_count: countMap[c.id] || 0 }));
    },
  });

  // Search users
  const { data: searchResults } = useQuery({
    queryKey: ["gym-member-search", memberSearch],
    queryFn: async () => {
      if (!memberSearch.trim()) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, full_name, avatar_url")
        .or(`username.ilike.%${memberSearch}%,full_name.ilike.%${memberSearch}%`)
        .limit(10);
      return data ?? [];
    },
    enabled: memberSearch.length >= 2,
  });

  const addMember = useMutation({
    mutationFn: async (uid: string) => {
      const { error } = await supabase.from("gym_members").insert({ gym_id: gymId, user_id: uid });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-dashboard-members"] });
      setMemberSearch("");
      toast.success("Membro adicionado");
    },
    onError: () => toast.error("Erro ao adicionar membro"),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gym_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gym-dashboard-members"] }),
  });

  const addEquipment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("gym_equipment").insert({
        gym_id: gymId,
        name: newEquip.name,
        category: newEquip.category,
        quantity: parseInt(newEquip.quantity) || 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-dashboard-equipment"] });
      setNewEquip({ name: "", category: "musculação", quantity: "1" });
      toast.success("Equipamento adicionado");
    },
  });

  const deleteEquipment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gym_equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gym-dashboard-equipment"] }),
  });

  const createCoupon = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("gym_coupons").insert({
        gym_id: gymId,
        code: newCoupon.code.toUpperCase(),
        discount_percent: parseInt(newCoupon.discount_percent) || 10,
        description: newCoupon.description || null,
        max_uses: newCoupon.max_uses ? parseInt(newCoupon.max_uses) : null,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-dashboard-coupons"] });
      setShowCoupon(false);
      setNewCoupon({ code: "", discount_percent: "10", description: "", max_uses: "" });
      toast.success("Cupom criado");
    },
    onError: () => toast.error("Erro ao criar cupom"),
  });

  const deleteCoupon = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gym_coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gym-dashboard-coupons"] }),
  });

  // Update gym info
  const updateGym = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("gyms")
        .update({
          name: editGym.name,
          state: editGym.state,
          city: editGym.city,
          address: editGym.address,
          phone: editGym.phone,
          website: editGym.website,
        })
        .eq("id", gymId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-manager-assignment"] });
      setShowEditGym(false);
      toast.success("Dados atualizados");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  // Create challenge
  const createChallenge = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("challenges").insert({
        title: newChallenge.title,
        description: newChallenge.description || null,
        challenge_type: newChallenge.challenge_type,
        goal_value: parseInt(newChallenge.goal_value) || 10,
        end_date: newChallenge.end_date,
        visibility: newChallenge.visibility,
        requires_approval: newChallenge.visibility === "private",
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-dashboard-challenges"] });
      setShowCreateChallenge(false);
      setNewChallenge({ title: "", description: "", challenge_type: "workout_count", goal_value: "10", end_date: "", visibility: "private" });
      toast.success("Desafio criado!");
    },
    onError: () => toast.error("Erro ao criar desafio"),
  });

  const generateWorkoutForMember = async (memberId: string) => {
    const equipList = equipment?.map((e) => e.name).join(", ") || "";
    const response = await supabase.functions.invoke("generate-workout", {
      body: {
        prompt: workoutPrompt || undefined,
        mode: "new",
        target_user_id: memberId,
        gym_equipment: equipList,
      },
    });
    if (response.error) throw new Error(response.error.message);
  };

  const handleSingleWorkout = async () => {
    if (!selectedMemberId) return;
    setGenerating(true);
    try {
      await generateWorkoutForMember(selectedMemberId);
      toast.success("Treino gerado para o aluno!");
      queryClient.invalidateQueries({ queryKey: ["gym-dashboard-members"] });
      setSelectedMemberId(null);
      setWorkoutPrompt("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar treino");
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkWorkout = async () => {
    if (selectedMembers.size === 0) return;
    setBulkGenerating(true);
    let success = 0;
    let fail = 0;

    for (const memberId of selectedMembers) {
      try {
        const equipList = equipment?.map((e) => e.name).join(", ") || "";
        const response = await supabase.functions.invoke("generate-workout", {
          body: {
            prompt: bulkPrompt || undefined,
            mode: "new",
            target_user_id: memberId,
            gym_equipment: equipList,
          },
        });
        if (response.error) throw new Error(response.error.message);
        success++;
      } catch {
        fail++;
      }
    }

    setBulkGenerating(false);
    setShowBulkWorkout(false);
    setSelectedMembers(new Set());
    setBulkPrompt("");
    queryClient.invalidateQueries({ queryKey: ["gym-dashboard-members"] });

    if (fail === 0) {
      toast.success(`Treino gerado para ${success} aluno(s)!`);
    } else {
      toast.warning(`${success} gerado(s), ${fail} erro(s)`);
    }
  };

  const toggleMemberSelection = (uid: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const selectAllMembers = () => {
    if (!members) return;
    // Only select members who allow gym workout
    const eligible = members.filter((m: any) => m.allow_gym_workout !== false);
    if (selectedMembers.size === eligible.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(eligible.map((m: any) => m.user_id)));
    }
  };

  const equipByCategory = equipment?.reduce<Record<string, typeof equipment>>((acc, eq) => {
    if (!acc[eq.category]) acc[eq.category] = [];
    acc[eq.category].push(eq);
    return acc;
  }, {}) ?? {};

  const selectedMemberProfile = members?.find((m: any) => m.user_id === selectedMemberId)?.profile as any;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR");
  };

  const isExpiringSoon = (d: string | null) => {
    if (!d) return false;
    const diff = new Date(d).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000; // 7 days
  };

  const isExpired = (d: string | null) => {
    if (!d) return false;
    return new Date(d).getTime() < Date.now();
  };

  const activeChallenges = gymChallenges?.filter((c) => c.status === "active").length ?? 0;

  const CHALLENGE_TYPES: Record<string, string> = {
    workout_count: "Total de treinos",
    workout_minutes: "Minutos de treino",
    exercise_sets: "Séries completadas",
    diet_days: "Dias seguindo dieta",
    weight_loss: "Perda de peso (kg)",
    body_fat_loss: "Redução de gordura (%)",
    muscle_gain: "Ganho de massa (kg)",
    measurements: "Redução de medidas (cm)",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - no back button */}
      <div className="bg-gradient-to-br from-primary/20 to-background p-6 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden relative group cursor-pointer" onClick={() => document.getElementById('gym-logo-input')?.click()}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="w-full h-full object-cover"
                onError={() => setLogoUrl("")}
              />
            ) : (
              <Dumbbell className="w-7 h-7 text-primary" />
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Edit3 className="w-4 h-4 text-white" />
            </div>
            <input id="gym-logo-input" type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
                const path = `gyms/${gymId}/logo.${ext}`;
                const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
                if (upErr) { toast.error("Erro ao enviar logo: " + upErr.message); return; }
                const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
                const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
                setLogoUrl(newUrl);
                const { error: updateErr } = await supabase.from("gyms").update({ logo_url: newUrl } as any).eq("id", gymId);
                if (updateErr) { toast.error("Erro ao salvar logo: " + updateErr.message); return; }
                await queryClient.invalidateQueries({ queryKey: ["gym-manager-assignment", userId] });
                await queryClient.refetchQueries({ queryKey: ["gym-manager-assignment", userId] });
                toast.success("Logo atualizada!");
              } catch {
                toast.error("Erro ao atualizar logo");
              }
            }} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">{gym.name}</h1>
            <p className="text-sm text-muted-foreground">{gym.city}, {gym.state}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={() => {
            setEditGym({
              name: gym.name || "",
              state: gym.state || "",
              city: gym.city || "",
              address: gym.address || "",
              phone: gym.phone || "",
              website: gym.website || "",
            });
            setShowEditGym(true);
          }}>
            <Edit3 className="w-5 h-5 text-muted-foreground" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onSignOut}>
            <LogOut className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
        <div className="flex gap-6 mt-4">
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">{members?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Alunos</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">{equipment?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Equipamentos</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">{coupons?.filter((c) => c.is_active).length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Cupons ativos</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">{activeChallenges}</p>
            <p className="text-xs text-muted-foreground">Desafios ativos</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="members"><Users className="w-4 h-4 mr-1" /> Alunos</TabsTrigger>
            <TabsTrigger value="equipment"><Package className="w-4 h-4 mr-1" /> Equip.</TabsTrigger>
            <TabsTrigger value="coupons"><Ticket className="w-4 h-4 mr-1" /> Cupons</TabsTrigger>
            <TabsTrigger value="challenges"><Trophy className="w-4 h-4 mr-1" /> Desafios</TabsTrigger>
          </TabsList>

          {/* MEMBERS TAB */}
          <TabsContent value="members" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar aluno para adicionar..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchResults && searchResults.length > 0 && (
              <Card className="border-border">
                <CardContent className="p-0 divide-y divide-border">
                  {searchResults.map((u) => (
                    <div key={u.user_id} className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                          {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <Users className="w-3 h-3 text-muted-foreground" />}
                        </div>
                        <span className="text-sm text-foreground">@{u.username}</span>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => addMember.mutate(u.user_id)}>
                        <UserPlus className="w-3 h-3 mr-1" /> Adicionar
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Bulk actions & sorting */}
            {members && members.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedMembers.size === members.length && members.length > 0}
                      onCheckedChange={selectAllMembers}
                    />
                    <span className="text-sm text-muted-foreground">
                      {selectedMembers.size > 0 ? `${selectedMembers.size} selecionado(s)` : "Selecionar todos"}
                    </span>
                  </div>
                  {selectedMembers.size > 0 && (
                    <Button size="sm" onClick={() => setShowBulkWorkout(true)}>
                      <Zap className="w-3 h-3 mr-1" /> Gerar treino em massa
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Ordenar:</span>
                  <Button
                    size="sm"
                    variant={sortField === "expiration" ? "default" : "outline"}
                    className="h-6 text-xs px-2"
                    onClick={() => toggleSort("expiration")}
                  >
                    Vencimento {sortField === "expiration" && (sortDir === "asc" ? "↑" : "↓")}
                  </Button>
                  <Button
                    size="sm"
                    variant={sortField === "name" ? "default" : "outline"}
                    className="h-6 text-xs px-2"
                    onClick={() => toggleSort("name")}
                  >
                    Nome {sortField === "name" && (sortDir === "asc" ? "↑" : "↓")}
                  </Button>
                  <Button
                    size="sm"
                    variant={sortField === "joined" ? "default" : "outline"}
                    className="h-6 text-xs px-2"
                    onClick={() => toggleSort("joined")}
                  >
                    Vínculo {sortField === "joined" && (sortDir === "asc" ? "↑" : "↓")}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {sortedMembers.map((m: any) => (
                <Card key={m.id} className="border-border">
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      {m.allow_gym_workout !== false ? (
                        <Checkbox
                          checked={selectedMembers.has(m.user_id)}
                          onCheckedChange={() => toggleMemberSelection(m.user_id)}
                        />
                      ) : (
                        <div className="w-4" />
                      )}
                      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                        {m.profile?.avatar_url ? (
                          <img src={m.profile.avatar_url} className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{m.profile?.full_name || m.profile?.username}</p>
                        <p className="text-xs text-muted-foreground">@{m.profile?.username}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Vínculo: {formatDate(m.joined_at)}
                          </span>
                          <span className={`text-[10px] flex items-center gap-1 ${
                            isExpired(m.workout_expires_at) ? "text-destructive" :
                            isExpiringSoon(m.workout_expires_at) ? "text-orange-500" :
                            "text-muted-foreground"
                          }`}>
                            {isExpired(m.workout_expires_at) && <AlertTriangle className="w-3 h-3" />}
                            Treino: {m.workout_expires_at ? formatDate(m.workout_expires_at) : "Sem treino"}
                          </span>
                          {m.allow_gym_workout === false && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 border-orange-500 text-orange-500">Bloqueado</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {m.allow_gym_workout !== false && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setSelectedMemberId(m.user_id); }}
                        >
                          <Zap className="w-3 h-3 mr-1" /> Treino
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeMember.mutate(m.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!members?.length && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum aluno vinculado</p>
              )}
            </div>
          </TabsContent>

          {/* EQUIPMENT TAB */}
          <TabsContent value="equipment" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nome do equipamento"
                value={newEquip.name}
                onChange={(e) => setNewEquip({ ...newEquip, name: e.target.value })}
                className="flex-1"
              />
              <Select value={newEquip.category} onValueChange={(v) => setNewEquip({ ...newEquip, category: v })}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["musculação", "cardio", "funcional", "livre", "acessório", "outro"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={newEquip.quantity}
                onChange={(e) => setNewEquip({ ...newEquip, quantity: e.target.value })}
                className="w-16"
              />
              <Button onClick={() => addEquipment.mutate()} disabled={!newEquip.name}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {Object.keys(equipByCategory).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum equipamento cadastrado</p>
            ) : (
              Object.entries(equipByCategory).map(([cat, items]) => (
                <Card key={cat} className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{cat}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {items.map((eq) => (
                      <div key={eq.id} className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-foreground">
                          {eq.name} {eq.quantity > 1 && <span className="text-muted-foreground">({eq.quantity})</span>}
                        </span>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteEquipment.mutate(eq.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* COUPONS TAB */}
          <TabsContent value="coupons" className="space-y-4 mt-4">
            <Button onClick={() => setShowCoupon(true)} className="w-full">
              <Plus className="w-4 h-4 mr-2" /> Novo cupom
            </Button>

            {coupons?.map((c) => (
              <Card key={c.id} className="border-border">
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.is_active ? "default" : "secondary"}>{c.code}</Badge>
                      <span className="text-sm font-medium text-foreground">{c.discount_percent}% off</span>
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Usos: {c.current_uses}{c.max_uses ? `/${c.max_uses}` : ""}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteCoupon.mutate(c.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {!coupons?.length && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum cupom criado</p>
            )}
          </TabsContent>

          {/* CHALLENGES TAB - Inline, gym-only */}
          <TabsContent value="challenges" className="space-y-4 mt-4">
            <Button className="w-full" onClick={() => setShowCreateChallenge(true)}>
              <Plus className="w-4 h-4 mr-2" /> Criar desafio
            </Button>

            {gymChallenges && gymChallenges.length > 0 ? (
              gymChallenges.map((c: any) => (
                <Card key={c.id} className="border-border">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">{c.title}</h3>
                      <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-xs">
                        {c.status === "active" ? "Ativo" : c.status === "closed" ? "Encerrado" : c.status}
                      </Badge>
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Tipo: {CHALLENGE_TYPES[c.challenge_type] || c.challenge_type}</span>
                      <span>Meta: {c.goal_value}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.participant_count}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Início: {formatDate(c.start_date)}</span>
                      <span>Fim: {formatDate(c.end_date)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum desafio criado pela academia
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Gym Dialog */}
      <Dialog open={showEditGym} onOpenChange={setShowEditGym}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Academia</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>CNPJ</Label>
              <Input value={gym.cnpj || "Não informado"} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground mt-1">O CNPJ não pode ser alterado</p>
            </div>
            {gym.razao_social && (
              <div>
                <Label>Razão Social</Label>
                <Input value={gym.razao_social} disabled className="bg-muted" />
              </div>
            )}
            <div>
              <Label>Nome fantasia / exibição</Label>
              <Input value={editGym.name} onChange={(e) => setEditGym({ ...editGym, name: e.target.value })} />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={editGym.state} onValueChange={(v) => setEditGym({ ...editGym, state: v, city: "" })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {states.map((s) => (
                    <SelectItem key={s.sigla} value={s.sigla}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cidade</Label>
              <Select value={editGym.city} onValueChange={(v) => setEditGym({ ...editGym, city: v })} disabled={loadingCities || !editGym.state}>
                <SelectTrigger><SelectValue placeholder={loadingCities ? "Carregando..." : "Selecione"} /></SelectTrigger>
                <SelectContent>
                  {cities.map((c) => (
                    <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={editGym.address} onChange={(e) => setEditGym({ ...editGym, address: e.target.value })} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={editGym.phone} onChange={(e) => setEditGym({ ...editGym, phone: e.target.value })} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <Label>Site</Label>
              <Input value={editGym.website} onChange={(e) => setEditGym({ ...editGym, website: e.target.value })} placeholder="https://" />
            </div>
            <Button className="w-full" onClick={() => updateGym.mutate()} disabled={!editGym.name || !editGym.state || !editGym.city}>
              Salvar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Coupon Dialog */}
      <Dialog open={showCoupon} onOpenChange={setShowCoupon}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Cupom</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código</Label>
              <Input
                value={newCoupon.code}
                onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value })}
                placeholder="Ex: PROMO10"
                className="uppercase"
              />
            </div>
            <div>
              <Label>Desconto (%)</Label>
              <Input
                type="number"
                value={newCoupon.discount_percent}
                onChange={(e) => setNewCoupon({ ...newCoupon, discount_percent: e.target.value })}
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input
                value={newCoupon.description}
                onChange={(e) => setNewCoupon({ ...newCoupon, description: e.target.value })}
                placeholder="Desconto de boas-vindas"
              />
            </div>
            <div>
              <Label>Uso máximo (vazio = ilimitado)</Label>
              <Input
                type="number"
                value={newCoupon.max_uses}
                onChange={(e) => setNewCoupon({ ...newCoupon, max_uses: e.target.value })}
              />
            </div>
            <Button className="w-full" onClick={() => createCoupon.mutate()} disabled={!newCoupon.code}>
              Criar cupom
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Single Workout Dialog */}
      <Dialog open={!!selectedMemberId} onOpenChange={(o) => { if (!o) setSelectedMemberId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Gerar treino para {selectedMemberProfile?.full_name || selectedMemberProfile?.username || "aluno"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O treino será gerado com base na anamnese do aluno e nos equipamentos da academia ({equipment?.length ?? 0} cadastrados).
            </p>
            <div>
              <Label>Instruções adicionais (opcional)</Label>
              <Input
                value={workoutPrompt}
                onChange={(e) => setWorkoutPrompt(e.target.value)}
                placeholder="Ex: Foco em hipertrofia, 4x por semana"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleSingleWorkout}
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              {generating ? "Gerando..." : "Gerar treino"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Workout Dialog */}
      <Dialog open={showBulkWorkout} onOpenChange={setShowBulkWorkout}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar treino em massa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Será gerado um treino personalizado para cada um dos <strong>{selectedMembers.size}</strong> aluno(s) selecionado(s), com base na anamnese individual e nos equipamentos da academia.
            </p>
            <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
              {members?.filter((m: any) => selectedMembers.has(m.user_id)).map((m: any) => (
                <div key={m.user_id} className="flex items-center gap-2 text-sm text-foreground">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                    {m.profile?.avatar_url ? <img src={m.profile.avatar_url} className="w-full h-full object-cover" /> : <Users className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  {m.profile?.full_name || m.profile?.username}
                </div>
              ))}
            </div>
            <div>
              <Label>Instruções adicionais (opcional)</Label>
              <Input
                value={bulkPrompt}
                onChange={(e) => setBulkPrompt(e.target.value)}
                placeholder="Ex: Foco em hipertrofia, 4x por semana"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleBulkWorkout}
              disabled={bulkGenerating}
            >
              {bulkGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              {bulkGenerating ? "Gerando treinos..." : `Gerar treino para ${selectedMembers.size} aluno(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Challenge Dialog */}
      <Dialog open={showCreateChallenge} onOpenChange={setShowCreateChallenge}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Criar Desafio</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={newChallenge.title} onChange={(e) => setNewChallenge({ ...newChallenge, title: e.target.value })} placeholder="Nome do desafio" />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea value={newChallenge.description} onChange={(e) => setNewChallenge({ ...newChallenge, description: e.target.value })} placeholder="Detalhes do desafio..." rows={3} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={newChallenge.challenge_type} onValueChange={(v) => setNewChallenge({ ...newChallenge, challenge_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CHALLENGE_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Meta</Label>
              <Input type="number" value={newChallenge.goal_value} onChange={(e) => setNewChallenge({ ...newChallenge, goal_value: e.target.value })} />
            </div>
            <div>
              <Label>Data de término</Label>
              <Input type="date" value={newChallenge.end_date} onChange={(e) => setNewChallenge({ ...newChallenge, end_date: e.target.value })} />
            </div>
            <div>
              <Label>Visibilidade</Label>
              <Select value={newChallenge.visibility} onValueChange={(v) => setNewChallenge({ ...newChallenge, visibility: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Privado (somente convidados)</SelectItem>
                  <SelectItem value="public">Público</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => createChallenge.mutate()} disabled={!newChallenge.title || !newChallenge.end_date}>
              Criar desafio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GymDashboard;
