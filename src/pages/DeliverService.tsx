import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, FileText, Dumbbell, UtensilsCrossed, Check, Sparkles, Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import FoodSearch, { type FoodItem } from "@/components/FoodSearch";

interface ExerciseData {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string;
}

interface WorkoutDayData {
  name: string;
  muscle_groups: string;
  exercises: ExerciseData[];
}

interface MealData {
  meal_name: string;
  foodItems: FoodItem[];
  notes: string;
}

const emptyExercise = (): ExerciseData => ({ name: "", sets: 3, reps: "12", rest_seconds: 60, notes: "" });
const emptyDay = (): WorkoutDayData => ({ name: "", muscle_groups: "", exercises: [emptyExercise()] });
const emptyMeal = (): MealData => ({ meal_name: "", foodItems: [], notes: "" });

const calcMealMacros = (items: FoodItem[]) => items.reduce(
  (acc, f) => ({
    cal: acc.cal + Math.round((f.calories_per_100g * f.portion_grams) / 100),
    prot: acc.prot + Math.round((f.protein_per_100g * f.portion_grams) / 100),
    carbs: acc.carbs + Math.round((f.carbs_per_100g * f.portion_grams) / 100),
    fat: acc.fat + Math.round((f.fat_per_100g * f.portion_grams) / 100),
  }),
  { cal: 0, prot: 0, carbs: 0, fat: 0 }
);

