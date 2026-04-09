import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBrazilLocations } from "@/hooks/useBrazilLocations";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ChevronLeft, Camera, Loader2, Save, LogOut,
  Dumbbell, Trophy, Flame, Medal, Eye, EyeOff,
  MapPin, Building2, Trash2, Users2, Sun, Moon,
  DollarSign, BellOff, Bell
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import BottomNav from "@/components/BottomNav";
import NotificationBell from "@/components/NotificationBell";
import GymSelector from "@/components/profile/GymSelector";
import UserBadges from "@/components/profile/UserBadges";
import AvatarWithBadge from "@/components/profile/AvatarWithBadge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";

const StateSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const { states } = useBrazilLocations("");
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
      <SelectContent className="max-h-60 bg-popover z-50">
        {states.map(s => (
          <SelectItem key={s.sigla} value={s.sigla}>{s.sigla} - {s.nome}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const CitySelect = ({ state: uf, value, onChange }: { state: string; value: string; onChange: (v: string) => void }) => {
  const { cities, loadingCities } = useBrazilLocations(uf);
  return (
    <Select value={value} onValueChange={onChange} disabled={!uf || loadingCities}>
      <SelectTrigger><SelectValue placeholder={loadingCities ? "Carregando..." : "Selecione"} /></SelectTrigger>
      <SelectContent className="max-h-60 bg-popover z-50">
        {cities.map(c => (
          <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const Profile = () => {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [gymName, setGymName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Privacy
  const [isPublic, setIsPublic] = useState(true);
  const [showTotalWorkouts, setShowTotalWorkouts] = useState(true);
  const [showPrs, setShowPrs] = useState(true);
  const [showStreak, setShowStreak] = useState(true);
  const [showRanking, setShowRanking] = useState(true);
  const [showChallengesWon, setShowChallengesWon] = useState(true);
  const [allowGymWorkout, setAllowGymWorkout] = useState(true);

  // Stats (read-only)
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    setLoading(true);

    const [profileRes, sessionsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("workout_sessions").select("started_at").eq("user_id", user.id).order("started_at", { ascending: false }),
    ]);

    if (profileRes.data) {
      const p = profileRes.data;
      setFullName(p.full_name || "");
      setUsername((p as any).username || "");
      setBio((p as any).bio || "");
      setCity((p as any).city || "");
      setState((p as any).state || "");
      setGymName((p as any).gym_name || "");
      setAvatarUrl(p.avatar_url);
      setIsPublic((p as any).is_public ?? true);
      setShowTotalWorkouts((p as any).show_total_workouts ?? true);
      setShowPrs((p as any).show_prs ?? true);
      setShowStreak((p as any).show_streak ?? true);
      setShowRanking((p as any).show_ranking ?? true);
      setShowChallengesWon((p as any).show_challenges_won ?? true);
      setAllowGymWorkout((p as any).allow_gym_workout ?? true);
    }

    // Calculate stats
    const sessions = sessionsRes.data || [];
    setTotalWorkouts(sessions.length);

    // Calculate streak
    if (sessions.length > 0) {
      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const uniqueDays = new Set(
        sessions.map(s => {
          const d = new Date(s.started_at);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        })
      );
      const sortedDays = [...uniqueDays].sort((a, b) => b - a);

      // Check if trained today or yesterday to start counting
      const diffFromToday = (today.getTime() - sortedDays[0]) / (1000 * 60 * 60 * 24);
      if (diffFromToday <= 1) {
        streak = 1;
        for (let i = 1; i < sortedDays.length; i++) {
          const diff = (sortedDays[i - 1] - sortedDays[i]) / (1000 * 60 * 60 * 24);
          if (diff === 1) streak++;
          else break;
        }
      }
      setCurrentStreak(streak);
    }

    setLoading(false);
  };

  const compressImage = (file: File, maxSizeKB = 4800): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        const { naturalWidth: w, naturalHeight: h } = img;

        // Center-crop to square
        const size = Math.min(w, h);
        const sx = (w - size) / 2;
        const sy = (h - size) / 2;

        // Output max 800x800
        const outSize = Math.min(size, 800);
        canvas.width = outSize;
        canvas.height = outSize;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, outSize, outSize);

        let quality = 0.85;
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) { resolve(file); return; }
              if (blob.size > maxSizeKB * 1024 && quality > 0.3) {
                quality -= 0.1;
                tryCompress();
              } else {
                resolve(blob);
              }
            },
            "image/jpeg",
            quality
          );
        };
        tryCompress();
      };
      img.src = url;
    });
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);

    const compressed = await compressImage(file);
    const path = `${user.id}/avatar.jpeg`;

    await supabase.storage.from("avatars").remove([path]);

    const { error } = await supabase.storage.from("avatars").upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
    if (error) {
      toast.error("Erro ao enviar foto");
      setUploadingAvatar(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    setAvatarUrl(newUrl);

    await supabase.from("profiles").update({ avatar_url: newUrl }).eq("user_id", user.id);
    toast.success("Foto atualizada!");
    setUploadingAvatar(false);
  };

  const validateUsername = (val: string) => {
    setUsername(val);
    if (!val) { setUsernameError("Username obrigatório"); return; }
    if (val.length < 3) { setUsernameError("Mínimo 3 caracteres"); return; }
    if (val.length > 30) { setUsernameError("Máximo 30 caracteres"); return; }
    if (!/^[a-zA-Z0-9_.]+$/.test(val)) { setUsernameError("Apenas letras, números, _ e ."); return; }
    setUsernameError("");
  };

  const saveProfile = async () => {
    if (!user) return;
    if (usernameError) { toast.error(usernameError); return; }
    setSaving(true);

    const { error } = await supabase.from("profiles").update({
      full_name: fullName.trim() || null,
      username: username.trim(),
      bio: bio.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      gym_name: gymName.trim() || null,
      is_public: isPublic,
      show_total_workouts: showTotalWorkouts,
      show_prs: showPrs,
      show_streak: showStreak,
      show_ranking: showRanking,
      show_challenges_won: showChallengesWon,
      allow_gym_workout: allowGymWorkout,
    } as any).eq("user_id", user.id);

    if (error) {
      if (error.message?.includes("idx_profiles_username") || error.message?.includes("duplicate")) {
        toast.error("Esse username já está em uso");
      } else if (error.message?.includes("chk_username_format")) {
        toast.error("Username inválido: use apenas letras, números, _ e . (3-30 caracteres)");
      } else {
        toast.error("Erro ao salvar perfil");
      }
    } else {
      toast.success("Perfil salvo!");
      navigate("/");
    }
    setSaving(false);
  };

  const initials = (fullName || "U").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <span className="font-display font-bold">Meu Perfil</span>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button variant="ghost" size="sm" onClick={saveProfile} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="container mt-6 space-y-6">
        {/* Avatar */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3">
          <div className="relative">
            <AvatarWithBadge
              userId={user?.id || ""}
              avatarUrl={avatarUrl}
              fallback={initials}
              className="h-24 w-24"
              fallbackClassName="text-2xl bg-primary/20 text-primary"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 h-8 w-8 rounded-full gradient-primary flex items-center justify-center shadow-md z-10"
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <Loader2 className="h-4 w-4 text-primary-foreground animate-spin" />
              ) : (
                <Camera className="h-4 w-4 text-primary-foreground" />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
          </div>
          {user && <UserBadges userId={user.id} />}
          <p className="text-sm text-muted-foreground">Toque no ícone para trocar a foto</p>
        </motion.div>

        {/* Basic Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-4 space-y-4">
          <h3 className="font-display font-bold text-sm">Informações</h3>

          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Seu nome" />
          </div>

          <div className="space-y-2">
            <Label>Username</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
              <Input
                value={username}
                onChange={e => validateUsername(e.target.value.toLowerCase())}
                placeholder="seu.username"
                className="pl-7"
                maxLength={30}
              />
            </div>
            {usernameError && <p className="text-xs text-destructive">{usernameError}</p>}
            <p className="text-xs text-muted-foreground">Seu link: {window.location.origin}/{username || "..."}</p>
          </div>

          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Fale sobre você..." rows={3} maxLength={200} />
            <p className="text-xs text-muted-foreground text-right">{bio.length}/200</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Estado</Label>
              <StateSelect value={state} onChange={(v) => { setState(v); setCity(""); }} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Cidade</Label>
              <CitySelect state={state} value={city} onChange={setCity} />
            </div>
          </div>

          <GymSelector city={city} state={state} value={gymName} onChange={setGymName} />
        </motion.div>

        {/* Appearance */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4 space-y-4">
          <h3 className="font-display font-bold text-sm">Aparência</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {theme === "dark" ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
              <div>
                <p className="text-sm font-medium">Modo {theme === "dark" ? "noturno" : "diurno"}</p>
                <p className="text-xs text-muted-foreground">
                  {theme === "dark" ? "Fundo escuro, ideal para a noite" : "Fundo claro, ideal para o dia"}
                </p>
              </div>
            </div>
            <Switch checked={theme === "light"} onCheckedChange={(v) => setTheme(v ? "light" : "dark")} />
          </div>
        </motion.div>

        {/* Privacy */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4 space-y-4">
          <h3 className="font-display font-bold text-sm">Privacidade</h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isPublic ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">Perfil público</p>
                <p className="text-xs text-muted-foreground">
                  {isPublic ? "Qualquer pessoa pode ver seu perfil" : "Apenas amigos podem ver seu perfil"}
                </p>
              </div>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Academia gerar treinos</p>
                <p className="text-xs text-muted-foreground">
                  {allowGymWorkout ? "Sua academia pode gerar treinos para você" : "Sua academia NÃO pode gerar treinos para você"}
                </p>
              </div>
            </div>
            <Switch checked={allowGymWorkout} onCheckedChange={setAllowGymWorkout} />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {localStorage.getItem("vynko_notifications_off") ? <BellOff className="h-4 w-4 text-muted-foreground" /> : <Bell className="h-4 w-4 text-primary" />}
              <div>
                <p className="text-sm font-medium">Notificações</p>
                <p className="text-xs text-muted-foreground">
                  {localStorage.getItem("vynko_notifications_off") ? "Notificações desativadas" : "Receber notificações no app"}
                </p>
              </div>
            </div>
            <Switch 
              checked={!localStorage.getItem("vynko_notifications_off")} 
              onCheckedChange={(v) => {
                if (v) {
                  localStorage.removeItem("vynko_notifications_off");
                } else {
                  localStorage.setItem("vynko_notifications_off", "true");
                }
                // force re-render
                setAllowGymWorkout(prev => { setTimeout(() => setAllowGymWorkout(prev), 0); return prev; });
              }} 
            />
          </div>
        </motion.div>

        {/* Public Metrics */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-4 space-y-4">
          <h3 className="font-display font-bold text-sm">Métricas públicas</h3>
          <p className="text-xs text-muted-foreground">Escolha quais métricas ficam visíveis no seu perfil</p>

          {[
            { label: "Total de treinos", icon: Dumbbell, value: showTotalWorkouts, setter: setShowTotalWorkouts, stat: totalWorkouts },
            { label: "PRs", icon: Trophy, value: showPrs, setter: setShowPrs, stat: "—" },
            { label: "Streak", icon: Flame, value: showStreak, setter: setShowStreak, stat: `${currentStreak}d` },
            { label: "Ranking mais alto", icon: Medal, value: showRanking, setter: setShowRanking, stat: "—" },
            { label: "Desafios ganhos", icon: Trophy, value: showChallengesWon, setter: setShowChallengesWon, stat: "—" },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">Atual: {item.stat}</p>
                </div>
              </div>
              <Switch checked={item.value} onCheckedChange={item.setter} />
            </div>
          ))}
        </motion.div>

        <Button onClick={saveProfile} disabled={saving} className="w-full gradient-primary text-primary-foreground">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Perfil
        </Button>

        {/* Affiliate */}
        <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10" onClick={() => navigate("/affiliate-landing")}>
          <DollarSign className="h-4 w-4 mr-2" /> Quero ser Afiliado
        </Button>

        {/* Logout */}
        <Button variant="outline" className="w-full" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sair da conta
        </Button>

        {/* Delete Account */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4 mr-2" /> Excluir minha conta
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir conta permanentemente?</AlertDialogTitle>
              <AlertDialogDescription>
                Essa ação é irreversível. Todos os seus treinos, dietas, mensagens e dados serão excluídos permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deletingAccount}
                onClick={async () => {
                  setDeletingAccount(true);
                  try {
                    const { data, error } = await supabase.functions.invoke("delete-account");
                    if (error) throw error;
                    if (data?.error) throw new Error(data.error);
                    await signOut();
                    toast.success("Conta excluída com sucesso.");
                  } catch (err: any) {
                    toast.error(err.message || "Erro ao excluir conta");
                  }
                  setDeletingAccount(false);
                }}
              >
                {deletingAccount ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Sim, excluir tudo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <BottomNav />
    </div>
  );
};

export default Profile;
