import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Check, Youtube, Timer, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  day: any;
  onBack: () => void;
}

const WorkoutExecution = ({ day, onBack }: Props) => {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<any[]>(day.exercises || []);
  const [currentIdx, setCurrentIdxRaw] = useState(() => {
    const saved = sessionStorage.getItem("vynko_currentIdx");
    return saved ? parseInt(saved, 10) : 0;
  });
  const [logs, setLogsRaw] = useState<Record<string, { weight: string }>>(() => {
    try { return JSON.parse(sessionStorage.getItem("vynko_logs") || "{}"); } catch { return {}; }
  });
  const [sessionId, setSessionIdRaw] = useState<string | null>(() => sessionStorage.getItem("vynko_sessionId"));
  const [startTime] = useState(() => {
    const saved = sessionStorage.getItem("vynko_startTime");
    if (saved) return new Date(saved);
    const now = new Date();
    sessionStorage.setItem("vynko_startTime", now.toISOString());
    return now;
  });
  const [elapsed, setElapsed] = useState(() => {
    const saved = sessionStorage.getItem("vynko_startTime");
    return saved ? Math.floor((Date.now() - new Date(saved).getTime()) / 1000) : 0;
  });

  const setCurrentIdx = (v: number | ((p: number) => number)) => {
    setCurrentIdxRaw(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      sessionStorage.setItem("vynko_currentIdx", String(next));
      return next;
    });
  };

  const setLogs = (v: any) => {
    setLogsRaw((prev: any) => {
      const next = typeof v === "function" ? v(prev) : v;
      sessionStorage.setItem("vynko_logs", JSON.stringify(next));
      return next;
    });
  };

  const setSessionId = (v: string | null) => {
    setSessionIdRaw(v);
    if (v) sessionStorage.setItem("vynko_sessionId", v);
    else sessionStorage.removeItem("vynko_sessionId");
  };

  useEffect(() => {
    const elapsedMs = Date.now() - startTime.getTime();
    if (elapsedMs >= 6 * 60 * 60 * 1000) {
      toast.info("Treino encerrado automaticamente após 6 horas.");
      finishWorkout();
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const secs = Math.floor((now - startTime.getTime()) / 1000);
      setElapsed(secs);
      if (secs >= 6 * 60 * 60) {
        toast.info("Treino encerrado automaticamente após 6 horas.");
        finishWorkout();
      }
    }, 1000);
    if (!sessionId) startSession();
    if (Object.keys(logs).length === 0) loadLastWeights();
    return () => clearInterval(interval);
  }, []);

  const startSession = async () => {
    if (!user) return;
    const { data } = await supabase.from("workout_sessions").insert({
      user_id: user.id,
      workout_day_id: day.id,
    }).select().single();
    if (data) setSessionId(data.id);
  };

  const loadLastWeights = async () => {
    if (!user) return;
    const exerciseIds = exercises.map((ex: any) => ex.id);
    if (exerciseIds.length === 0) return;

    const { data: allLogs } = await supabase
      .from("exercise_logs")
      .select("exercise_id, weight_used")
      .eq("user_id", user.id)
      .in("exercise_id", exerciseIds)
      .order("logged_at", { ascending: false });

    if (allLogs) {
      const lastWeights: Record<string, { weight: string }> = {};
      for (const log of allLogs) {
        if (!lastWeights[log.exercise_id] && log.weight_used != null) {
          lastWeights[log.exercise_id] = { weight: String(log.weight_used) };
        }
      }
      setLogs(lastWeights);
    }
  };

  const updateLog = (exId: string, field: string, value: string) => {
    setLogs(prev => ({
      ...prev,
      [exId]: { ...prev[exId], [field]: value },
    }));
  };

  const saveExerciseLog = async (exercise: any) => {
    if (!user) return;
    const log = logs[exercise.id];

    const { error } = await supabase.from("exercise_logs").insert({
      exercise_id: exercise.id,
      user_id: user.id,
      weight_used: log?.weight ? parseFloat(log.weight) : null,
      reps_done: parseInt(exercise.reps) || null,
      sets_done: exercise.sets,
    });

    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success(`${exercise.name} registrado! ✅`);
      if (currentIdx < exercises.length - 1) {
        setCurrentIdx(prev => prev + 1);
      }
    }
  };

  const abandonWorkout = async () => {
    // Delete exercise logs for this session
    if (user) {
      const exerciseIds = exercises.map((ex: any) => ex.id);
      if (exerciseIds.length > 0) {
        // Delete logs created after session start
        await supabase
          .from("exercise_logs")
          .delete()
          .eq("user_id", user.id)
          .in("exercise_id", exerciseIds)
          .gte("logged_at", startTime.toISOString());
      }
    }

    // Delete the session record (not finished)
    if (sessionId) {
      await supabase.from("workout_sessions").delete().eq("id", sessionId);
    }

    clearSessionStorage();
    toast("Treino abandonado. Nenhum registro foi salvo.");
    onBack();
  };

  const clearSessionStorage = () => {
    sessionStorage.removeItem("vynko_startTime");
    sessionStorage.removeItem("vynko_currentIdx");
    sessionStorage.removeItem("vynko_logs");
    sessionStorage.removeItem("vynko_sessionId");
    sessionStorage.removeItem("vynko_view");
    sessionStorage.removeItem("vynko_selectedDay");
  };

  const finishWorkout = async () => {
    if (sessionId) {
      const duration = Math.floor((Date.now() - startTime.getTime()) / 60000);
      await supabase.from("workout_sessions").update({
        finished_at: new Date().toISOString(),
        duration_minutes: duration,
      }).eq("id", sessionId);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const res = await supabase.functions.invoke("gamification", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.data) {
          const g = res.data;
          let msg = `Treino finalizado! 💪 +${g.xp_gained} XP`;
          if (g.streak > 1) msg += ` | 🔥 ${g.streak} dias seguidos`;
          if (g.new_badges?.length) msg += ` | 🏅 ${g.new_badges.join(", ")}`;
          toast.success(msg);
        } else {
          toast.success("Treino finalizado! 💪");
        }
      } else {
        toast.success("Treino finalizado! 💪");
      }
    } catch {
      toast.success("Treino finalizado! 💪");
    }

    clearSessionStorage();
    onBack();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const openYoutube = (name: string) => {
    window.open(`https://www.youtube.com/results?search_query=como+fazer+${encodeURIComponent(name)}+exercício`, "_blank");
  };

  const current = exercises[currentIdx];

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive">
                <X className="h-4 w-4 mr-1" /> Abandonar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Abandonar treino?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todos os registros desta sessão serão descartados. O treino não será contabilizado.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Continuar treinando</AlertDialogCancel>
                <AlertDialogAction onClick={abandonWorkout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sim, abandonar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="flex items-center gap-2 text-sm font-mono">
            <Timer className="h-4 w-4 text-primary" />
            {formatTime(elapsed)}
          </div>
          <div className="w-16" />
        </div>
      </header>

      <div className="container mt-4 space-y-4">
        <div>
          <h2 className="font-display font-bold text-lg">{day.name}</h2>
          <p className="text-sm text-muted-foreground">{day.muscle_groups}</p>
        </div>

        {/* Exercise tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {exercises.map((ex: any, i: number) => (
            <button
              key={ex.id}
              onClick={() => setCurrentIdx(i)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i === currentIdx
                  ? "gradient-primary text-primary-foreground"
                  : logs[ex.id] ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"
              }`}
            >
              {i + 1}. {ex.name.split(" ").slice(0, 2).join(" ")}
            </button>
          ))}
        </div>

        {/* Current exercise */}
        {current && (
          <motion.div key={current.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
            <div>
              <h3 className="text-lg font-display font-bold">{current.name}</h3>
              <div className="flex items-center gap-3 mt-1 text-sm font-medium text-primary">
                <span>{current.sets} séries</span>
                <span>×</span>
                <span>{current.reps} reps</span>
                <span>•</span>
                <span>{current.rest_seconds}s descanso</span>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={() => openYoutube(current.name)} className="w-full border-primary/40 text-primary">
              <Youtube className="h-4 w-4 mr-2" /> Como fazer este exercício
            </Button>

            {current.notes && (
              <p className="text-sm text-primary italic border-l-2 border-primary pl-3">{current.notes}</p>
            )}

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Peso (kg)</label>
              <Input
                type="number"
                placeholder="0"
                value={logs[current.id]?.weight || ""}
                onChange={e => updateLog(current.id, "weight", e.target.value)}
                className="bg-secondary text-center text-lg font-bold"
              />
            </div>

            <Button onClick={() => saveExerciseLog(current)} className="w-full gradient-primary text-primary-foreground">
              <Check className="h-4 w-4 mr-2" /> Registrar
            </Button>
          </motion.div>
        )}

        {/* Exercise list */}
        <div className="space-y-2">
          {exercises.map((ex: any, i: number) => (
            <button
              key={ex.id}
              onClick={() => setCurrentIdx(i)}
              className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${
                i === currentIdx ? "bg-primary/10 border border-primary/30" : "bg-secondary/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}</span>
                <span className={`text-sm ${logs[ex.id] ? "text-primary" : ""}`}>{ex.name}</span>
              </div>
              {logs[ex.id] && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border/50 z-50">
        <div className="container">
          <Button onClick={finishWorkout} className="w-full gradient-primary text-primary-foreground h-12 text-base font-bold">
            <Check className="h-5 w-5 mr-2" /> Finalizar Treino
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WorkoutExecution;
