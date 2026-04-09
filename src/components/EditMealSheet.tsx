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
  meal: any;
  onSaved: () => void;
  onDeleted: () => void;
}

const EditMealSheet = ({ open, onOpenChange, meal, onSaved, onDeleted }: Props) => {
  const [mealName, setMealName] = useState(meal?.meal_name || "");
  const [foods, setFoods] = useState(meal?.foods || "");
  const [calories, setCalories] = useState(String(meal?.calories || ""));
  const [proteinGrams, setProteinGrams] = useState(String(meal?.protein_grams || ""));
  const [carbsGrams, setCarbsGrams] = useState(String(meal?.carbs_grams || ""));
  const [fatGrams, setFatGrams] = useState(String(meal?.fat_grams || ""));
  const [notes, setNotes] = useState(meal?.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!mealName.trim() || !foods.trim()) { toast.error("Nome e alimentos obrigatórios"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("diet_meals")
      .update({
        meal_name: mealName.trim(),
        foods: foods.trim(),
        calories: parseInt(calories) || null,
        protein_grams: parseInt(proteinGrams) || null,
        carbs_grams: parseInt(carbsGrams) || null,
        fat_grams: parseInt(fatGrams) || null,
        notes: notes.trim() || null,
      })
      .eq("id", meal.id);

    if (error) toast.error("Erro ao salvar");
    else { toast.success("Refeição atualizada!"); onSaved(); onOpenChange(false); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Excluir esta refeição?")) return;
    setSaving(true);
    const { error } = await supabase.from("diet_meals").delete().eq("id", meal.id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Refeição removida"); onDeleted(); onOpenChange(false); }
    setSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar Refeição</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Nome da refeição</Label>
            <Input value={mealName} onChange={e => setMealName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Alimentos</Label>
            <Textarea value={foods} onChange={e => setFoods(e.target.value)} rows={4} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Calorias</Label>
              <Input type="number" value={calories} onChange={e => setCalories(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Proteína (g)</Label>
              <Input type="number" value={proteinGrams} onChange={e => setProteinGrams(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Carbos (g)</Label>
              <Input type="number" value={carbsGrams} onChange={e => setCarbsGrams(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Gordura (g)</Label>
              <Input type="number" value={fatGrams} onChange={e => setFatGrams(e.target.value)} />
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

export default EditMealSheet;
