import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface ExerciseInput {
  name: string;
  sets: string;
  reps: string;
  rest_seconds: string;
  notes: string;
}

interface DayInput {
  name: string;
  muscle_groups: string;
  exercises: ExerciseInput[];
}

const emptyExercise = (): ExerciseInput => ({ name: "", sets: "3", reps: "12", rest_seconds: "60", notes: "" });
const emptyDay = (): DayInput => ({ name: "", muscle_groups: "", exercises: [emptyExercise()] });

const CreateManualWorkoutSheet = ({ open, onOpenChange, onCreated }: Props) => {
  const { user } = useAuth();
  const [programName, setProgramName] = useState("Meu Treino");
  const [description, setDescription] = useState("");
  const [days, setDays] = useState<DayInput[]>([emptyDay()]);
  const [saving, setSaving] = useState(false);

  const addDay = () => setDays(prev => [...prev, emptyDay()]);
  const removeDay = (di: number) => setDays(prev => prev.filter((_, i) => i !== di));
  const updateDay = (di: number, field: string, value: string) => {
    setDays(prev => prev.map((d, i) => i === di ? { ...d, [field]: value } : d));
  };

  const addExercise = (di: number) => {
    setDays(prev => prev.map((d, i) => i === di ? { ...d, exercises: [...d.exercises, emptyExercise()] } : d));
  };
  const removeExercise = (di: number, ei: number) => {
    setDays(prev => prev.map((d, i) => i === di ? { ...d, exercises: d.exercises.filter((_, j) => j !== ei) } : d));
  };
  const updateExercise = (di: number, ei: number, field: string, value: string) => {
    setDays(prev => prev.map((d, i) => i === di ? {
      ...d,
      exercises: d.exercises.map((ex, j) => j === ei ? { ...ex, [field]: value } : ex),
    } : d));
  };

  const handleSave = async () => {
    if (!user || !programName.trim()) { toast.error("Nome do programa obrigatório"); return; }
    const validDays = days.filter(d => d.name.trim() && d.exercises.some(e => e.name.trim()));
    if (validDays.length === 0) { toast.error("Adicione pelo menos um dia com exercícios"); return; }

    setSaving(true);
    try {
      // Deactivate current programs
      await supabase.from("training_programs").update({ is_active: false }).eq("user_id", user.id).eq("is_active", true);

      // Create program
      const { data: prog, error: progError } = await supabase
        .from("training_programs")
        .insert({ user_id: user.id, name: programName.trim(), description: description.trim() || null })
        .select("id")
        .single();
      if (progError) throw progError;

      // Create days and exercises
      for (let di = 0; di < validDays.length; di++) {
        const day = validDays[di];
        const { data: dayData, error: dayError } = await supabase
          .from("workout_days")
          .insert({
            program_id: prog.id,
            user_id: user.id,
            name: day.name.trim(),
            muscle_groups: day.muscle_groups.trim() || null,
            day_order: di + 1,
          })
          .select("id")
          .single();
        if (dayError) throw dayError;

        const validExercises = day.exercises.filter(e => e.name.trim());
        if (validExercises.length > 0) {
          const exerciseRows = validExercises.map((ex, ei) => ({
            workout_day_id: dayData.id,
            user_id: user.id,
            name: ex.name.trim(),
            sets: parseInt(ex.sets) || 3,
            reps: ex.reps.trim() || "12",
            rest_seconds: parseInt(ex.rest_seconds) || 60,
            notes: ex.notes.trim() || null,
            exercise_order: ei + 1,
          }));
          const { error: exError } = await supabase.from("exercises").insert(exerciseRows);
          if (exError) throw exError;
        }
      }

      toast.success("Treino criado com sucesso!");
      onCreated();
      onOpenChange(false);
      // Reset
      setProgramName("Meu Treino");
      setDescription("");
      setDays([emptyDay()]);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar treino");
    }
    setSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Criar Treino Manual</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4 pb-4">
          <div className="space-y-2">
            <Label>Nome do programa</Label>
            <Input value={programName} onChange={e => setProgramName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {days.map((day, di) => (
            <div key={di} className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Dia {di + 1}</span>
                {days.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeDay(di)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nome do dia</Label>
                  <Input value={day.name} onChange={e => updateDay(di, "name", e.target.value)} placeholder="Ex: Treino A" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Grupos musculares</Label>
                  <Input value={day.muscle_groups} onChange={e => updateDay(di, "muscle_groups", e.target.value)} placeholder="Ex: Peito e Tríceps" />
                </div>
              </div>

              {day.exercises.map((ex, ei) => (
                <div key={ei} className="bg-secondary/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Exercício {ei + 1}</span>
                    {day.exercises.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeExercise(di, ei)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <Input value={ex.name} onChange={e => updateExercise(di, ei, "name", e.target.value)} placeholder="Nome do exercício" className="text-sm" />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Séries</Label>
                      <Input type="number" value={ex.sets} onChange={e => updateExercise(di, ei, "sets", e.target.value)} className="text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Reps</Label>
                      <Input value={ex.reps} onChange={e => updateExercise(di, ei, "reps", e.target.value)} className="text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Descanso (s)</Label>
                      <Input type="number" value={ex.rest_seconds} onChange={e => updateExercise(di, ei, "rest_seconds", e.target.value)} className="text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Observação</Label>
                    <Input value={ex.notes} onChange={e => updateExercise(di, ei, "notes", e.target.value)} placeholder="Ex: Usar pegada supinada" className="text-sm" />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addExercise(di)} className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1" /> Exercício
              </Button>
            </div>
          ))}

          <Button variant="outline" onClick={addDay} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> Adicionar Dia
          </Button>

          <Button onClick={handleSave} disabled={saving} className="w-full gradient-primary text-primary-foreground">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Treino
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CreateManualWorkoutSheet;
