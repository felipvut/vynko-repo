import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Dumbbell, UtensilsCrossed, Wrench, CheckCircle, Star, Package, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";

const PurchaseDetail = () => {
  const { purchaseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [purchase, setPurchase] = useState<any>(null);
  const [service, setService] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const [program, setProgram] = useState<any>(null);
  const [workoutDays, setWorkoutDays] = useState<any[]>([]);
  const [dietPlan, setDietPlan] = useState<any>(null);
  const [dietMeals, setDietMeals] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [hasReview, setHasReview] = useState(false);
  const [applying, setApplying] = useState(false);

  // Adjustment sheet
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustMessage, setAdjustMessage] = useState("");
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // Review sheet
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const load = useCallback(async () => {
    if (!user || !purchaseId) return;
    setLoading(true);

    const { data: purch } = await supabase
      .from("service_purchases")
      .select("*")
      .eq("id", purchaseId)
      .eq("buyer_id", user.id)
      .single();

    if (!purch) {
      toast({ title: "Compra não encontrada", variant: "destructive" });
      navigate("/my-purchases");
      return;
    }
    setPurchase(purch);

    // Fetch service, delivery, review in parallel
    const [{ data: svc }, { data: deliveries }, { data: review }] = await Promise.all([
      supabase.from("marketplace_services").select("*").eq("id", purch.service_id).single(),
      supabase.from("service_deliveries").select("*").eq("purchase_id", purchaseId).order("created_at", { ascending: false }),
      supabase.from("service_reviews").select("id").eq("purchase_id", purchaseId).maybeSingle(),
    ]);

    setService(svc);
    setHasReview(!!review);

    const latestDelivery = deliveries?.[0] || null;
    setDelivery(latestDelivery);

    if (latestDelivery) {
      // Fetch linked content and materials in parallel
      const promises: Promise<any>[] = [];

      if (latestDelivery.linked_program_id) {
        promises.push(
          Promise.resolve(supabase.from("training_programs").select("*").eq("id", latestDelivery.linked_program_id).single())
            .then(async ({ data: prog }) => {
              setProgram(prog);
              if (prog) {
                const { data: days } = await supabase
                  .from("workout_days")
                  .select("*, exercises(*)")
                  .eq("program_id", prog.id)
                  .order("day_order");
                setWorkoutDays(days || []);
              }
            })
        );
      }

      if (latestDelivery.linked_diet_id) {
        promises.push(
          Promise.resolve(supabase.from("diet_plans").select("*").eq("id", latestDelivery.linked_diet_id).single())
            .then(async ({ data: diet }) => {
              setDietPlan(diet);
              if (diet) {
                const { data: meals } = await supabase
                  .from("diet_meals")
                  .select("*")
                  .eq("diet_plan_id", diet.id)
                  .order("meal_order");
                setDietMeals(meals || []);
              }
            })
        );
      }

      // Fetch materials
      promises.push(
        Promise.resolve(supabase.from("delivery_materials").select("*, seller_materials(*)").eq("delivery_id", latestDelivery.id))
          .then(({ data }) => setMaterials(data || []))
      );

      await Promise.all(promises);
    }

    setLoading(false);
  }, [user, purchaseId]);

  useEffect(() => { load(); }, [load]);

  const isWorkout = service?.category === "workout";
  const isDelivered = purchase?.status === "delivered" || purchase?.status === "completed";
  const deliveredAt = purchase?.delivered_at || purchase?.last_delivered_at || delivery?.created_at;
  const canAdjust = purchase?.status === "delivered" && deliveredAt &&
    (new Date().getTime() - new Date(deliveredAt).getTime()) < 48 * 3600000;

  // Can review after applying (status = completed) and no existing review
  const canReview = purchase?.status === "completed" && !hasReview;

  const applyContent = async () => {
    if (!purchase || !delivery) return;
    setApplying(true);

    try {
      if (isWorkout && program) {
        // Activate this program, deactivate others
        await supabase.from("training_programs").update({ is_active: false })
          .eq("user_id", user!.id).eq("is_active", true);
        await supabase.from("training_programs").update({ is_active: true })
          .eq("id", program.id);
      }

      if (!isWorkout && dietPlan) {
        // Activate this diet, deactivate others
        await supabase.from("diet_plans").update({ is_active: false })
          .eq("user_id", user!.id).eq("is_active", true);
        await supabase.from("diet_plans").update({ is_active: true })
          .eq("id", dietPlan.id);
      }

      // Update purchase status to completed
      await supabase.from("service_purchases").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", purchase.id);

      setPurchase((prev: any) => ({ ...prev, status: "completed", completed_at: new Date().toISOString() }));
      toast({ title: isWorkout ? "Treino aplicado com sucesso! 💪" : "Dieta aplicada com sucesso! 🥗" });
    } catch (err: any) {
      toast({ title: "Erro ao aplicar", description: err.message, variant: "destructive" });
    }
    setApplying(false);
  };

  const submitAdjustment = async () => {
    if (!user || !purchase || !adjustMessage.trim()) return;
    setSubmittingAdjust(true);

    const { error } = await supabase.rpc("request_purchase_adjustment", {
      _purchase_id: purchase.id,
      _message: adjustMessage.trim(),
    } as any);

    if (error) {
      toast({ title: "Erro ao solicitar ajuste", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ajuste solicitado! O vendedor será notificado." });
      setAdjustOpen(false);
      setAdjustMessage("");
      load();
    }
    setSubmittingAdjust(false);
  };

  const submitReview = async () => {
    if (!user || !purchase) return;
    setSubmittingReview(true);

    const { error } = await supabase.from("service_reviews").insert({
      purchase_id: purchase.id,
      service_id: purchase.service_id,
      reviewer_id: user.id,
      seller_id: purchase.seller_id,
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    } as any);

    if (error) {
      toast({ title: "Erro ao enviar avaliação", variant: "destructive" });
    } else {
      toast({ title: "Avaliação enviada! ⭐" });
      setReviewOpen(false);
      setHasReview(true);
    }
    setSubmittingReview(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/my-purchases")} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-semibold text-foreground truncate">{service?.title || "Detalhes"}</h1>
          <p className="text-xs text-muted-foreground">
            {isWorkout ? "Treino" : "Dieta"} • {purchase?.price === 0 ? "Grátis" : `R$ ${Number(purchase?.price).toFixed(2)}`}
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {purchase?.status === "completed" ? "Aplicado" :
           purchase?.status === "delivered" ? "Enviado" :
           purchase?.status === "adjustment" ? "Em ajuste" :
           purchase?.status === "paid" ? "Em andamento" : purchase?.status}
        </Badge>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Not delivered yet */}
        {!delivery && (
          <div className="glass-card p-6 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-display font-semibold text-foreground mb-1">Aguardando entrega</h3>
            <p className="text-sm text-muted-foreground">O vendedor ainda não enviou o conteúdo deste pedido.</p>
          </div>
        )}

        {/* Workout content */}
        {delivery && isWorkout && program && (
          <div className="space-y-3">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Dumbbell className="h-5 w-5 text-primary" />
                <h2 className="font-display font-semibold text-foreground">{program.name}</h2>
              </div>
              {program.description && (
                <p className="text-sm text-muted-foreground mb-3">{program.description}</p>
              )}
              <p className="text-xs text-muted-foreground">{workoutDays.length} dia(s) de treino</p>
            </div>

            {workoutDays.map((day, dayIdx) => (
              <div key={day.id} className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-sm text-foreground">{day.name}</h3>
                    {day.muscle_groups && (
                      <p className="text-xs text-muted-foreground">{day.muscle_groups}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Dia {dayIdx + 1}</Badge>
                </div>
                <div className="space-y-2">
                  {(day.exercises || [])
                    .sort((a: any, b: any) => (a.exercise_order || 0) - (b.exercise_order || 0))
                    .map((ex: any) => (
                      <div key={ex.id} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-primary">{ex.exercise_order}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{ex.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {ex.sets} séries × {ex.reps} reps
                            {ex.rest_seconds ? ` • ${ex.rest_seconds}s descanso` : ""}
                          </p>
                          {ex.notes && <p className="text-xs text-muted-foreground/70 italic mt-0.5">{ex.notes}</p>}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Diet content */}
        {delivery && !isWorkout && dietPlan && (
          <div className="space-y-3">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <UtensilsCrossed className="h-5 w-5 text-primary" />
                <h2 className="font-display font-semibold text-foreground">{dietPlan.name}</h2>
              </div>
              {dietPlan.description && (
                <p className="text-sm text-muted-foreground mb-3">{dietPlan.description}</p>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {dietPlan.total_calories && <span>🔥 {dietPlan.total_calories} kcal</span>}
                {dietPlan.protein_grams && <span>🥩 {dietPlan.protein_grams}g prot</span>}
                {dietPlan.carbs_grams && <span>🍚 {dietPlan.carbs_grams}g carb</span>}
                {dietPlan.fat_grams && <span>🧈 {dietPlan.fat_grams}g gord</span>}
              </div>
            </div>

            {dietMeals.map((meal) => (
              <div key={meal.id} className="glass-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm text-foreground">{meal.meal_name}</h3>
                  <div className="flex gap-2 text-[10px] text-muted-foreground">
                    {meal.calories && <span>{meal.calories} kcal</span>}
                    {meal.protein_grams && <span>{meal.protein_grams}g P</span>}
                    {meal.carbs_grams && <span>{meal.carbs_grams}g C</span>}
                    {meal.fat_grams && <span>{meal.fat_grams}g G</span>}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{meal.foods}</p>
                {meal.notes && <p className="text-xs text-muted-foreground/70 italic mt-1">{meal.notes}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Delivery notes */}
        {delivery?.notes && (
          <div className="glass-card p-4">
            <h3 className="text-sm font-medium text-foreground mb-1 flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Observações do vendedor
            </h3>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{delivery.notes}</p>
          </div>
        )}

        {/* Materials */}
        {materials.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Materiais anexados
            </h3>
            <div className="space-y-2">
              {materials.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px]">{m.seller_materials?.material_type}</Badge>
                  <span>{m.seller_materials?.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        {isDelivered && delivery && (
          <div className="space-y-2 pt-2">
            {purchase?.status === "delivered" && (
              <>
                <Button
                  onClick={applyContent}
                  disabled={applying}
                  className="w-full gradient-primary text-primary-foreground"
                  size="lg"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  {applying ? "Aplicando..." : isWorkout ? "Aplicar treino" : "Aplicar dieta"}
                </Button>

                {canAdjust && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    onClick={() => setAdjustOpen(true)}
                  >
                    <Wrench className="h-5 w-5 mr-2" />
                    Solicitar ajuste
                  </Button>
                )}
              </>
            )}

            {canReview && (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => setReviewOpen(true)}
              >
                <Star className="h-5 w-5 mr-2" />
                Avaliar vendedor
              </Button>
            )}

            {hasReview && (
              <div className="text-center text-sm text-muted-foreground py-2">
                ✅ Avaliação já enviada
              </div>
            )}
          </div>
        )}
      </div>

      {/* Adjustment sheet */}
      <Sheet open={adjustOpen} onOpenChange={setAdjustOpen}>
        <SheetContent side="bottom" className="bg-card rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-foreground">Solicitar ajuste</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Descreva os ajustes necessários. O vendedor será notificado e poderá reenviar o serviço atualizado.
            </p>
            <Textarea
              value={adjustMessage}
              onChange={e => setAdjustMessage(e.target.value)}
              placeholder="Ex: Preciso aumentar a carga do treino de pernas, trocar o exercício X por Y..."
              className="bg-secondary/50 min-h-[120px]"
              maxLength={1000}
            />
            <Button
              onClick={submitAdjustment}
              disabled={submittingAdjust || !adjustMessage.trim()}
              className="w-full gradient-primary text-primary-foreground"
            >
              {submittingAdjust ? "Enviando..." : "Enviar solicitação"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Review sheet */}
      <Sheet open={reviewOpen} onOpenChange={setReviewOpen}>
        <SheetContent side="bottom" className="bg-card rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-foreground">Avaliar vendedor</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setReviewRating(n)}>
                  <Star
                    className={`h-8 w-8 transition-colors ${n <= reviewRating ? "text-warning fill-warning" : "text-muted-foreground/30"}`}
                  />
                </button>
              ))}
            </div>
            <Textarea
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              placeholder="Comentário opcional..."
              className="bg-secondary/50"
              maxLength={500}
            />
            <Button
              onClick={submitReview}
              disabled={submittingReview}
              className="w-full gradient-primary text-primary-foreground"
            >
              {submittingReview ? "Enviando..." : "Enviar avaliação"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav />
    </div>
  );
};

export default PurchaseDetail;
