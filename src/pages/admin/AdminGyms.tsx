import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle, Users, Package, Search, UserCog, RefreshCw, Loader2, Pencil } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useBrazilLocations } from "@/hooks/useBrazilLocations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";

const AdminGyms = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("gyms");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [newGym, setNewGym] = useState({ name: "", state: "", city: "", address: "", cnpj: "", razao_social: "", nome_fantasia: "", phone: "", website: "" });
  const [editGym, setEditGym] = useState<{ id: string; name: string; state: string; city: string; address: string; cnpj: string; razao_social: string; nome_fantasia: string; phone: string; website: string } | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const editLocations = useBrazilLocations(editGym?.state || "");
  const { states, cities } = useBrazilLocations(newGym.state);
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [showEquipment, setShowEquipment] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [newEquip, setNewEquip] = useState({ name: "", category: "musculação", quantity: "1" });
  const [memberSearch, setMemberSearch] = useState("");
  const [showManager, setShowManager] = useState(false);
  const [managerMode, setManagerMode] = useState<"new" | "existing">("new");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerSearchTerm, setManagerSearchTerm] = useState("");
  const [assigningManager, setAssigningManager] = useState(false);
  const [showEquipSuggestions, setShowEquipSuggestions] = useState(false);
  const equipInputRef = useRef<HTMLDivElement>(null);

  // Gyms
  const { data: gyms, isLoading } = useQuery({
    queryKey: ["admin-gyms"],
    queryFn: async () => {
      const { data } = await supabase.from("gyms").select("*").order("name");
      return data ?? [];
    },
  });

  // Suggestions
  const { data: suggestions } = useQuery({
    queryKey: ["admin-gym-suggestions"],
    queryFn: async () => {
      const { data } = await supabase.from("gym_suggestions").select("*").eq("status", "pending").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Equipment for selected gym
  const { data: equipment } = useQuery({
    queryKey: ["admin-gym-equipment", selectedGymId],
    queryFn: async () => {
      if (!selectedGymId) return [];
      const { data } = await supabase.from("gym_equipment").select("*").eq("gym_id", selectedGymId).order("category", { ascending: true });
      return data ?? [];
    },
    enabled: !!selectedGymId,
  });

  // Members for selected gym
  const { data: members } = useQuery({
    queryKey: ["admin-gym-members", selectedGymId],
    queryFn: async () => {
      if (!selectedGymId) return [];
      const { data } = await supabase.from("gym_members").select("id, user_id, joined_at, status").eq("gym_id", selectedGymId);
      if (!data?.length) return [];
      const userIds = data.map((m) => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, full_name, avatar_url").in("user_id", userIds);
      return data.map((m) => ({
        ...m,
        profile: profiles?.find((p) => p.user_id === m.user_id),
      }));
    },
    enabled: !!selectedGymId,
  });

  // Search users for adding members
  const { data: searchResults } = useQuery({
    queryKey: ["admin-member-search", memberSearch],
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

  // Equipment name suggestions from all gyms
  const { data: equipSuggestions } = useQuery({
    queryKey: ["equip-name-suggestions", newEquip.name],
    queryFn: async () => {
      if (!newEquip.name.trim()) return [];
      const { data } = await supabase
        .from("gym_equipment")
        .select("name")
        .ilike("name", `%${newEquip.name}%`)
        .limit(20);
      // Deduplicate
      const unique = [...new Set((data ?? []).map((e) => e.name))];
      return unique;
    },
    enabled: newEquip.name.length >= 2,
  });

  const lookupCnpj = async (cnpj: string) => {
    const cleaned = cnpj.replace(/\D/g, "");
    if (cleaned.length !== 14) return;
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://open.cnpja.com/office/${cleaned}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const data = await res.json();
      const razao = data.company?.name || "";
      const fantasia = data.alias || data.company?.name || "";
      const state = data.address?.state || "";
      const city = data.address?.city || "";
      const street = data.address?.street || "";
      const number = data.address?.number || "";
      const district = data.address?.district || "";
      const address = [street, number, district].filter(Boolean).join(", ");
      const phones = data.phones || [];
      const phone = phones.length > 0 ? `(${phones[0].area}) ${phones[0].number}` : "";
      setNewGym((prev) => ({
        ...prev,
        razao_social: razao,
        nome_fantasia: fantasia,
        name: prev.name || fantasia || razao,
        state: state || prev.state,
        city: city || prev.city,
        address: address || prev.address,
        phone: phone || prev.phone,
      }));
      toast.success("Dados do CNPJ carregados!");
    } catch {
      toast.error("Não foi possível consultar o CNPJ");
    } finally {
      setCnpjLoading(false);
    }
  };

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const createGym = useMutation({
    mutationFn: async () => {
      const cleaned = newGym.cnpj.replace(/\D/g, "");
      const { error } = await supabase.from("gyms").insert({
        name: newGym.name,
        state: newGym.state,
        city: newGym.city,
        address: newGym.address || null,
        cnpj: cleaned,
        razao_social: newGym.razao_social || null,
        nome_fantasia: newGym.nome_fantasia || null,
        phone: newGym.phone || null,
        website: newGym.website || null,
        is_approved: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gyms"] });
      setShowCreate(false);
      setNewGym({ name: "", state: "", city: "", address: "", cnpj: "", razao_social: "", nome_fantasia: "", phone: "", website: "" });
      toast.success("Academia criada");
    },
    onError: () => toast.error("Erro ao criar academia"),
  });

  const updateGym = useMutation({
    mutationFn: async () => {
      if (!editGym) return;
      const cleaned = editGym.cnpj.replace(/\D/g, "");
      const { error } = await supabase.from("gyms").update({
        name: editGym.name,
        state: editGym.state,
        city: editGym.city,
        address: editGym.address || null,
        cnpj: cleaned || null,
        razao_social: editGym.razao_social || null,
        nome_fantasia: editGym.nome_fantasia || null,
        phone: editGym.phone || null,
        website: editGym.website || null,
      } as any).eq("id", editGym.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gyms"] });
      setShowEdit(false);
      setEditGym(null);
      toast.success("Academia atualizada");
    },
    onError: () => toast.error("Erro ao atualizar academia"),
  });

  const openEditGym = (g: any) => {
    setEditGym({
      id: g.id,
      name: g.name || "",
      state: g.state || "",
      city: g.city || "",
      address: g.address || "",
      cnpj: formatCnpj(g.cnpj || ""),
      razao_social: g.razao_social || "",
      nome_fantasia: g.nome_fantasia || "",
      phone: g.phone || "",
      website: g.website || "",
    });
    setShowEdit(true);
  };
  const deleteGym = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gyms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gyms"] });
      toast.success("Academia removida");
    },
  });

  const approveSuggestion = useMutation({
    mutationFn: async (suggestion: any) => {
      await supabase.from("gyms").insert({
        name: suggestion.name,
        state: suggestion.state,
        city: suggestion.city,
        is_approved: true,
      });
      await supabase.from("gym_suggestions").update({ status: "approved" }).eq("id", suggestion.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gyms"] });
      queryClient.invalidateQueries({ queryKey: ["admin-gym-suggestions"] });
      toast.success("Sugestão aprovada e academia criada");
    },
  });

  const addEquipment = useMutation({
    mutationFn: async () => {
      if (!selectedGymId) return;
      const { error } = await supabase.from("gym_equipment").insert({
        gym_id: selectedGymId,
        name: newEquip.name,
        category: newEquip.category,
        quantity: parseInt(newEquip.quantity) || 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gym-equipment"] });
      setNewEquip({ name: "", category: "musculação", quantity: "1" });
      toast.success("Equipamento adicionado");
    },
  });

  const deleteEquipment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gym_equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-gym-equipment"] }),
  });

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      if (!selectedGymId) return;
      const { error } = await supabase.from("gym_members").insert({ gym_id: selectedGymId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gym-members"] });
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-gym-members"] }),
  });

  // Manager search
  const { data: managerSearchResults } = useQuery({
    queryKey: ["admin-manager-search", managerSearchTerm],
    queryFn: async () => {
      if (!managerSearchTerm.trim()) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, full_name, avatar_url")
        .or(`username.ilike.%${managerSearchTerm}%,full_name.ilike.%${managerSearchTerm}%`)
        .limit(10);
      return data ?? [];
    },
    enabled: managerSearchTerm.length >= 2,
  });

  // Current managers for selected gym
  const { data: currentManagers } = useQuery({
    queryKey: ["admin-gym-managers", selectedGymId],
    queryFn: async () => {
      if (!selectedGymId) return [];
      const { data } = await supabase.from("gym_managers" as any).select("*").eq("gym_id", selectedGymId);
      if (!data?.length) return [];
      const userIds = (data as any[]).map((m: any) => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, full_name").in("user_id", userIds);
      return (data as any[]).map((m: any) => ({ ...m, profile: profiles?.find((p) => p.user_id === m.user_id) }));
    },
    enabled: !!selectedGymId,
  });

  const assignManager = async (mode: "new" | "existing", userId?: string) => {
    if (!selectedGymId) return;
    setAssigningManager(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-gym-account", {
        body: mode === "new"
          ? { mode: "new", email: managerEmail, full_name: managerName, gym_id: selectedGymId }
          : { mode: "existing", user_id: userId, gym_id: selectedGymId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(mode === "new" ? "Conta de academia criada!" : "Gerente vinculado!");
      queryClient.invalidateQueries({ queryKey: ["admin-gym-managers"] });
      setManagerEmail("");
      setManagerName("");
      setManagerSearchTerm("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar gerente");
    } finally {
      setAssigningManager(false);
    }
  };

  const removeManager = async (userId: string) => {
    if (!selectedGymId) return;
    try {
      const { data, error } = await supabase.functions.invoke("create-gym-account", {
        body: { mode: "remove", user_id: userId, gym_id: selectedGymId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Gerente removido");
      queryClient.invalidateQueries({ queryKey: ["admin-gym-managers"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover gerente");
    }
  };

  const resendInvite = async (userId: string) => {
    if (!selectedGymId) return;
    try {
      const { data, error } = await supabase.functions.invoke("create-gym-account", {
        body: { mode: "resend_invite", user_id: userId, gym_id: selectedGymId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Email de recuperação de senha reenviado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao reenviar email");
    }
  };

  const selectedGym = gyms?.find((g) => g.id === selectedGymId);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Academias</h2>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova academia
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="gyms">Academias ({gyms?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="suggestions">
              Sugestões ({suggestions?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gyms">
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gyms?.map((g) => (
                    <TableRow key={g.id} className="cursor-pointer" onClick={() => openEditGym(g)}>
                      <TableCell className="font-medium text-foreground hover:text-primary">{g.name}</TableCell>
                      <TableCell className="text-muted-foreground">{g.city}</TableCell>
                      <TableCell className="text-muted-foreground">{g.state}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setSelectedGymId(g.id); setShowManager(true); }}
                          >
                            <UserCog className="w-4 h-4 mr-1" /> Gerente
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setSelectedGymId(g.id); setShowEquipment(true); }}
                          >
                            <Package className="w-4 h-4 mr-1" /> Equipamentos
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setSelectedGymId(g.id); setShowMembers(true); }}
                          >
                            <Users className="w-4 h-4 mr-1" /> Membros
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteGym.mutate(g.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="suggestions">
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!suggestions?.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhuma sugestão pendente
                      </TableCell>
                    </TableRow>
                  ) : (
                    suggestions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                        <TableCell className="text-muted-foreground">{s.city}</TableCell>
                        <TableCell className="text-muted-foreground">{s.state}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(s.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => approveSuggestion.mutate(s)}>
                            <CheckCircle className="w-4 h-4 mr-1" /> Aprovar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Gym Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Academia</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>CNPJ *</Label>
                <div className="flex gap-2">
                  <Input
                    value={newGym.cnpj}
                    onChange={(e) => setNewGym({ ...newGym, cnpj: formatCnpj(e.target.value) })}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => lookupCnpj(newGym.cnpj)}
                    disabled={cnpjLoading || newGym.cnpj.replace(/\D/g, "").length !== 14}
                  >
                    {cnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
                  </Button>
                </div>
              </div>
              {newGym.razao_social && (
                <div>
                  <Label>Razão Social</Label>
                  <Input value={newGym.razao_social} readOnly className="bg-muted" />
                </div>
              )}
              {newGym.nome_fantasia && (
                <div>
                  <Label>Nome Fantasia</Label>
                  <Input value={newGym.nome_fantasia} readOnly className="bg-muted" />
                </div>
              )}
              <div>
                <Label>Nome (exibição)</Label>
                <Input value={newGym.name} onChange={(e) => setNewGym({ ...newGym, name: e.target.value })} placeholder="Nome da academia" />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={newGym.state} onValueChange={(v) => setNewGym({ ...newGym, state: v, city: "" })}>
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
                <Select value={newGym.city} onValueChange={(v) => setNewGym({ ...newGym, city: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {cities.map((c) => (
                      <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Endereço</Label>
                <Input value={newGym.address} onChange={(e) => setNewGym({ ...newGym, address: e.target.value })} placeholder="Endereço" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Telefone</Label>
                  <Input value={newGym.phone} onChange={(e) => setNewGym({ ...newGym, phone: e.target.value })} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <Label>Site</Label>
                  <Input value={newGym.website} onChange={(e) => setNewGym({ ...newGym, website: e.target.value })} placeholder="https://..." />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => createGym.mutate()}
                disabled={!newGym.name || !newGym.state || !newGym.city || newGym.cnpj.replace(/\D/g, "").length !== 14}
              >
                Criar academia
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Gym Dialog */}
        <Dialog open={showEdit} onOpenChange={(open) => { setShowEdit(open); if (!open) setEditGym(null); }}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Editar Academia</DialogTitle></DialogHeader>
            {editGym && (
              <div className="space-y-4">
                <div>
                  <Label>CNPJ</Label>
                  <div className="flex gap-2">
                    <Input
                      value={editGym.cnpj}
                      onChange={(e) => setEditGym({ ...editGym, cnpj: formatCnpj(e.target.value) })}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={async () => {
                        const cleaned = editGym.cnpj.replace(/\D/g, "");
                        if (cleaned.length !== 14) return;
                        setCnpjLoading(true);
                        try {
                          const res = await fetch(`https://open.cnpja.com/office/${cleaned}`);
                          if (!res.ok) throw new Error();
                          const data = await res.json();
                          setEditGym((prev) => prev ? ({
                            ...prev,
                            razao_social: data.company?.name || prev.razao_social,
                            nome_fantasia: data.alias || data.company?.name || prev.nome_fantasia,
                            name: prev.name || data.alias || data.company?.name || "",
                            state: data.address?.state || prev.state,
                            city: data.address?.city || prev.city,
                            address: [data.address?.street, data.address?.number, data.address?.district].filter(Boolean).join(", ") || prev.address,
                            phone: data.phones?.length ? `(${data.phones[0].area}) ${data.phones[0].number}` : prev.phone,
                          }) : prev);
                          toast.success("Dados do CNPJ carregados!");
                        } catch {
                          toast.error("Não foi possível consultar o CNPJ");
                        } finally {
                          setCnpjLoading(false);
                        }
                      }}
                      disabled={cnpjLoading || editGym.cnpj.replace(/\D/g, "").length !== 14}
                    >
                      {cnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
                    </Button>
                  </div>
                </div>
                {editGym.razao_social && (
                  <div>
                    <Label>Razão Social</Label>
                    <Input value={editGym.razao_social} readOnly className="bg-muted" />
                  </div>
                )}
                {editGym.nome_fantasia && (
                  <div>
                    <Label>Nome Fantasia</Label>
                    <Input value={editGym.nome_fantasia} readOnly className="bg-muted" />
                  </div>
                )}
                <div>
                  <Label>Nome (exibição)</Label>
                  <Input value={editGym.name} onChange={(e) => setEditGym({ ...editGym, name: e.target.value })} />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Select value={editGym.state} onValueChange={(v) => setEditGym({ ...editGym, state: v, city: "" })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {editLocations.states.map((s) => (
                        <SelectItem key={s.sigla} value={s.sigla}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Select value={editGym.city} onValueChange={(v) => setEditGym({ ...editGym, city: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {editLocations.cities.map((c) => (
                        <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Endereço</Label>
                  <Input value={editGym.address} onChange={(e) => setEditGym({ ...editGym, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Telefone</Label>
                    <Input value={editGym.phone} onChange={(e) => setEditGym({ ...editGym, phone: e.target.value })} placeholder="(00) 00000-0000" />
                  </div>
                  <div>
                    <Label>Site</Label>
                    <Input value={editGym.website} onChange={(e) => setEditGym({ ...editGym, website: e.target.value })} placeholder="https://..." />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => updateGym.mutate()}
                  disabled={!editGym.name || !editGym.state || !editGym.city}
                >
                  Salvar alterações
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Equipment Dialog */}
        <Dialog open={showEquipment} onOpenChange={setShowEquipment}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Equipamentos — {selectedGym?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-96 overflow-auto">
              {equipment?.map((eq) => (
                <div key={eq.id} className="flex items-center justify-between py-2 border-b border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{eq.name}</p>
                    <p className="text-xs text-muted-foreground">{eq.category} · Qtd: {eq.quantity}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteEquipment.mutate(eq.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {!equipment?.length && <p className="text-sm text-muted-foreground text-center py-4">Nenhum equipamento</p>}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1" ref={equipInputRef}>
                <Input
                  placeholder="Nome"
                  value={newEquip.name}
                  onChange={(e) => { setNewEquip({ ...newEquip, name: e.target.value }); setShowEquipSuggestions(true); }}
                  onFocus={() => setShowEquipSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowEquipSuggestions(false), 200)}
                />
                {showEquipSuggestions && equipSuggestions && equipSuggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-40 overflow-auto">
                    {equipSuggestions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent text-foreground"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setNewEquip({ ...newEquip, name }); setShowEquipSuggestions(false); }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Select value={newEquip.category} onValueChange={(v) => setNewEquip({ ...newEquip, category: v })}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["musculação", "cardio", "funcional", "livre", "acessório", "outro"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="number" value={newEquip.quantity} onChange={(e) => setNewEquip({ ...newEquip, quantity: e.target.value })} className="w-16" />
              <Button onClick={() => addEquipment.mutate()} disabled={!newEquip.name}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Members Dialog */}
        <Dialog open={showMembers} onOpenChange={setShowMembers}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Membros — {selectedGym?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar usuário para adicionar..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} className="pl-9" />
              </div>
              {searchResults && searchResults.length > 0 && (
                <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-auto">
                  {searchResults.map((u) => (
                    <div key={u.user_id} className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm text-foreground">@{u.username}</span>
                      <Button size="sm" variant="secondary" onClick={() => addMember.mutate(u.user_id)}>
                        Adicionar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="max-h-60 overflow-auto space-y-2">
                {members?.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                        {m.profile?.avatar_url ? (
                          <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-sm text-foreground">@{m.profile?.username}</span>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeMember.mutate(m.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                {!members?.length && <p className="text-sm text-muted-foreground text-center py-4">Nenhum membro</p>}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Manager Dialog */}
        <Dialog open={showManager} onOpenChange={setShowManager}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Gerente — {selectedGym?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Current managers */}
              {currentManagers && currentManagers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Gerentes atuais</p>
                  {currentManagers.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between py-2 border-b border-border">
                      <span className="text-sm text-foreground">
                        {m.profile?.full_name || m.profile?.username || m.user_id}
                      </span>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary">Gerente</Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Reenviar email de senha"
                          onClick={() => resendInvite(m.user_id)}
                        >
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          title="Remover gerente"
                          onClick={() => removeManager(m.user_id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Tabs value={managerMode} onValueChange={(v) => setManagerMode(v as "new" | "existing")}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="new">Criar conta nova</TabsTrigger>
                  <TabsTrigger value="existing">Usuário existente</TabsTrigger>
                </TabsList>

                <TabsContent value="new" className="space-y-3 mt-3">
                  <div>
                    <Label>Nome completo</Label>
                    <Input value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="Nome da academia ou responsável" />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} placeholder="email@academia.com" />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => assignManager("new")}
                    disabled={!managerEmail || assigningManager}
                  >
                    {assigningManager ? "Criando..." : "Criar conta de gerente"}
                  </Button>
                </TabsContent>

                <TabsContent value="existing" className="space-y-3 mt-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por username ou nome..."
                      value={managerSearchTerm}
                      onChange={(e) => setManagerSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {managerSearchResults && managerSearchResults.length > 0 && (
                    <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-auto">
                      {managerSearchResults.map((u) => (
                        <div key={u.user_id} className="flex items-center justify-between px-3 py-2">
                          <span className="text-sm text-foreground">
                            {u.full_name ? `${u.full_name} (@${u.username})` : `@${u.username}`}
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => assignManager("existing", u.user_id)}
                            disabled={assigningManager}
                          >
                            <UserCog className="w-3 h-3 mr-1" /> Vincular
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminGyms;
