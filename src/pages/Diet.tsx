import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Sparkles, UtensilsCrossed,
  Flame, Beef, Wheat, Droplets, ArrowRightLeft,
  RefreshCw, Pencil, History, ClipboardEdit, ChevronRight, X,
  Timer, Calendar, Hash, Sparkles as SparklesIcon, UserCog, Plus, Share2
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import NotificationBell from "@/components/NotificationBell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import EditMealSheet from "@/components/EditMealSheet";
import CreateManualDietSheet from "@/components/CreateManualDietSheet";
import SharePlanSheet from "@/components/SharePlanSheet";
import PendingSharesSheet from "@/components/PendingSharesSheet";

type DietView = "current" | "history" | "history-detail";

const Diet = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasAnamnesis, setHasAnamnesis] = useState<boolean | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [meals, setMeals] = useState<any[]>([]);
  const [substitutions, setSubstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showRegenForm, setShowRegenForm] = useState(false);
  const [regenMode, setRegenMode] = useState<"edit" | "new">("edit");
  const [customPrompt, setCustomPrompt] = useState("");

  // History state
  const [view, setView] = useState<DietView>("current");
  const [historyPlans, setHistoryPlans] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryPlan, setSelectedHistoryPlan] = useState<any>(null);
  const [historyMeals, setHistoryMeals] = useState<any[]>([]);
  const [historySubs, setHistorySubs] = useState<any[]>([]);
  const [totalDietsCount, setTotalDietsCount] = useState(0);
  const [editingMeal, setEditingMeal] = useState<any>(null);
  const [showManualCreate, setShowManualCreate] = useState(false);
  const [showShareDiet, setShowShareDiet] = useState(false);
  const [showPendingShares, setShowPendingShares] = useState(false);
  const [anamnesisExpired, setAnamnesisExpired] = useState(false);

  useEffect(() => {
    if (user) {
      loadDiet();
      supabase.from("anamnesis").select("id, updated_at").eq("user_id", user.id).eq("completed", true).maybeSingle().then(({ data }) => {
        setHasAnamnesis(!!data);
        if (data) {
          const daysSince = Math.floor((Date.now() - new Date(data.updated_at).getTime()) / (1000 * 60 * 60 * 24));
          setAnamnesisExpired(daysSince >= 45);
        }
      });
    }
  }, [user]);

  // Open pending shares from notification tap
  useEffect(() => {
    if (location.state?.openPendingShares) {
      setShowPendingShares(true);
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  const loadDiet = async () => {
    if (!user) return;
    setLoading(true);

    const { data: planData } = await supabase
      .from("diet_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1);

    const activePlan = planData?.[0] || null;
    setPlan(activePlan);

    if (activePlan) {
      const [mealsRes, subsRes, countRes] = await Promise.all([
        supabase
          .from("diet_meals")
          .select("*")
          .eq("diet_plan_id", activePlan.id)
          .order("meal_order"),
        supabase
          .from("food_substitutions")
          .select("*")
          .eq("diet_plan_id", activePlan.id)
          .order("food_group"),
        supabase
          .from("diet_plans")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);
      setMeals(mealsRes.data || []);
      setSubstitutions(subsRes.data || []);
      setTotalDietsCount(countRes.count || 0);
    }
    setLoading(false);
  };

  const generateDiet = async () => {
    if (regenMode === "edit" && !customPrompt.trim()) {
      toast.error("Descreva o que deseja alterar na dieta atual.");
      return;
    }
    setGenerating(true);
    try {
      const body: any = { prompt: customPrompt.trim(), mode: regenMode };
      if (regenMode === "edit" && plan) {
        body.current_diet_summary = meals.map(m => `${m.meal_name}: ${m.foods}`).join("\n");
      }
      const { data, error } = await supabase.functions.invoke("generate-diet", {
        body,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Dieta gerada com sucesso! 🎉");
      setCustomPrompt("");
      setShowRegenForm(false);
      await loadDiet();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar dieta");
    }
    setGenerating(false);
  };

  const loadHistory = async () => {
    if (!user) return;
    setHistoryLoading(true);
    const { data } = await supabase
      .from("diet_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", false)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistoryPlans(data || []);
    setHistoryLoading(false);
    setView("history");
  };

  const viewHistoryPlan = async (histPlan: any) => {
    setHistoryLoading(true);
    setSelectedHistoryPlan(histPlan);
    const [mealsRes, subsRes] = await Promise.all([
      supabase.from("diet_meals").select("*").eq("diet_plan_id", histPlan.id).order("meal_order"),
      supabase.from("food_substitutions").select("*").eq("diet_plan_id", histPlan.id).order("food_group"),
    ]);
    setHistoryMeals(mealsRes.data || []);
    setHistorySubs(subsRes.data || []);
    setHistoryLoading(false);
    setView("history-detail");
  };

  const reactivatePlan = async (histPlan: any) => {
    if (!user) return;
    // Deactivate current
    await supabase.from("diet_plans").update({ is_active: false }).eq("user_id", user.id).eq("is_active", true);
    // Activate selected
    await supabase.from("diet_plans").update({ is_active: true }).eq("id", histPlan.id);
    toast.success("Dieta restaurada!");
    setView("current");
    await loadDiet();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (hasAnamnesis === false) {
    return (
      <div className="min-h-screen pb-24">
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="container flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-primary" />
              <span className="font-display font-bold">Minha Dieta</span>
            </div>
            <NotificationBell />
          </div>
        </header>
        <div className="container mt-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 text-center space-y-4 max-w-md mx-auto">
            <UserCog className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-xl font-display font-bold">Preencha sua anamnese</h2>
            <p className="text-muted-foreground text-sm">
              Para gerar dietas personalizadas, precisamos conhecer seu perfil físico, objetivos e limitações.
            </p>
            <Button onClick={() => navigate("/onboarding", { state: { returnTo: "/diet" } })} className="gradient-primary text-primary-foreground w-full">
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
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            <span className="font-display font-bold">
              {view === "history" ? "Histórico de Dietas" : view === "history-detail" ? "Dieta Anterior" : "Minha Dieta"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            {(view === "history" || view === "history-detail") && (
              <Button variant="ghost" size="sm" onClick={() => {
                if (view === "history-detail") setView("history");
                else setView("current");
              }}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container mt-6 space-y-6">
        {/* ======== HISTORY LIST ======== */}
        {view === "history" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {historyLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : historyPlans.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma dieta anterior encontrada.</p>
              </div>
            ) : (
              historyPlans.map((hp) => (
                <motion.button
                  key={hp.id}
                  onClick={() => viewHistoryPlan(hp)}
                  className="glass-card p-4 w-full text-left flex items-center justify-between hover:border-primary/50 transition-colors"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div>
                    <p className="font-semibold text-sm">{hp.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(hp.created_at), "dd MMM yyyy", { locale: ptBR })}
                      {hp.total_calories ? ` · ${hp.total_calories} kcal` : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </motion.button>
              ))
            )}
          </motion.div>
        )}

        {/* ======== HISTORY DETAIL ======== */}
        {view === "history-detail" && selectedHistoryPlan && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-lg">{selectedHistoryPlan.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(selectedHistoryPlan.created_at), "dd MMM yyyy", { locale: ptBR })}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => reactivatePlan(selectedHistoryPlan)}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Restaurar
              </Button>
            </div>

            {/* Macros */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: Flame, label: "Calorias", value: `${selectedHistoryPlan.total_calories || "—"}`, unit: "kcal", color: "text-orange-500" },
                { icon: Beef, label: "Proteína", value: `${selectedHistoryPlan.protein_grams || "—"}`, unit: "g", color: "text-red-500" },
                { icon: Wheat, label: "Carbos", value: `${selectedHistoryPlan.carbs_grams || "—"}`, unit: "g", color: "text-amber-500" },
                { icon: Droplets, label: "Gordura", value: `${selectedHistoryPlan.fat_grams || "—"}`, unit: "g", color: "text-blue-500" },
              ].map((stat, i) => (
                <div key={i} className="glass-card p-3 text-center">
                  <stat.icon className={`h-4 w-4 mx-auto mb-1 ${stat.color}`} />
                  <p className="text-sm font-bold">{stat.value}<span className="text-xs font-normal text-muted-foreground ml-0.5">{stat.unit}</span></p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {historyLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <Tabs defaultValue="meals" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="meals" className="flex-1"><UtensilsCrossed className="h-3.5 w-3.5 mr-1" /> Refeições</TabsTrigger>
                  <TabsTrigger value="substitutions" className="flex-1"><ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Substituições</TabsTrigger>
                </TabsList>
                <TabsContent value="meals" className="space-y-3 mt-4">
                  {historyMeals.map((meal) => (
                    <div key={meal.id} className="glass-card p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">{meal.meal_name}</h3>
                        {meal.calories && <span className="text-xs text-muted-foreground">{meal.calories} kcal</span>}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{meal.foods}</p>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="substitutions" className="space-y-3 mt-4">
                  {historySubs.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">Nenhuma substituição.</p>
                  ) : (
                    (() => {
                      const groups: Record<string, any[]> = {};
                      historySubs.forEach(s => { if (!groups[s.food_group]) groups[s.food_group] = []; groups[s.food_group].push(s); });
                      return Object.entries(groups).map(([group, items]) => (
                        <div key={group} className="glass-card p-4 space-y-3">
                          <h3 className="font-semibold text-sm flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-primary" />{group}</h3>
                          <div className="space-y-2">
                            {items.map((sub: any) => (
                              <div key={sub.id} className="border-l-2 border-primary/30 pl-3 space-y-1">
                                <p className="text-sm font-medium">{sub.original_food}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {sub.substitution_options?.map((opt: string, oi: number) => (
                                    <span key={oi} className="text-xs bg-primary/15 px-2 py-1 rounded-full text-primary font-medium border border-primary/30">{opt}</span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()
                  )}
                </TabsContent>
              </Tabs>
            )}
          </motion.div>
        )}

        {/* ======== CURRENT PLAN ======== */}
        {view === "current" && (
          <>
            {!plan ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-8 text-center space-y-4">
                <UtensilsCrossed className="h-12 w-12 text-primary mx-auto" />
                <h2 className="text-xl font-display font-bold">Gere sua dieta personalizada</h2>
                <p className="text-muted-foreground text-sm">
                  Vamos criar um plano alimentar baseado no seu perfil, IMC e objetivos!
                </p>
                <div className="space-y-3 max-w-md mx-auto">
                  <Input
                    value={customPrompt}
                    onChange={e => setCustomPrompt(e.target.value)}
                    placeholder="Ex: Sou vegetariano, prefiro comida low carb..."
                    className="bg-secondary"
                  />
                  <Button
                    onClick={generateDiet}
                    disabled={generating}
                    className="gradient-primary text-primary-foreground w-full"
                  >
                    {generating ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando dieta...</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-2" /> Gerar Dieta com IA</>
                    )}
                  </Button>
                </div>

                {/* Quick actions even without plan */}
                <div className="flex justify-center gap-3 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate("/onboarding", { state: { returnTo: "/diet" } })}>
                    <ClipboardEdit className="h-4 w-4 mr-1" /> Editar Anamnese
                  </Button>
                </div>
              </motion.div>
            ) : (
              <>
                {/* Header info */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
                  <h2 className="font-display font-bold text-lg">{plan.name}</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowShareDiet(true)}>
                    <Share2 className="h-3.5 w-3.5 text-primary" />
                  </Button>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  )}
                </motion.div>

                {/* Counters - similar to Dashboard */}
                <div className="grid grid-cols-3 gap-3">
                  {(() => {
                    const createdDate = new Date(plan.created_at);
                    const now = new Date();
                    const diffDays = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                    return [
                      { icon: Timer, label: "Duração", value: `${diffDays}d` },
                      { icon: Hash, label: "Refeições", value: `${meals.length}` },
                      { icon: Calendar, label: "Total dietas", value: `${totalDietsCount}` },
                    ];
                  })().map((stat, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-4 text-center">
                      <stat.icon className="h-5 w-5 text-primary mx-auto mb-1" />
                      <p className="text-lg font-bold">{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Quick actions grid - same style as Dashboard */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="grid grid-cols-2 gap-3"
                >
                  <button
                    onClick={() => setShowRegenForm(true)}
                    className="glass-card p-3 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors active:scale-95"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-xs font-semibold text-center leading-tight">Nova Dieta</span>
                  </button>
                  <button
                    onClick={() => setShowManualCreate(true)}
                    className="glass-card p-3 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors active:scale-95"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Plus className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-xs font-semibold text-center leading-tight">Criar Manual</span>
                  </button>
                  <button
                    onClick={loadHistory}
                    className="glass-card p-3 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors active:scale-95"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <History className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-xs font-semibold text-center leading-tight">Anteriores</span>
                  </button>
                  <button
                    onClick={() => navigate("/onboarding", { state: { returnTo: "/diet" } })}
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

                {/* Macro summary */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { icon: Flame, label: "Calorias", value: `${plan.total_calories || "—"}`, unit: "kcal", color: "text-orange-500" },
                    { icon: Beef, label: "Proteína", value: `${plan.protein_grams || "—"}`, unit: "g", color: "text-red-500" },
                    { icon: Wheat, label: "Carbos", value: `${plan.carbs_grams || "—"}`, unit: "g", color: "text-amber-500" },
                    { icon: Droplets, label: "Gordura", value: `${plan.fat_grams || "—"}`, unit: "g", color: "text-blue-500" },
                  ].map((stat, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="glass-card p-3 text-center"
                    >
                      <stat.icon className={`h-4 w-4 mx-auto mb-1 ${stat.color}`} />
                      <p className="text-sm font-bold">{stat.value}<span className="text-xs font-normal text-muted-foreground ml-0.5">{stat.unit}</span></p>
                      <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Regenerate prompt */}
                {showRegenForm && (
                  <div className="glass-card p-4 space-y-4">
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
                        Nova do zero
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {regenMode === "edit"
                        ? "Diga o que quer mudar na dieta atual. A IA vai ajustar mantendo o restante."
                        : "Uma dieta completamente nova será gerada baseada no seu perfil e instruções."}
                    </p>
                    <Textarea
                      value={customPrompt}
                      onChange={e => setCustomPrompt(e.target.value)}
                      placeholder={regenMode === "edit"
                        ? "Ex: Reduza as calorias para 1800, diminua para 5 refeições..."
                        : "Ex: Quero menos calorias, sem lactose, 5 refeições..."
                      }
                      className="bg-secondary min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={generateDiet}
                        disabled={generating}
                        className="gradient-primary text-primary-foreground flex-1"
                      >
                        {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</> : <><Sparkles className="h-4 w-4 mr-2" /> {regenMode === "edit" ? "Ajustar Dieta" : "Gerar Nova"}</>}
                      </Button>
                      <Button variant="outline" onClick={() => setShowRegenForm(false)} disabled={generating}>Cancelar</Button>
                    </div>
                  </div>
                )}

                {/* Tabs: Meals / Substitutions */}
                <Tabs defaultValue="meals" className="w-full">
                  <TabsList className="w-full">
                    <TabsTrigger value="meals" className="flex-1">
                      <UtensilsCrossed className="h-3.5 w-3.5 mr-1" /> Refeições
                    </TabsTrigger>
                    <TabsTrigger value="substitutions" className="flex-1">
                      <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Substituições
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="meals" className="space-y-3 mt-4">
                    {meals.map((meal, i) => (
                      <motion.div
                        key={meal.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="glass-card p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-sm">{meal.meal_name}</h3>
                          <div className="flex items-center gap-2">
                            {meal.calories && (
                              <span className="text-xs text-primary/70 font-medium">{meal.calories} kcal</span>
                            )}
                            <button onClick={() => setEditingMeal(meal)} className="text-muted-foreground hover:text-primary transition-colors">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-primary/80 whitespace-pre-wrap">{meal.foods}</p>
                        {(meal.protein_grams || meal.carbs_grams || meal.fat_grams) && (
                          <div className="flex gap-3 text-[10px] text-muted-foreground pt-1">
                            {meal.protein_grams && <span className="text-red-500">P: {meal.protein_grams}g</span>}
                            {meal.carbs_grams && <span className="text-amber-500">C: {meal.carbs_grams}g</span>}
                            {meal.fat_grams && <span className="text-blue-500">G: {meal.fat_grams}g</span>}
                          </div>
                        )}
                        {meal.notes && (
                          <p className="text-xs text-muted-foreground italic">💡 {meal.notes}</p>
                        )}
                      </motion.div>
                    ))}
                  </TabsContent>

                  <TabsContent value="substitutions" className="space-y-3 mt-4">
                    {substitutions.length === 0 ? (
                      <p className="text-center text-muted-foreground text-sm py-8">Nenhuma substituição disponível.</p>
                    ) : (
                      (() => {
                        const groups: Record<string, typeof substitutions> = {};
                        substitutions.forEach(s => {
                          if (!groups[s.food_group]) groups[s.food_group] = [];
                          groups[s.food_group].push(s);
                        });

                        return Object.entries(groups).map(([group, items], gi) => (
                          <motion.div
                            key={group}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: gi * 0.05 }}
                            className="glass-card p-4 space-y-3"
                          >
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                              <ArrowRightLeft className="h-4 w-4 text-primary" />
                              {group}
                            </h3>
                            <div className="space-y-2">
                              {items.map((sub: any) => (
                                <div key={sub.id} className="border-l-2 border-primary/30 pl-3 space-y-1">
                                  <p className="text-sm font-medium">{sub.original_food}</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {sub.substitution_options?.map((opt: string, oi: number) => (
                                      <span
                                        key={oi}
                                        className="text-xs bg-primary/15 px-2 py-1 rounded-full text-primary font-medium border border-primary/30"
                                      >
                                        {opt}
                                      </span>
                                    ))}
                                  </div>
                                  {sub.notes && (
                                    <p className="text-[10px] text-muted-foreground italic">{sub.notes}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        ));
                      })()
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </>
        )}
       </div>
      {editingMeal && (
        <EditMealSheet
          open={!!editingMeal}
          onOpenChange={(open) => { if (!open) setEditingMeal(null); }}
          meal={editingMeal}
          onSaved={loadDiet}
          onDeleted={loadDiet}
        />
      )}
      <CreateManualDietSheet open={showManualCreate} onOpenChange={setShowManualCreate} onCreated={loadDiet} />
      {plan && (
        <SharePlanSheet open={showShareDiet} onOpenChange={setShowShareDiet} planType="diet" dietId={plan.id} planName={plan.name} />
      )}
      <PendingSharesSheet open={showPendingShares} onOpenChange={setShowPendingShares} onAccepted={() => loadDiet()} />
      <BottomNav />
    </div>
  );
};

export default Diet;