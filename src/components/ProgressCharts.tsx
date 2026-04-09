import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Scale, TrendingUp, Calendar, Plus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface Props {
  onBack: () => void;
}

const ProgressCharts = ({ onBack }: Props) => {
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [newBodyFat, setNewBodyFat] = useState("");

  useEffect(() => {
    if (user) loadProgress();
  }, [user]);

  const loadProgress = async () => {
    if (!user) return;
    const [measRes, sessRes, logsRes] = await Promise.all([
      supabase.from("measurements").select("*").eq("user_id", user.id).order("measured_at"),
      supabase.from("workout_sessions").select("*").eq("user_id", user.id).order("started_at"),
      supabase.from("exercise_logs").select("*, exercises(name)").eq("user_id", user.id).order("logged_at"),
    ]);
    setMeasurements(measRes.data || []);
    setSessions(sessRes.data || []);
    setExerciseLogs(logsRes.data || []);
  };

  const saveMeasurement = async () => {
    if (!user || !newWeight) return;
    const { error } = await supabase.from("measurements").insert({
      user_id: user.id,
      weight: parseFloat(newWeight),
      body_fat_percentage: newBodyFat ? parseFloat(newBodyFat) : null,
    });
    if (error) toast.error("Erro ao salvar");
    else {
      toast.success("Medida registrada!");
      setShowForm(false);
      setNewWeight("");
      setNewBodyFat("");
      loadProgress();
    }
  };

  // Prepare chart data
  const weightData = measurements.map(m => ({
    date: new Date(m.measured_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    peso: Number(m.weight),
  }));

  // Weekly sessions count
  const weeklyData: { week: string; treinos: number }[] = [];
  const weekMap = new Map<string, number>();
  sessions.forEach(s => {
    const d = new Date(s.started_at);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    weekMap.set(key, (weekMap.get(key) || 0) + 1);
  });
  weekMap.forEach((v, k) => weeklyData.push({ week: k, treinos: v }));

  const chartStyle = {
    stroke: "hsl(85 80% 50%)",
    fill: "hsl(85 80% 50%)",
  };

  return (
    <div className="min-h-screen pb-8">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="font-display font-bold">Evolução</h2>
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="container mt-6 space-y-6">
        {/* Add measurement form */}
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
            <h3 className="font-display font-bold flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" /> Nova Medida
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Peso (kg)</Label>
                <Input type="number" value={newWeight} onChange={e => setNewWeight(e.target.value)} className="bg-secondary" placeholder="75" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Gordura % (opc.)</Label>
                <Input type="number" value={newBodyFat} onChange={e => setNewBodyFat(e.target.value)} className="bg-secondary" placeholder="15" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" className="gradient-primary text-primary-foreground" onClick={saveMeasurement}>Salvar</Button>
            </div>
          </motion.div>
        )}

        {/* Weight chart */}
        {weightData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
            <h3 className="font-display font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Peso Corporal
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(220 10% 55%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(220 10% 55%)" }} domain={["dataMin - 2", "dataMax + 2"]} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 15% 18%)", borderRadius: "8px", color: "hsl(0 0% 95%)" }} />
                <Line type="monotone" dataKey="peso" stroke={chartStyle.stroke} strokeWidth={2} dot={{ fill: chartStyle.fill, r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Weekly sessions chart */}
        {weeklyData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5">
            <h3 className="font-display font-bold mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" /> Frequência Semanal
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 18%)" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(220 10% 55%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(220 10% 55%)" }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 15% 18%)", borderRadius: "8px", color: "hsl(0 0% 95%)" }} />
                <Bar dataKey="treinos" fill={chartStyle.fill} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Empty state */}
        {weightData.length === 0 && weeklyData.length === 0 && (
          <div className="glass-card p-8 text-center">
            <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Ainda não há dados de evolução.</p>
            <p className="text-sm text-muted-foreground mt-1">Registre seus treinos e medidas para ver gráficos aqui.</p>
          </div>
        )}

        {/* Recent exercise logs */}
        {exerciseLogs.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5">
            <h3 className="font-display font-bold mb-3">Últimos Registros</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {exerciseLogs.slice(-10).reverse().map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-sm py-2 border-b border-border/30 last:border-0">
                  <span>{(log.exercises as any)?.name || "Exercício"}</span>
                  <span className="text-muted-foreground">
                    {log.weight_used}kg × {log.reps_done} reps
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ProgressCharts;
