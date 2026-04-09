import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Sparkles, Loader2, UserCircle, Plus, Trash2, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const MarketplaceGeneratePlan = () => {
  const navigate = useNavigate();
  const { purchaseId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const planType = searchParams.get("type") === "diet" ? "diet" : "workout";
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [purchase, setPurchase] = useState<any>(null);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [buyerAnamnesis, setBuyerAnamnesis] = useState<any>(null);

  // Mode: "new" or an existing delivery/plan ID
  const [mode, setMode] = useState("new");
  const [previousDeliveries, setPreviousDeliveries] = useState<any[]>([]);
  const [prompt, setPrompt] = useState("");

  // Generated result state
  const [showResult, setShowResult] = useState(false);

  // Workout editor state
  const [workoutName, setWorkoutName] = useState("");
  const [workoutDays, setWorkoutDays] = useState<WorkoutDayData[]>([emptyDay()]);

  // Diet editor state
  const [dietName, setDietName] = useState("");
  const [meals, setMeals] = useState<MealData[]>([emptyMeal()]);

  useEffect(() => {
    const load = async () => {
      if (!user || !purchaseId) return;

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

      const [{ data: profile }, { data: anam }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", purch.buyer_id).maybeSingle(),
        supabase.from("anamnesis").select("*").eq("user_id", purch.buyer_id).maybeSingle(),
      ]);

      // Load previous deliveries for this buyer
      const { data: prevDeliveries } = await supabase
        .from("service_deliveries")
        .select("*")
        .eq("seller_id", user.id)
        .eq("buyer_id", purch.buyer_id)
        .eq("delivery_type", planType === "workout" ? "workout" : "diet")
        .order("created_at", { ascending: false });

      // Load linked plans for each delivery
      const deliveriesWithPlans: any[] = [];
      for (const del of prevDeliveries || []) {
        if (planType === "diet" && del.linked_diet_id) {
          const { data: diet } = await supabase
            .from("diet_plans")
            .select("*")
            .eq("id", del.linked_diet_id)
            .maybeSingle();
          if (diet) deliveriesWithPlans.push({ delivery: del, plan: diet });
        } else if (planType === "workout" && del.linked_program_id) {
          const { data: prog } = await supabase
            .from("training_programs")
            .select("*")
            .eq("id", del.linked_program_id)
            .maybeSingle();
          if (prog) deliveriesWithPlans.push({ delivery: del, plan: prog });
        }
      }

      setPurchase(purch);
      setBuyerProfile(profile);
      setBuyerAnamnesis(anam);
      setPreviousDeliveries(deliveriesWithPlans);
      setLoading(false);
    };

    load();
  }, [user, purchaseId]);

  const handleModeChange = async (value: string) => {
    setMode(value);
    if (value === "new") return;

    // Load the selected previous plan as current_summary context
    const prev = previousDeliveries.find(p => p.plan.id === value);
    if (!prev) return;

    const plan = prev.plan;
    if (planType === "diet") {
      // Build summary from the plan
      const summary = `Plano: ${plan.name}\nCalorias: ${plan.total_calories || "N/A"}\nProteínas: ${plan.protein_grams || "N/A"}g\nCarboidratos: ${plan.carbs_grams || "N/A"}g\nGorduras: ${plan.fat_grams || "N/A"}g\n${plan.description || ""}`;
      setPrompt(prev => prev || "Ajuste a dieta anterior conforme necessário.");
    } else {
      setPrompt(prev => prev || "Ajuste o treino anterior conforme necessário.");
    }
  };

  const handleGenerate = async () => {
    if (!purchaseId) return;
    setGenerating(true);

    try {
      // Build current_summary from selected previous plan
      let currentSummary = "";
      if (mode !== "new") {
        const prev = previousDeliveries.find(p => p.plan.id === mode);
        if (prev) {
          const plan = prev.plan;
          if (planType === "diet") {
            // Load meals for summary
            const { data: prevMeals } = await supabase
              .from("diet_meals")
              .select("*")
              .eq("diet_plan_id", plan.id)
              .order("meal_order");
            currentSummary = `Plano: ${plan.name}\nCalorias: ${plan.total_calories || "N/A"}\nProteínas: ${plan.protein_grams || "N/A"}g\n`;
            currentSummary += (prevMeals || []).map(m => `- ${m.meal_name}: ${m.foods} (${m.calories}kcal)`).join("\n");
          } else {
            const { data: days } = await supabase
              .from("workout_days")
              .select("*, exercises(*)")
              .eq("program_id", plan.id)
              .order("day_order");
            currentSummary = `Programa: ${plan.name}\n`;
            currentSummary += (days || []).map((d: any) =>
              `${d.name}: ${(d.exercises || []).map((e: any) => `${e.name} ${e.sets}x${e.reps}`).join(", ")}`
            ).join("\n");
          }
        }
      }

      const { data, error } = await supabase.functions.invoke("marketplace-generate-plan", {
        body: {
          purchase_id: purchaseId,
          plan_type: planType,
          mode: mode === "new" ? "new" : "edit",
          prompt,
          current_summary: currentSummary,
          return_only: true, // Don't save, just return
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const parsed = data.generated;

      // Populate editor with AI result
      if (planType === "workout") {
        setWorkoutName(parsed.program_name || "Treino gerado");
        setWorkoutDays((parsed.workout_days || []).map((d: any) => ({
          name: d.name || "",
          muscle_groups: d.muscle_groups || "",
          exercises: (d.exercises || []).map((e: any) => ({
            name: e.name || "",
            sets: e.sets || 3,
            reps: e.reps || "12",
            rest_seconds: e.rest_seconds || 60,
            notes: e.notes || "",
          })),
        })));
      } else {
        setDietName(parsed.plan_name || "Dieta gerada");
        setMeals((parsed.meals || []).map((m: any) => ({
          meal_name: m.meal_name || "",
          foodItems: (m.foods || "").split("\n").filter(Boolean).map((line: string) => {
            const match = line.match(/^(.+?)\s*-\s*(\d+)g$/);
            return {
              food_id: "",
              name: match ? match[1].trim() : line.trim(),
              source: "usda",
              portion_grams: match ? parseInt(match[2]) : 100,
              calories_per_100g: m.calories ? Math.round((m.calories / (m.foods?.split("\n").length || 1)) / 1) : 0,
              protein_per_100g: 0,
              carbs_per_100g: 0,
              fat_per_100g: 0,
            } as FoodItem;
          }),
          notes: m.notes || "",
        })));
      }

      setShowResult(true);
      toast({ title: "Plano gerado! Revise e ajuste antes de enviar." });
    } catch (err: any) {
      toast({ title: "Erro ao gerar", description: err.message, variant: "destructive" });
    }

    setGenerating(false);
  };

  // Editor helpers
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

  const handleApproveAndSend = async () => {
    if (!user || !purchase) return;
    const isWorkout = planType === "workout";

    if (isWorkout && !workoutName.trim()) {
      toast({ title: "Dê um nome ao treino", variant: "destructive" });
      return;
    }
    if (!isWorkout && !dietName.trim()) {
      toast({ title: "Dê um nome à dieta", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const body: any = {
        purchase_id: purchase.id,
        selected_materials: [],
        notes: null,
      };

      if (isWorkout) {
        body.workout_data = {
          name: workoutName,
          days: workoutDays.filter(d => d.name.trim() || d.exercises.some(e => e.name.trim())),
        };
      } else {
        body.diet_data = {
          name: dietName,
          meals: meals.filter(m => m.meal_name.trim()).map(m => {
            const macros = calcMealMacros(m.foodItems);
            const foodsText = m.foodItems.map(f => `${f.name} - ${f.portion_grams}g`).join("\n");
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
    setSending(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-display font-semibold text-foreground">
          Gerar {planType === "workout" ? "Treino" : "Dieta"} para cliente
        </h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Client info */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <UserCircle className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-foreground">
              Cliente: {buyerProfile?.full_name || buyerProfile?.username || "Comprador"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Geração com base na anamnese do cliente.
          </p>
        </div>

        {!buyerAnamnesis && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Este comprador não possui anamnese preenchida. Não é possível gerar com IA sem dados do cliente.
          </div>
        )}

        {!showResult ? (
          <>
            {/* Mode select: Novo or existing deliveries */}
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Base</Label>
              <Select value={mode} onValueChange={handleModeChange}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Novo do zero</SelectItem>
                  {previousDeliveries.map(pd => (
                    <SelectItem key={pd.plan.id} value={pd.plan.id}>
                      {pd.plan.name} — {new Date(pd.delivery.created_at).toLocaleDateString("pt-BR")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Instructions */}
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Instruções</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`Ex: ${planType === "workout" ? "focar em lombar e evitar impacto" : "1800 kcal com refeições rápidas"}`}
                className="bg-secondary/50 min-h-[120px]"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating || !buyerAnamnesis}
              className="w-full gradient-primary text-primary-foreground"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {generating ? "Gerando..." : "Gerar com IA"}
            </Button>
          </>
        ) : (
          <>
            {/* Result editor */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm text-primary font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Plano gerado pela IA — revise e ajuste antes de enviar
              </p>
            </div>

            {planType === "workout" ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground mb-1 block">Nome do programa</Label>
                  <Input
                    value={workoutName}
                    onChange={e => setWorkoutName(e.target.value)}
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
                      <Input value={day.name} onChange={e => updateDay(dayIdx, "name", e.target.value)} placeholder="Nome do dia" className="bg-secondary/50 text-sm" />
                      <Input value={day.muscle_groups} onChange={e => updateDay(dayIdx, "muscle_groups", e.target.value)} placeholder="Grupos musculares" className="bg-secondary/50 text-sm" />
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
                        <Input value={ex.name} onChange={e => updateExercise(dayIdx, exIdx, "name", e.target.value)} placeholder="Nome do exercício" className="bg-secondary/50 text-sm" />
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground">Séries</label>
                            <Input type="number" value={ex.sets} onChange={e => updateExercise(dayIdx, exIdx, "sets", parseInt(e.target.value) || 0)} className="bg-secondary/50 text-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Reps</label>
                            <Input value={ex.reps} onChange={e => updateExercise(dayIdx, exIdx, "reps", e.target.value)} className="bg-secondary/50 text-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Descanso (s)</label>
                            <Input type="number" value={ex.rest_seconds} onChange={e => updateExercise(dayIdx, exIdx, "rest_seconds", parseInt(e.target.value) || 0)} className="bg-secondary/50 text-sm" />
                          </div>
                        </div>
                        <Input value={ex.notes} onChange={e => updateExercise(dayIdx, exIdx, "notes", e.target.value)} placeholder="Observações" className="bg-secondary/50 text-sm" />
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
                  <Input value={dietName} onChange={e => setDietName(e.target.value)} className="bg-secondary/50" />
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
                      placeholder="Nome da refeição"
                      className="bg-secondary/50 text-sm"
                    />

                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">Alimentos</label>
                      <FoodSearch
                        foods={meal.foodItems}
                        onFoodsChange={(newFoods) => updateMeal(idx, "foodItems", newFoods)}
                      />
                    </div>

                    {meal.foodItems.length > 0 && (
                      <div className="flex gap-3 text-[10px] text-muted-foreground">
                        {(() => {
                          const m = calcMealMacros(meal.foodItems);
                          return (
                            <>
                              <span>{m.cal} kcal</span>
                              <span>P: {m.prot}g</span>
                              <span>C: {m.carbs}g</span>
                              <span>G: {m.fat}g</span>
                            </>
                          );
                        })()}
                      </div>
                    )}

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

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowResult(false)}
              >
                Gerar novamente
              </Button>
              <Button
                onClick={handleApproveAndSend}
                disabled={sending}
                className="flex-1 gradient-primary text-primary-foreground"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Aprovar e enviar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MarketplaceGeneratePlan;
