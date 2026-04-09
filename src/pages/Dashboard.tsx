import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Capacitor } from "@capacitor/core";

import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Dumbbell, Play, Calendar,
  LogOut, ChevronRight, Timer, Flame, Trophy,
  UserCog, History, Sparkles, X, Pencil, Check, MessageSquare, Users, UserCircle, UtensilsCrossed, Trash2, Loader2, RefreshCw, Share2, Gift
} from "lucide-react";
import vynkoLogo from "@/assets/airfit-logo.png";
import { Input } from "@/components/ui/input";
import WorkoutExecution from "@/components/WorkoutExecution";
import WorkoutDayPreview from "@/components/WorkoutDayPreview";
import BottomNav from "@/components/BottomNav";
import NotificationBell from "@/components/NotificationBell";
import SharePlanSheet from "@/components/SharePlanSheet";
import PendingSharesSheet from "@/components/PendingSharesSheet";
import CreateManualWorkoutSheet from "@/components/CreateManualWorkoutSheet";

const isNative = Capacitor.isNativePlatform();

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [program, setProgram] = useState<any>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [hasAnamnesis, setHasAnamnesis] = useState<boolean | null>(null);
  const [workoutDays, setWorkoutDays] = useState<any[]>([]);
  const [selectedDay, setSelectedDayRaw] = useState<any>(() => {
    try { return JSON.parse(sessionStorage.getItem("vynko_selectedDay") || "null"); } catch { return null; }
  });
  const [sessions, setSessions] = useState<any[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showShareWorkout, setShowShareWorkout] = useState(false);
  const [showPendingShares, setShowPendingShares] = useState(false);
  const [showManualCreate, setShowManualCreate] = useState(false);
  const [anamnesisExpired, setAnamnesisExpired] = useState(false);

  const setSelectedDay = useCallback((v: any) => {
    setSelectedDayRaw((prev: any) => {
      const next = typeof v === "function" ? v(prev) : v;
      sessionStorage.setItem("vynko_selectedDay", JSON.stringify(next));
      return next;
    });
  }, []);
  const [view, setViewRaw] = useState<"home" | "preview" | "workout" | "history">(() => {
    return (sessionStorage.getItem("vynko_view") as any) || "home";
  });
  const [profile, setProfile] = useState<any>(null);
  const [previousPrograms, setPreviousPrograms] = useState<any[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [newProgramName, setNewProgramName] = useState("");
  const [selectedHistoryProgram, setSelectedHistoryProgram] = useState<any>(null);
  const [historyDays, setHistoryDays] = useState<any[]>([]);
  const [lastSessionByDay, setLastSessionByDay] = useState<Record<string, string>>({});

  // Generate workout inline state (diet-style)
  const [showRegenForm, setShowRegenForm] = useState(false);
  const [regenMode, setRegenMode] = useState<"edit" | "new">("new");
  const [customPrompt, setCustomPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  // Wrap setView to persist to sessionStorage
  const setView = useCallback((v: "home" | "preview" | "workout" | "history" | ((prev: "home" | "preview" | "workout" | "history") => "home" | "preview" | "workout" | "history")) => {
    setViewRaw((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      sessionStorage.setItem("vynko_view", next);
      return next;
    });
  }, []);

  // Navigate to a view and push browser history so phone back button works
  const goToView = useCallback((newView: "home" | "preview" | "workout" | "history") => {
    if (newView !== "home") {
      window.history.pushState({ view: newView }, "");
    }
    setView(newView);
  }, []);

  // Push initial history state so back button doesn't exit app
  useEffect(() => {
    window.history.replaceState({ view: "home" }, "");
  }, []);

  // Handle phone back button via popstate
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      setView((currentView) => {
        if (currentView === "workout") {
          // Block back button during workout — user must finish or abandon explicitly
          window.history.pushState({ view: "workout" }, "");
          return "workout";
        }
        if (currentView === "preview" || currentView === "history") {
          setSelectedDay(null);
          setSelectedHistoryProgram(null);
          return "home";
        }
        // Already at home — push state back so user can't exit
        window.history.pushState({ view: "home" }, "");
        return "home";
      });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Auto-generate on first onboarding
  useEffect(() => {
    if (dataLoaded && location.state?.autoGenerate && !generating && !program) {
      generateWorkout("new", "");
      window.history.replaceState({}, "");
    }
  }, [dataLoaded, location.state]);

  // Open pending shares from notification tap
  useEffect(() => {
    if (location.state?.openPendingShares) {
      setShowPendingShares(true);
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  // Load data on mount and whenever we return to this page
  useEffect(() => {
    if (user) { 
      loadData(); 
      fetchUnread();
      // Check anamnesis
      supabase.from("anamnesis").select("id, updated_at").eq("user_id", user.id).eq("completed", true).maybeSingle().then(({ data }) => {
        setHasAnamnesis(!!data);
        if (data) {
          const daysSince = Math.floor((Date.now() - new Date(data.updated_at).getTime()) / (1000 * 60 * 60 * 24));
          setAnamnesisExpired(daysSince >= 45);
        }
      });
    }
  }, [user]);

  // Realtime subscription for unread messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('unread-dm')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${user.id}` }, () => {
        fetchUnread();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchUnread = async () => {
    if (!user) return;
    const { count } = await supabase
      .from('direct_messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .is('read_at', null);
    setUnreadMessages(count || 0);
  };

  // Refetch when navigating back to this page (SPA navigation)
  useEffect(() => {
    const handleFocus = () => { if (user) { loadData(); fetchUnread(); } };
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handleFocus);
    };
  }, [user]);

  // Refetch on visibility change (tab switch)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && user) { loadData(); fetchUnread(); }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    const [profileRes, programRes, sessionsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("training_programs").select("*").eq("user_id", user.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1),
      supabase.from("workout_sessions").select("*").eq("user_id", user.id).order("started_at", { ascending: false }).limit(30),
    ]);

    setProfile(profileRes.data);
    setSessions(sessionsRes.data || []);

    const latestProgram = programRes.data?.[0] || null;
    setProgram(latestProgram);

    if (latestProgram) {
      const { data: days } = await supabase
        .from("workout_days")
        .select("*, exercises(*)")
        .eq("program_id", latestProgram.id)
        .order("day_order");
      setWorkoutDays(days || []);

      if (days && days.length > 0) {
        const dayIds = days.map((d: any) => d.id);
        const { data: sessionData } = await supabase
          .from("workout_sessions")
          .select("workout_day_id, started_at")
          .eq("user_id", user.id)
          .in("workout_day_id", dayIds)
          .order("started_at", { ascending: false });

        if (sessionData) {
          const map: Record<string, string> = {};
          for (const s of sessionData) {
            if (!map[s.workout_day_id]) map[s.workout_day_id] = s.started_at;
          }
          setLastSessionByDay(map);
        }
      }
    } else {
      setWorkoutDays([]);
    }
    setDataLoaded(true);
  };

  const generateWorkout = async (mode: "edit" | "new", prompt: string) => {
    if (mode === "edit" && !prompt.trim()) {
      toast.error("Descreva o que deseja alterar no treino atual.");
      return;
    }
    setGenerating(true);
    try {
      const body: any = { prompt: prompt.trim(), mode };
      if (mode === "edit" && workoutDays.length > 0) {
        body.current_workout_summary = workoutDays.map(day => {
          const exercises = day.exercises?.map((ex: any) => `  - ${ex.name}: ${ex.sets}x${ex.reps} (descanso: ${ex.rest_seconds || 60}s)`).join("\n") || "";
          return `${day.name} (${day.muscle_groups}):\n${exercises}`;
        }).join("\n\n");
      }
      const { data, error } = await supabase.functions.invoke("generate-workout", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Treino gerado com sucesso! 🎉");
      setCustomPrompt("");
      setShowRegenForm(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar treino");
    }
    setGenerating(false);
  };

  const loadPreviousPrograms = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("training_programs")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", false)
      .order("created_at", { ascending: false })
      .limit(20);
    setPreviousPrograms(data || []);
    goToView("history");
  };

  const loadHistoryDays = async (prog: any) => {
    setSelectedHistoryProgram(prog);
    const { data: days } = await supabase
      .from("workout_days")
      .select("*, exercises(*)")
      .eq("program_id", prog.id)
      .order("day_order");
    setHistoryDays(days || []);
  };

  const reactivateProgram = async (prog: any) => {
    if (!user) return;
    await supabase.from("training_programs").update({ is_active: false }).eq("user_id", user.id).eq("is_active", true);
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 2);
    await supabase.from("training_programs").update({
      is_active: true,
      starts_at: now.toISOString().split("T")[0],
      expires_at: expiresAt.toISOString().split("T")[0],
    }).eq("id", prog.id);
    toast.success("Treino restaurado com sucesso!");
    setSelectedHistoryProgram(null);
    setView("home");
    await loadData();
  };

  const renameProgram = async () => {
    if (!program || !newProgramName.trim()) return;
    const { error } = await supabase
      .from("training_programs")
      .update({ name: newProgramName.trim() })
      .eq("id", program.id);
    if (error) {
      toast.error("Erro ao renomear treino");
    } else {
      setProgram({ ...program, name: newProgramName.trim() });
      toast.success("Treino renomeado!");
    }
    setEditingName(false);
  };

  const [deletingProgram, setDeletingProgram] = useState(false);

  const deleteProgram = async () => {
    if (!program || !user) return;
    const confirmed = window.confirm("Tem certeza que deseja excluir este treino? Essa ação não pode ser desfeita.");
    if (!confirmed) return;
    
    setDeletingProgram(true);
    try {
      const dayIds = workoutDays.map(d => d.id);
      if (dayIds.length > 0) {
        await supabase.from("exercise_logs").delete().eq("user_id", user.id).in("exercise_id", 
          workoutDays.flatMap((d: any) => d.exercises?.map((e: any) => e.id) || [])
        );
        await supabase.from("exercises").delete().eq("user_id", user.id).in("workout_day_id", dayIds);
        await supabase.from("workout_sessions").delete().eq("user_id", user.id).in("workout_day_id", dayIds);
        await supabase.from("workout_days").delete().eq("user_id", user.id).eq("program_id", program.id);
      }
      await supabase.from("training_programs").delete().eq("id", program.id).eq("user_id", user.id);
      
      setProgram(null);
      setWorkoutDays([]);
      toast.success("Treino excluído com sucesso!");
    } catch (err) {
      toast.error("Erro ao excluir treino");
    }
    setDeletingProgram(false);
  };

  const daysExpired = program ? Math.ceil((new Date(program.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
  const weekSessions = sessions.filter(s => {
    const d = new Date(s.started_at);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  }).length;

  if (view === "preview" && selectedDay) {
    return (
      <WorkoutDayPreview
        day={selectedDay}
        onBack={() => { setView("home"); setSelectedDay(null); window.history.back(); }}
        onStart={() => goToView("workout")}
        onRefresh={loadData}
      />
    );
  }

  if (view === "workout" && selectedDay) {
    return <WorkoutExecution day={selectedDay} onBack={() => { setView("home"); setSelectedDay(null); loadData(); window.history.go(-(window.history.length > 2 ? 2 : 1)); }} />;
  }

  if (view === "history") {
    return (
      <div className="min-h-screen pb-24">
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="container flex items-center justify-between h-14">
            <Button variant="ghost" size="sm" onClick={() => { setView("home"); setSelectedHistoryProgram(null); window.history.back(); }}>
              <ChevronRight className="h-4 w-4 mr-1 rotate-180" /> Voltar
            </Button>
            <span className="font-display font-bold">Séries Anteriores</span>
            <div className="w-16" />
          </div>
        </header>
        <div className="container mt-6 space-y-4">
          {selectedHistoryProgram ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setSelectedHistoryProgram(null)}>
                <ChevronRight className="h-4 w-4 mr-1 rotate-180" /> Voltar à lista
              </Button>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display font-bold text-lg">{selectedHistoryProgram.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    Criado em {new Date(selectedHistoryProgram.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => reactivateProgram(selectedHistoryProgram)}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Restaurar
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{selectedHistoryProgram.description}</p>
              <div className="space-y-3 mt-4">
                {historyDays.map((day: any) => (
                  <div key={day.id} className="glass-card p-4 space-y-2">
                    <p className="font-semibold">{day.name}</p>
                    <p className="text-xs text-muted-foreground">{day.muscle_groups}</p>
                    <div className="space-y-1">
                      {day.exercises?.map((ex: any) => (
                        <p key={ex.id} className="text-sm text-muted-foreground">
                          • {ex.name} — {ex.sets}x{ex.reps}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {previousPrograms.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Nenhuma série anterior encontrada.</p>
                </div>
              ) : (
                previousPrograms.map((prog: any) => (
                  <motion.button
                    key={prog.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => loadHistoryDays(prog)}
                    className="glass-card p-4 w-full text-left flex items-center justify-between hover:border-primary/50 transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-sm">{prog.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(prog.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </motion.button>
                ))
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Gate: if anamnesis not completed, show prompt
  if (hasAnamnesis === false) {
    return (
      <div className="min-h-screen pb-24">
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="container flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-primary" />
              <span className="font-display font-bold text-lg">Meus Treinos</span>
            </div>
            <NotificationBell />
          </div>
        </header>
        <div className="container mt-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 text-center space-y-4 max-w-md mx-auto">
            <UserCog className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-xl font-display font-bold">Preencha sua anamnese</h2>
            <p className="text-muted-foreground text-sm">
              Para gerar treinos personalizados, precisamos conhecer seu perfil físico, objetivos e limitações.
            </p>
            <Button onClick={() => navigate("/onboarding", { state: { returnTo: "/training" } })} className="gradient-primary text-primary-foreground w-full">
              <Sparkles className="h-4 w-4 mr-2" /> Preencher Anamnese
            </Button>
          </motion.div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-primary drop-shadow-[0_0_6px_hsl(var(--primary))]" />
            <span className="font-display font-bold text-lg">Meus Treinos</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
          </div>
        </div>
      </header>

      <div className="container mt-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-muted-foreground text-sm">Olá,</p>
          <h1 className="text-2xl font-display font-bold">{profile?.full_name || "Atleta"} 💪</h1>
        </motion.div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Flame, label: "Esta semana", value: `${weekSessions}x` },
            { icon: Trophy, label: "Total", value: `${sessions.length}` },
            { icon: Timer, label: "Programa", value: daysExpired > 0 ? `${daysExpired}d` : "—" },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-4 text-center">
              <stat.icon className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Quick actions grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 gap-3"
        >
          {program && (
            <button
              onClick={() => setShowRegenForm(true)}
              className="glass-card p-3 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors active:scale-95"
            >
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-semibold text-center leading-tight">Novo Treino</span>
            </button>
          )}
          <button
            onClick={() => setShowManualCreate(true)}
            className="glass-card p-3 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors active:scale-95"
          >
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Pencil className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xs font-semibold text-center leading-tight">Criar Manual</span>
          </button>
          {program && (
            <button
              onClick={loadPreviousPrograms}
              className="glass-card p-3 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors active:scale-95"
            >
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <History className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-semibold text-center leading-tight">Anteriores</span>
            </button>
          )}
          <button
            onClick={() => navigate("/onboarding", { state: { returnTo: "/training" } })}
            className="glass-card p-3 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors active:scale-95 relative"
          >
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <UserCog className="h-5 w-5 text-primary" />
            </div>
            {anamnesisExpired && (
              <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
            )}
            <span className="text-xs font-semibold text-center leading-tight">Preferências</span>
          </button>
        </motion.div>

        {program && daysExpired <= 7 && daysExpired > 0 && (
          <div className="glass-card p-4 border-warning/50 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-warning flex-shrink-0" />
            <p className="text-sm">Seu programa vence em <strong>{daysExpired} dias</strong>. Considere gerar um novo.</p>
          </div>
        )}

        {/* Generate workout inline form (diet-style) */}
        {showRegenForm && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setRegenMode("edit")}
                className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                  regenMode === "edit"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary/50 text-muted-foreground"
                }`}
              >
                <Pencil className="h-4 w-4 mx-auto mb-1" />
                Editar atual
              </button>
              <button
                onClick={() => setRegenMode("new")}
                className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                  regenMode === "new"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary/50 text-muted-foreground"
                }`}
              >
                <RefreshCw className="h-4 w-4 mx-auto mb-1" />
                Novo do zero
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {regenMode === "edit"
                ? "Diga o que quer mudar no treino atual. A IA vai ajustar mantendo o restante."
                : "Um treino completamente novo será gerado baseado no seu perfil e instruções."}
            </p>
            <Textarea
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder={regenMode === "edit"
                ? "Ex: Troque supino reto por inclinado, adicione mais exercícios de costas..."
                : "Ex: Quero treino focado em hipertrofia, 4 dias por semana..."
              }
              className="bg-secondary min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => generateWorkout(regenMode, customPrompt)}
                disabled={generating}
                className="gradient-primary text-primary-foreground flex-1"
              >
                {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</> : <><Sparkles className="h-4 w-4 mr-2" /> {regenMode === "edit" ? "Ajustar Treino" : "Gerar Novo"}</>}
              </Button>
              <Button variant="outline" onClick={() => setShowRegenForm(false)} disabled={generating}>Cancelar</Button>
            </div>
          </motion.div>
        )}

        {!dataLoaded ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !program ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-8 text-center space-y-4">
            <Dumbbell className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-xl font-display font-bold">Gere seu primeiro treino</h2>
            <p className="text-muted-foreground text-sm">
              Vamos criar um programa personalizado baseado no seu perfil!
            </p>
            <div className="space-y-3 max-w-md mx-auto">
              <Textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Ex: Quero treino focado em hipertrofia, 4x por semana, com drop sets..."
                className="bg-secondary min-h-[80px]"
              />
              <Button
                onClick={() => generateWorkout("new", customPrompt)}
                disabled={generating}
                className="gradient-primary text-primary-foreground w-full"
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando treino...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Gerar Treino com IA</>
                )}
              </Button>
            </div>
          </motion.div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newProgramName}
                    onChange={e => setNewProgramName(e.target.value)}
                    className="h-8 text-lg font-display font-bold"
                    autoFocus
                    onKeyDown={e => { if (e.key === "Enter") renameProgram(); if (e.key === "Escape") setEditingName(false); }}
                  />
                  <Button variant="ghost" size="sm" onClick={renameProgram}><Check className="h-4 w-4 text-primary" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingName(false)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <>
                  <h2 className="font-display font-bold text-lg">{program.name}</h2>
                  <Button variant="ghost" size="sm" onClick={() => { setEditingName(true); setNewProgramName(program.name); }}>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                   <Button variant="ghost" size="sm" onClick={deleteProgram} disabled={deletingProgram}>
                    {deletingProgram ? <Loader2 className="h-3.5 w-3.5 animate-spin text-destructive" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowShareWorkout(true)}>
                    <Share2 className="h-3.5 w-3.5 text-primary" />
                  </Button>
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{program.description}</p>

            <div className="space-y-3">
              {workoutDays.map((day, i) => (
                <motion.button
                  key={day.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => { setSelectedDay(day); goToView("preview"); }}
                  className="glass-card p-4 w-full text-left flex items-center justify-between hover:border-primary/50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 min-w-[2.5rem] rounded-lg gradient-primary flex items-center justify-center font-display font-bold text-primary-foreground text-sm">
                      {day.day_order}
                    </div>
                    <div>
                      <p className="font-semibold">{day.name}</p>
                      <p className="text-sm text-muted-foreground">{day.muscle_groups} • {day.exercises?.length || 0} exercícios</p>
                      {lastSessionByDay[day.id] ? (
                        <p className="text-xs text-primary mt-0.5">
                          Último: {new Date(lastSessionByDay[day.id]).toLocaleDateString("pt-BR")}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/60 mt-0.5">Ainda não executado</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Play className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </div>

      {program && (
        <>
          <SharePlanSheet open={showShareWorkout} onOpenChange={setShowShareWorkout} planType="workout" programId={program.id} planName={program.name} />
          <PendingSharesSheet open={showPendingShares} onOpenChange={setShowPendingShares} onAccepted={() => loadData()} />
        </>
      )}
      <CreateManualWorkoutSheet open={showManualCreate} onOpenChange={setShowManualCreate} onCreated={loadData} />
      <BottomNav />
    </div>
  );
};

export default Dashboard;
