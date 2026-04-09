import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: any;
  onSaved: () => void;
  onDeleted: () => void;
}

const EditExerciseSheet = ({ open, onOpenChange, exercise, onSaved, onDeleted }: Props) => {
  const [name, setName] = useState(exercise?.name || "");
  const [sets, setSets] = useState(String(exercise?.sets || 3));
  const [reps, setReps] = useState(exercise?.reps || "12");
  const [restSeconds, setRestSeconds] = useState(String(exercise?.rest_seconds || 60));
  const [notes, setNotes] = useState(exercise?.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nome do exercício obrigatório"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("exercises")
      .update({
        name: name.trim(),
        sets: parseInt(sets) || 3,
        reps: reps.trim() || "12",
        rest_seconds: parseInt(restSeconds) || 60,
        notes: notes.trim() || null,
      })
      .eq("id", exercise.id);

    if (error) toast.error("Erro ao salvar");
    else { toast.success("Exercício atualizado!"); onSaved(); onOpenChange(false); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Excluir este exercício?")) return;
    setSaving(true);
    await supabase.from("exercise_logs").delete().eq("exercise_id", exercise.id);
    const { error } = await supabase.from("exercises").delete().eq("id", exercise.id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Exercício removido"); onDeleted(); onOpenChange(false); }
    setSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar Exercício</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Séries</Label>
              <Input type="number" value={sets} onChange={e => setSets(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reps</Label>
              <Input value={reps} onChange={e => setReps(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descanso (s)</Label>
              <Input type="number" value={restSeconds} onChange={e => setRestSeconds(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1 gradient-primary text-primary-foreground">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
            <Button variant="outline" onClick={handleDelete} disabled={saving} className="border-destructive text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EditExerciseSheet;
