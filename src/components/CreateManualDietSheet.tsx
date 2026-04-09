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

interface MealInput {
  meal_name: string;
  foods: string;
  calories: string;
  protein_grams: string;
  carbs_grams: string;
  fat_grams: string;
  notes: string;
}

const emptyMeal = (): MealInput => ({ meal_name: "", foods: "", calories: "", protein_grams: "", carbs_grams: "", fat_grams: "", notes: "" });

const CreateManualDietSheet = ({ open, onOpenChange, onCreated }: Props) => {
  const { user } = useAuth();
  const [planName, setPlanName] = useState("Minha Dieta");
  const [description, setDescription] = useState("");
  const [meals, setMeals] = useState<MealInput[]>([emptyMeal()]);
  const [saving, setSaving] = useState(false);

  const addMeal = () => setMeals(prev => [...prev, emptyMeal()]);
  const removeMeal = (i: number) => setMeals(prev => prev.filter((_, j) => j !== i));
  const updateMeal = (i: number, field: string, value: string) => {
    setMeals(prev => prev.map((m, j) => j === i ? { ...m, [field]: value } : m));
  };

  const handleSave = async () => {
    if (!user || !planName.trim()) { toast.error("Nome da dieta obrigatório"); return; }
    const validMeals = meals.filter(m => m.meal_name.trim() && m.foods.trim());
    if (validMeals.length === 0) { toast.error("Adicione pelo menos uma refeição"); return; }

    setSaving(true);
    try {
      // Deactivate current
      await supabase.from("diet_plans").update({ is_active: false }).eq("user_id", user.id).eq("is_active", true);

      const totalCals = validMeals.reduce((s, m) => s + (parseInt(m.calories) || 0), 0);
      const totalP = validMeals.reduce((s, m) => s + (parseInt(m.protein_grams) || 0), 0);
      const totalC = validMeals.reduce((s, m) => s + (parseInt(m.carbs_grams) || 0), 0);
      const totalF = validMeals.reduce((s, m) => s + (parseInt(m.fat_grams) || 0), 0);

      const { data: plan, error: planError } = await supabase
        .from("diet_plans")
        .insert({
          user_id: user.id,
          name: planName.trim(),
          description: description.trim() || null,
          total_calories: totalCals || null,
          protein_grams: totalP || null,
          carbs_grams: totalC || null,
          fat_grams: totalF || null,
        })
        .select("id")
        .single();
      if (planError) throw planError;

      const mealRows = validMeals.map((m, i) => ({
        diet_plan_id: plan.id,
        user_id: user.id,
        meal_name: m.meal_name.trim(),
        foods: m.foods.trim(),
        meal_order: i + 1,
        calories: parseInt(m.calories) || null,
        protein_grams: parseInt(m.protein_grams) || null,
        carbs_grams: parseInt(m.carbs_grams) || null,
        fat_grams: parseInt(m.fat_grams) || null,
        notes: m.notes.trim() || null,
      }));
      const { error: mealError } = await supabase.from("diet_meals").insert(mealRows);
      if (mealError) throw mealError;

      toast.success("Dieta criada com sucesso!");
      onCreated();
      onOpenChange(false);
      setPlanName("Minha Dieta");
      setDescription("");
      setMeals([emptyMeal()]);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar dieta");
    }
    setSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Criar Dieta Manual</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4 pb-4">
          <div className="space-y-2">
            <Label>Nome da dieta</Label>
            <Input value={planName} onChange={e => setPlanName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {meals.map((meal, i) => (
            <div key={i} className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Refeição {i + 1}</span>
                {meals.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeMeal(i)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
              <Input value={meal.meal_name} onChange={e => updateMeal(i, "meal_name", e.target.value)} placeholder="Ex: Café da manhã" />
              <Textarea value={meal.foods} onChange={e => updateMeal(i, "foods", e.target.value)} placeholder="Alimentos..." rows={3} />
              <div className="grid grid-cols-4 gap-2">
                <Input type="number" value={meal.calories} onChange={e => updateMeal(i, "calories", e.target.value)} placeholder="kcal" className="text-sm" />
                <Input type="number" value={meal.protein_grams} onChange={e => updateMeal(i, "protein_grams", e.target.value)} placeholder="P (g)" className="text-sm" />
                <Input type="number" value={meal.carbs_grams} onChange={e => updateMeal(i, "carbs_grams", e.target.value)} placeholder="C (g)" className="text-sm" />
                <Input type="number" value={meal.fat_grams} onChange={e => updateMeal(i, "fat_grams", e.target.value)} placeholder="G (g)" className="text-sm" />
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addMeal} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> Adicionar Refeição
          </Button>

          <Button onClick={handleSave} disabled={saving} className="w-full gradient-primary text-primary-foreground">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Dieta
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CreateManualDietSheet;