const DeliverService = () => {
  const { purchaseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [purchase, setPurchase] = useState<any>(null);
  const [service, setService] = useState<any>(null);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [delivering, setDelivering] = useState(false);
  const [notes, setNotes] = useState("");

  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const [workoutName, setWorkoutName] = useState("");
  const [workoutDays, setWorkoutDays] = useState<WorkoutDayData[]>([emptyDay()]);

  const [dietName, setDietName] = useState("");
  const [meals, setMeals] = useState<MealData[]>([emptyMeal()]);

  const [allMaterials, setAllMaterials] = useState<any[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [materialsSheetOpen, setMaterialsSheetOpen] = useState(false);
  const [materialSearch, setMaterialSearch] = useState("");

  const [buyerAnamnesis, setBuyerAnamnesis] = useState<any>(null);

  const load = useCallback(async () => {
    if (!user || !purchaseId) return;
    setLoading(true);

    const { data: purch } = await supabase
      .from("service_purchases")
      .select("*")
      .eq("id", purchaseId)
      .eq("seller_id", user.id)
      .single();

    if (!purch) {
      toast({ title: "Pedido não encontrado", variant: "destructive" });
      navigate("/seller-dashboard");
      return;
    }
    setPurchase(purch);

    const [
      { data: svc },
      { data: buyer },
      { data: buyerAnam },
      { data: tmpl },
      { data: mats },
    ] = await Promise.all([
      supabase.from("marketplace_services").select("*").eq("id", purch.service_id).single(),
      supabase.from("profiles").select("*").eq("user_id", purch.buyer_id).single(),
      supabase.from("anamnesis").select("*").eq("user_id", purch.buyer_id).maybeSingle(),
      supabase.from("seller_templates").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("seller_materials").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    setService(svc);
    setBuyerProfile(buyer);
    setBuyerAnamnesis(buyerAnam);
    setAllMaterials(mats || []);

    const category = svc?.category === "workout" ? "workout" : "diet";
    setTemplates((tmpl || []).filter(t => t.template_type === category));

    // Pre-fill form with last delivery content when adjusting
    if (purch.status === "adjustment") {
      const { data: lastDelivery } = await supabase
        .from("service_deliveries")
        .select("*")
        .eq("purchase_id", purch.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastDelivery) {
        if (lastDelivery.linked_program_id && category === "workout") {
          const { data: prog } = await supabase
            .from("training_programs")
            .select("*")
            .eq("id", lastDelivery.linked_program_id)
            .single();
          if (prog) {
            setWorkoutName(prog.name || "");
            const { data: days } = await supabase
              .from("workout_days")
              .select("*, exercises(*)")
              .eq("program_id", prog.id)
              .order("day_order");
            if (days && days.length > 0) {
              setWorkoutDays(days.map((d: any) => ({
                name: d.name || "",
                muscle_groups: d.muscle_groups || "",
                exercises: (d.exercises || [])
                  .sort((a: any, b: any) => (a.exercise_order || 0) - (b.exercise_order || 0))
                  .map((e: any) => ({
                    name: e.name || "",
                    sets: e.sets || 3,
                    reps: e.reps || "12",
                    rest_seconds: e.rest_seconds || 60,
                    notes: e.notes || "",
                  })),
              })));
            }
          }
        }

        if (lastDelivery.linked_diet_id && category === "diet") {
          const { data: diet } = await supabase
            .from("diet_plans")
            .select("*")
            .eq("id", lastDelivery.linked_diet_id)
            .single();
          if (diet) {
            setDietName(diet.name || "");
            const { data: dietMeals } = await supabase
              .from("diet_meals")
              .select("*")
              .eq("diet_plan_id", diet.id)
              .order("meal_order");
            if (dietMeals && dietMeals.length > 0) {
              setMeals(dietMeals.map((m: any) => {
                // Parse foods text back into foodItems structure
                const foodLines = (m.foods || "").split("\n").filter((l: string) => l.trim());
                const foodItems: FoodItem[] = foodLines.map((line: string) => {
                  const match = line.match(/^(.+?)\s*[-–]\s*(\d+)g?$/);
                  return {
                    food_id: "",
                    name: match ? match[1].trim() : line.trim(),
                    source: "manual" as const,
                    portion_grams: match ? parseInt(match[2]) : 100,
                    calories_per_100g: m.calories ? Math.round((m.calories / (m.meal_order || 1)) * 100 / 100) : 0,
                    protein_per_100g: 0,
                    carbs_per_100g: 0,
                    fat_per_100g: 0,
                  };
                });
                return {
                  meal_name: m.meal_name || "",
                  foodItems: foodItems.length > 0 ? foodItems : [],
                  notes: m.notes || "",
                };
              }));
            }
          }
        }

        if (lastDelivery.notes) {
          setNotes(lastDelivery.notes);
        }
      }
    }

    setLoading(false);
  }, [user, purchaseId]);

  useEffect(() => { load(); }, [load]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const data = template.template_data as any || {};
    const isWorkout = service?.category === "workout";

    if (isWorkout) {
      setWorkoutName(template.title || "");
      if (data.days && data.days.length > 0) {
        setWorkoutDays(data.days.map((d: any) => ({
          name: d.name || "",
          muscle_groups: d.muscle_groups || "",
          exercises: (d.exercises || []).length > 0
            ? d.exercises.map((e: any) => ({
                name: e.name || "",
                sets: e.sets || 3,
                reps: e.reps || "12",
                rest_seconds: e.rest_seconds || 60,
                notes: e.notes || "",
              }))
            : [emptyExercise()],
        })));
      }
    } else {
      setDietName(template.title || "");
      if (data.meals && data.meals.length > 0) {
        setMeals(data.meals.map((m: any) => ({
          meal_name: m.meal_name || "",
          foodItems: (m.foodItems || []).map((f: any) => ({
            food_id: f.food_id || f.taco_id || "",
            name: f.name || "",
            source: f.source || "tbca",
            portion_grams: f.portion_grams || 100,
            calories_per_100g: f.calories_per_100g || 0,
            protein_per_100g: f.protein_per_100g || 0,
            carbs_per_100g: f.carbs_per_100g || 0,
            fat_per_100g: f.fat_per_100g || 0,
          })),
          notes: m.notes || "",
        })));
      }
    }
  };

  const updateDay = (idx: number, field: keyof WorkoutDayData, value: any) => {
    setWorkoutDays(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };
  const addDay = () => setWorkoutDays(prev => [...prev, emptyDay()]);
  const removeDay = (idx: number) => setWorkoutDays(prev => prev.filter((_, i) => i !== idx));

  const updateExercise = (dayIdx: number, exIdx: number, field: keyof ExerciseData, value: any) => {
    setWorkoutDays(prev => prev.map((d, di) =>
      di === dayIdx
        ? { ...d, exercises: d.exercises.map((e, ei) => ei === exIdx ? { ...e, [field]: value } : e) }
        : d
    ));
  };
  const addExercise = (dayIdx: number) => {
    setWorkoutDays(prev => prev.map((d, i) =>
      i === dayIdx ? { ...d, exercises: [...d.exercises, emptyExercise()] } : d
    ));
  };
  const removeExercise = (dayIdx: number, exIdx: number) => {
    setWorkoutDays(prev => prev.map((d, i) =>
      i === dayIdx ? { ...d, exercises: d.exercises.filter((_, ei) => ei !== exIdx) } : d
    ));
  };

  const updateMeal = (idx: number, field: keyof MealData, value: any) => {
    setMeals(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };
  const addMeal = () => setMeals(prev => [...prev, emptyMeal()]);
  const removeMeal = (idx: number) => setMeals(prev => prev.filter((_, i) => i !== idx));

  const toggleMaterial = (id: string) => {
    setSelectedMaterials(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filteredMaterials = allMaterials.filter(m =>
    !materialSearch || m.title.toLowerCase().includes(materialSearch.toLowerCase())
  );

  const handleDeliver = async () => {
    if (!user || !purchase || !service) return;

    const isWorkout = service.category === "workout";

    if (isWorkout) {
      if (!workoutName.trim()) {
        toast({ title: "Dê um nome ao treino", variant: "destructive" });
        return;
      }
      const hasExercises = workoutDays.some(d => d.exercises.some(e => e.name.trim()));
      if (!hasExercises) {
        toast({ title: "Adicione pelo menos um exercício", variant: "destructive" });
        return;
      }
    } else {
      if (!dietName.trim()) {
        toast({ title: "Dê um nome à dieta", variant: "destructive" });
        return;
      }
      const hasMeals = meals.some(m => m.meal_name.trim() && m.foodItems.length > 0);
      if (!hasMeals) {
        toast({ title: "Adicione pelo menos uma refeição com alimentos", variant: "destructive" });
        return;
      }
    }

    setDelivering(true);

    try {
      const body: any = {
        purchase_id: purchase.id,
        selected_materials: selectedMaterials,
        notes: notes.trim() || null,
      };

      if (isWorkout) {
        body.workout_data = {
          name: workoutName,
          days: workoutDays.filter(d => d.name.trim() || d.exercises.some(e => e.name.trim())),
        };
      } else {
        // Convert foodItems to text and calculate macros
        body.diet_data = {
          name: dietName,
          meals: meals.filter(m => m.meal_name.trim()).map(m => {
            const macros = calcMealMacros(m.foodItems);
            const foodsText = m.foodItems
              .map(f => `${f.name} - ${f.portion_grams}g`)
              .join("\n");
            return {
              meal_name: m.meal_name,
              foods: foodsText,
              calories: macros.cal,
              protein_grams: macros.prot,
              carbs_grams: macros.carbs,
              fat_grams: macros.fat,
              notes: m.notes || null,
            };
          }),
        };
      }

      const { data, error } = await supabase.functions.invoke("deliver-service", { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Serviço entregue com sucesso! 🎉" });
      navigate("/seller-dashboard");
    } catch (err: any) {
      toast({ title: "Erro ao entregar", description: err.message, variant: "destructive" });
    }

    setDelivering(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isWorkout = service?.category === "workout";

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(`/seller-order/${purchaseId}`)} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-display font-semibold text-foreground">Preparar Serviço</h1>
      </div>

      <div className="px-4 pt-4 space-y-6">
        {/* Purchase info */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              {isWorkout ? <Dumbbell className="h-5 w-5 text-primary" /> : <UtensilsCrossed className="h-5 w-5 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-semibold text-foreground truncate">{service?.title}</h3>
              <p className="text-xs text-muted-foreground">
                Para: {buyerProfile?.full_name || "Comprador"} • Pedido #{purchase?.id.slice(0, 8)}
              </p>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              {isWorkout ? "Treino" : "Dieta"}
            </Badge>
          </div>
        </div>

        {/* Adjustment message */}
        {purchase?.adjustment_message && (
          <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
            <p className="text-xs text-warning font-medium mb-0.5">Solicitação de ajuste do comprador:</p>
            <p className="text-sm text-muted-foreground">{purchase.adjustment_message}</p>
          </div>
        )}

        {/* Template selection (optional) */}
        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">
            Carregar da biblioteca (opcional)
          </Label>
          <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
            <SelectTrigger className="bg-secondary/50">
              <SelectValue placeholder="Escolher template da biblioteca..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {templates.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Nenhum template de {isWorkout ? "treino" : "dieta"} na biblioteca.{" "}
              <button onClick={() => navigate("/seller-templates")} className="text-primary underline">
                Criar template
              </button>
            </p>
          )}
        </div>

        {/* AI generation */}
        <div className="glass-card p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Gere usando a anamnese do cliente.
          </p>
          <Button
            variant="outline"
            className="w-full"
            disabled={!buyerAnamnesis}
            onClick={() => navigate(`/marketplace-generate/${purchase?.id}?type=${isWorkout ? "workout" : "diet"}`)}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Gerar com IA para este cliente
          </Button>
          {!buyerAnamnesis && (
            <p className="text-xs text-destructive">O comprador ainda não possui anamnese preenchida.</p>
          )}
        </div>

        {/* Content editor */}
        {isWorkout ? (
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Nome do programa</Label>
              <Input
                value={workoutName}
                onChange={e => setWorkoutName(e.target.value)}
                placeholder="Ex: Treino Push Pull Legs"
                className="bg-secondary/50"
              />
            </div>

            {workoutDays.map((day, dayIdx) => (
              <div key={dayIdx} className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dia {dayIdx + 1}</p>
                  {workoutDays.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeDay(dayIdx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={day.name}
                    onChange={e => updateDay(dayIdx, "name", e.target.value)}
                    placeholder="Nome do dia"
                    className="bg-secondary/50 text-sm"
                  />
                  <Input
                    value={day.muscle_groups}
                    onChange={e => updateDay(dayIdx, "muscle_groups", e.target.value)}
                    placeholder="Grupos musculares"
                    className="bg-secondary/50 text-sm"
                  />
                </div>

                {day.exercises.map((ex, exIdx) => (
                  <div key={exIdx} className="border border-border/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground">Exercício {exIdx + 1}</p>
                      {day.exercises.length > 1 && (
                        <button onClick={() => removeExercise(dayIdx, exIdx)} className="text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <Input
                      value={ex.name}
                      onChange={e => updateExercise(dayIdx, exIdx, "name", e.target.value)}
                      placeholder="Nome do exercício"
                      className="bg-secondary/50 text-sm"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Séries</label>
                        <Input
                          type="number"
                          value={ex.sets}
                          onChange={e => updateExercise(dayIdx, exIdx, "sets", parseInt(e.target.value) || 0)}
                          className="bg-secondary/50 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Reps</label>
                        <Input
                          value={ex.reps}
                          onChange={e => updateExercise(dayIdx, exIdx, "reps", e.target.value)}
                          className="bg-secondary/50 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Descanso (s)</label>
                        <Input
                          type="number"
                          value={ex.rest_seconds}
                          onChange={e => updateExercise(dayIdx, exIdx, "rest_seconds", parseInt(e.target.value) || 0)}
                          className="bg-secondary/50 text-sm"
                        />
                      </div>
                    </div>
                    <Input
                      value={ex.notes}
                      onChange={e => updateExercise(dayIdx, exIdx, "notes", e.target.value)}
                      placeholder="Observações do exercício"
                      className="bg-secondary/50 text-sm"
                    />
                  </div>
                ))}

                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => addExercise(dayIdx)}>
                  <Plus className="h-3 w-3 mr-1" /> Exercício
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" className="w-full" onClick={addDay}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar dia
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Nome do plano</Label>
              <Input
                value={dietName}
                onChange={e => setDietName(e.target.value)}
                placeholder="Ex: Plano Hipercalórico 3000kcal"
                className="bg-secondary/50"
              />
            </div>

            {meals.map((meal, idx) => (
              <div key={idx} className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Refeição {idx + 1}</p>
                  {meals.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeMeal(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Input
                  value={meal.meal_name}
                  onChange={e => updateMeal(idx, "meal_name", e.target.value)}
                  placeholder="Nome da refeição (ex: Café da manhã)"
                  className="bg-secondary/50 text-sm"
                />

                {/* TACO Food Search */}
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Alimentos</label>
                  <FoodSearch
                    foods={meal.foodItems}
                    onFoodsChange={(newFoods) => updateMeal(idx, "foodItems", newFoods)}
                  />
                </div>

                <Input
                  value={meal.notes}
                  onChange={e => updateMeal(idx, "notes", e.target.value)}
                  placeholder="Observações"
                  className="bg-secondary/50 text-sm"
                />
              </div>
            ))}

            <Button variant="outline" size="sm" className="w-full" onClick={addMeal}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar refeição
            </Button>
          </div>
        )}

        {/* Materials */}
        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">
            Materiais de apoio ({selectedMaterials.length} selecionados)
          </Label>

          {selectedMaterials.length > 0 && (
            <div className="space-y-2 mb-3">
              {selectedMaterials.map(id => {
                const mat = allMaterials.find(m => m.id === id);
                return mat ? (
                  <div key={id} className="flex items-center gap-2 glass-card p-2">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground truncate flex-1">{mat.title}</span>
                    <button onClick={() => toggleMaterial(id)} className="text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : null;
              })}
            </div>
          )}

          <Button variant="outline" size="sm" className="w-full" onClick={() => setMaterialsSheetOpen(true)}>
            <Search className="h-4 w-4 mr-1" /> Buscar na biblioteca
          </Button>
        </div>

        {/* Notes */}
        <div>
          <Label className="text-sm text-muted-foreground mb-1 block">Observações para o comprador</Label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Treino focado em hipertrofia, siga as orientações de descanso..."
            className="bg-secondary/50 min-h-[100px]"
            maxLength={1000}
          />
        </div>

        <Button
          onClick={handleDeliver}
          disabled={delivering}
          className="w-full gradient-primary text-primary-foreground font-semibold py-6"
        >
          {delivering ? (
            <div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Entregar para {buyerProfile?.full_name || "Comprador"}
            </>
          )}
        </Button>
      </div>

      {/* Materials search sheet */}
      <Sheet open={materialsSheetOpen} onOpenChange={setMaterialsSheetOpen}>
        <SheetContent side="bottom" className="bg-card rounded-t-2xl max-h-[70vh]">
          <SheetHeader>
            <SheetTitle className="text-foreground">Materiais de apoio</SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-3">
            <Input
              value={materialSearch}
              onChange={e => setMaterialSearch(e.target.value)}
              placeholder="Buscar material..."
              className="bg-secondary/50"
            />
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {filteredMaterials.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum material encontrado.{" "}
                  <button onClick={() => { setMaterialsSheetOpen(false); navigate("/seller-materials"); }} className="text-primary underline">
                    Adicionar materiais
                  </button>
                </p>
              ) : (
                filteredMaterials.map(mat => {
                  const isSelected = selectedMaterials.includes(mat.id);
                  return (
                    <button
                      key={mat.id}
                      onClick={() => toggleMaterial(mat.id)}
                      className={`w-full glass-card p-3 flex items-center gap-3 text-left transition-colors ${
                        isSelected ? "border-primary/50 bg-primary/5" : ""
                      }`}
                    >
                      <FileText className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-sm text-foreground truncate flex-1">{mat.title}</span>
                      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default DeliverService;
