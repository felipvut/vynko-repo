import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Dumbbell, UtensilsCrossed, Trash2, Save, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
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

const SellerTemplates = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState("workout");
  const [saving, setSaving] = useState(false);

  // Workout editor
  const [workoutDays, setWorkoutDays] = useState<WorkoutDayData[]>([emptyDay()]);

  // Diet editor
  const [meals, setMeals] = useState<MealData[]>([emptyMeal()]);

  // Expanded template view
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // AI generation
  const [aiGoal, setAiGoal] = useState("hipertrofia");
  const [aiLevel, setAiLevel] = useState("intermediário");
  const [aiDays, setAiDays] = useState("4");
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("seller_templates")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Auto-open editor if ?create=workout or ?create=diet
  useEffect(() => {
    const createType = searchParams.get("create");
    if (createType === "workout" || createType === "diet") {
      resetEditor();
      setNewType(createType);
      setEditorOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const resetEditor = () => {
    setEditingId(null);
    setNewTitle("");
    setNewDesc("");
    setNewType("workout");
    setWorkoutDays([emptyDay()]);
    setMeals([emptyMeal()]);
  };

  const openCreate = () => {
    resetEditor();
    setAiGoal("hipertrofia");
    setAiLevel("intermediário");
    setAiDays("4");
    setAiPrompt("");
    setEditorOpen(true);
  };

  const generateWithAI = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-template", {
        body: {
          template_type: newType,
          goal: aiGoal,
          level: aiLevel,
          days_count: parseInt(aiDays) || 4,
          prompt: aiPrompt,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: data.error, variant: "destructive" });
        return;
      }

      // Fill editor with AI-generated data
      if (!newTitle.trim()) setNewTitle(data.title || "");
      if (!newDesc.trim()) setNewDesc(data.description || "");

      if (newType === "workout" && data.template_data?.days) {
        setWorkoutDays(data.template_data.days.map((d: any) => ({
          name: d.name || "",
          muscle_groups: d.muscle_groups || "",
          exercises: (d.exercises || []).map((e: any) => ({
            name: e.name || "",
            sets: e.sets || 3,
            reps: String(e.reps || "12"),
            rest_seconds: e.rest_seconds || 60,
            notes: e.notes || "",
          })),
        })));
      } else if (newType === "diet" && data.template_data?.meals) {
        setMeals(data.template_data.meals.map((m: any) => ({
          meal_name: m.meal_name || "",
          foodItems: (m.foodItems || []).map((f: any) => ({
            food_id: f.food_id || "",
            name: f.name || "",
            source: f.source || "ai",
            portion_grams: f.portion_grams || 100,
            calories_per_100g: f.calories_per_100g || 0,
            protein_per_100g: f.protein_per_100g || 0,
            carbs_per_100g: f.carbs_per_100g || 0,
            fat_per_100g: f.fat_per_100g || 0,
          })),
          notes: m.notes || "",
        })));
      }

      toast({ title: "Template gerado pela IA! ✨ Revise e ajuste antes de salvar." });
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao gerar template", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const openEdit = (template: any) => {
    setEditingId(template.id);
    setNewTitle(template.title);
    setNewDesc(template.description || "");
    setNewType(template.template_type);

    const data = template.template_data as any || {};

    if (template.template_type === "workout") {
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
      } else {
        setWorkoutDays([emptyDay()]);
      }
      setMeals([emptyMeal()]);
    } else {
      if (data.meals && data.meals.length > 0) {
        setMeals(data.meals.map((m: any) => ({
          meal_name: m.meal_name || "",
          foodItems: (m.foodItems || []).map((f: any) => ({
            food_id: f.food_id || "",
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
      } else {
        setMeals([emptyMeal()]);
      }
      setWorkoutDays([emptyDay()]);
    }

    setEditorOpen(true);
  };

  const buildTemplateData = (): Record<string, unknown> => {
    if (newType === "workout") {
      return {
        days: workoutDays.filter(d => d.name.trim() || d.exercises.some(e => e.name.trim())).map(d => ({
          name: d.name,
          muscle_groups: d.muscle_groups,
          exercises: d.exercises.filter(e => e.name.trim()),
        })),
      };
    } else {
      return {
        meals: meals.filter(m => m.meal_name.trim()).map(m => ({
          meal_name: m.meal_name,
          foodItems: m.foodItems,
          notes: m.notes,
        })),
      };
    }
  };

  const saveTemplate = async () => {
    if (!user || !newTitle.trim()) return;
    setSaving(true);

    const templateData = buildTemplateData();

    if (editingId) {
      const { error } = await supabase
        .from("seller_templates")
        .update({
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          template_data: templateData as any,
        })
        .eq("id", editingId);

      if (error) {
        toast({ title: "Erro ao salvar template", variant: "destructive" });
      } else {
        toast({ title: "Template atualizado! 📋" });
        setEditorOpen(false);
        resetEditor();
        load();
      }
    } else {
      const { error } = await supabase.from("seller_templates").insert({
        user_id: user.id,
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        template_type: newType,
        template_data: templateData as any,
      } as any);

      if (error) {
        toast({ title: "Erro ao criar template", variant: "destructive" });
      } else {
        toast({ title: "Template criado! 📋" });
        setEditorOpen(false);
        resetEditor();
        load();
      }
    }
    setSaving(false);
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("seller_templates").delete().eq("id", id);
    load();
  };

  // Workout helpers
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

  // Diet helpers
  const updateMeal = (idx: number, field: keyof MealData, value: any) => {
    setMeals(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };
  const addMeal = () => setMeals(prev => [...prev, emptyMeal()]);
  const removeMeal = (idx: number) => setMeals(prev => prev.filter((_, i) => i !== idx));

  const getTemplateSummary = (t: any) => {
    const data = t.template_data as any || {};
    if (t.template_type === "workout") {
      const days = data.days || [];
      const totalExercises = days.reduce((acc: number, d: any) => acc + (d.exercises?.length || 0), 0);
      return days.length > 0 ? `${days.length} dia(s), ${totalExercises} exercício(s)` : "Vazio";
    } else {
      const meals = data.meals || [];
      const totalFoods = meals.reduce((acc: number, m: any) => acc + (m.foodItems?.length || 0), 0);
      return meals.length > 0 ? `${meals.length} refeição(ões), ${totalFoods} alimento(s)` : "Vazio";
    }
  };

  if (editorOpen) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
          <button onClick={() => { setEditorOpen(false); resetEditor(); }} className="p-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="font-display font-semibold text-foreground">
            {editingId ? "Editar Template" : "Novo Template"}
          </h1>
        </div>

        <div className="px-4 pt-4 space-y-6">
          {/* Meta info */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Título</Label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} className="bg-secondary/50" placeholder="Ex: Treino Push Pull Legs" />
            </div>
            {!editingId && (
              <div>
                <Label className="text-sm text-muted-foreground mb-1 block">Tipo</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workout">Treino</SelectItem>
                    <SelectItem value="diet">Dieta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Descrição (opcional)</Label>
              <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} className="bg-secondary/50" placeholder="Descrição do template..." />
            </div>
          </div>

          {/* AI Generation */}
          {!editingId && (
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gerar por IA</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Objetivo</Label>
                  <Select value={aiGoal} onValueChange={setAiGoal}>
                    <SelectTrigger className="bg-secondary/50 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hipertrofia">Hipertrofia</SelectItem>
                      <SelectItem value="emagrecimento">Emagrecimento</SelectItem>
                      <SelectItem value="força">Força</SelectItem>
                      <SelectItem value="resistência">Resistência</SelectItem>
                      <SelectItem value="recomposição">Recomposição</SelectItem>
                      <SelectItem value="saúde">Saúde geral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Nível</Label>
                  <Select value={aiLevel} onValueChange={setAiLevel}>
                    <SelectTrigger className="bg-secondary/50 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="iniciante">Iniciante</SelectItem>
                      <SelectItem value="intermediário">Intermediário</SelectItem>
                      <SelectItem value="avançado">Avançado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {newType === "workout" && (
                <div>
                  <Label className="text-[10px] text-muted-foreground">Dias de treino</Label>
                  <Select value={aiDays} onValueChange={setAiDays}>
                    <SelectTrigger className="bg-secondary/50 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} dias</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-[10px] text-muted-foreground">Instruções extras (opcional)</Label>
                <Textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder={newType === "workout" ? "Ex: Push Pull Legs, foco em compostos, sem agachamento livre..." : "Ex: 2000 kcal, low carb, sem lactose..."}
                  className="bg-secondary/50 text-sm min-h-[60px]"
                />
              </div>
              <Button
                onClick={generateWithAI}
                disabled={generating}
                className="w-full gradient-primary text-primary-foreground"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {generating ? "Gerando..." : "Gerar com IA"}
              </Button>
            </div>
          )}

          {/* Content Editor */}
          {newType === "workout" ? (
            <div className="space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Conteúdo do treino</p>
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
                      <Input value={ex.notes} onChange={e => updateExercise(dayIdx, exIdx, "notes", e.target.value)} placeholder="Obs (opcional)" className="bg-secondary/50 text-sm" />
                    </div>
                  ))}

                  <Button variant="outline" size="sm" className="w-full" onClick={() => addExercise(dayIdx)}>
                    <Plus className="h-3 w-3 mr-1" /> Exercício
                  </Button>
                </div>
              ))}

              <Button variant="outline" className="w-full" onClick={addDay}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar dia
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Conteúdo da dieta</p>
              {meals.map((meal, mealIdx) => {
                const macros = calcMealMacros(meal.foodItems);
                return (
                  <div key={mealIdx} className="glass-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Refeição {mealIdx + 1}</p>
                      {meals.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeMeal(mealIdx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <Input value={meal.meal_name} onChange={e => updateMeal(mealIdx, "meal_name", e.target.value)} placeholder="Ex: Café da manhã" className="bg-secondary/50 text-sm" />

                    <FoodSearch
                      foods={meal.foodItems}
                      onFoodsChange={(newFoods) => {
                        const updated = [...meals];
                        updated[mealIdx].foodItems = newFoods;
                        setMeals(updated);
                      }}
                    />

                    <Textarea value={meal.notes} onChange={e => updateMeal(mealIdx, "notes", e.target.value)} placeholder="Observações (opcional)" className="bg-secondary/50 text-sm min-h-[60px]" />
                  </div>
                );
              })}

              <Button variant="outline" className="w-full" onClick={addMeal}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar refeição
              </Button>
            </div>
          )}

          <Button onClick={saveTemplate} disabled={saving || !newTitle.trim()} className="w-full gradient-primary text-primary-foreground">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar Template"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/seller-dashboard?tab=library")} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-display font-semibold text-foreground">Biblioteca de Templates</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <Button onClick={openCreate} className="w-full gradient-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" />
          Novo Template
        </Button>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-muted-foreground">Nenhum template criado</p>
            <p className="text-xs text-muted-foreground mt-1">Crie templates de treino ou dieta para reutilizar nas entregas do marketplace.</p>
          </div>
        ) : (
          templates.map(t => {
            const isExpanded = expandedId === t.id;
            const data = t.template_data as any || {};
            return (
              <div key={t.id} className="glass-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => setExpandedId(isExpanded ? null : t.id)}>
                    {t.template_type === "workout" ? (
                      <Dumbbell className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <UtensilsCrossed className="h-5 w-5 text-info shrink-0" />
                    )}
                    <div className="min-w-0">
                      <h3 className="font-display font-semibold text-foreground text-sm truncate">{t.title}</h3>
                      {t.description && (
                        <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {t.template_type === "workout" ? "Treino" : "Dieta"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{getTemplateSummary(t)}</span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                    {t.template_type === "workout" && data.days?.map((d: any, i: number) => (
                      <div key={i} className="text-xs space-y-1">
                        <p className="font-medium text-foreground">{d.name || `Dia ${i + 1}`} {d.muscle_groups && <span className="text-muted-foreground">— {d.muscle_groups}</span>}</p>
                        {d.exercises?.map((e: any, j: number) => (
                          <p key={j} className="text-muted-foreground pl-3">• {e.name} — {e.sets}x{e.reps} ({e.rest_seconds}s)</p>
                        ))}
                      </div>
                    ))}
                    {t.template_type === "diet" && data.meals?.map((m: any, i: number) => (
                      <div key={i} className="text-xs space-y-1">
                        <p className="font-medium text-foreground">{m.meal_name || `Refeição ${i + 1}`}</p>
                        {m.foodItems?.map((f: any, j: number) => (
                          <p key={j} className="text-muted-foreground pl-3">• {f.name} — {f.portion_grams}g</p>
                        ))}
                      </div>
                    ))}

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(t)}>
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteTemplate(t.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SellerTemplates;
