import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Package, Star, MessageCircle, XCircle, RefreshCw, Wrench, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";

const MyPurchases = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewPurchase, setReviewPurchase] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Adjustment sheet
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustPurchase, setAdjustPurchase] = useState<any>(null);
  const [adjustMessage, setAdjustMessage] = useState("");
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from("service_purchases")
      .select("*")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const serviceIds = [...new Set(data.map((p: any) => p.service_id))];
      const purchaseIds = data.map((p: any) => p.id);

      const [{ data: svcData }, { data: existingReviews }, { data: deliveries }] = await Promise.all([
        supabase.from("marketplace_services")
          .select("id, title, category, cover_image_url, billing_type, billing_interval, billing_count, delivery_time_days")
          .in("id", serviceIds),
        supabase.from("service_reviews")
          .select("purchase_id")
          .in("purchase_id", purchaseIds),
        supabase.from("service_deliveries")
          .select("purchase_id, created_at, delivery_type, linked_program_id, linked_diet_id")
          .in("purchase_id", purchaseIds)
          .order("created_at", { ascending: false }),
      ]);

      const svcMap = new Map((svcData || []).map(s => [s.id, s]));
      const reviewedSet = new Set((existingReviews || []).map((r: any) => r.purchase_id));

      const lastDeliveryMap = new Map<string, any>();
      for (const d of deliveries || []) {
        if (!lastDeliveryMap.has(d.purchase_id)) {
          lastDeliveryMap.set(d.purchase_id, d);
        }
      }

      // Fetch delivered plan names
      const programIds = (deliveries || []).filter(d => d.linked_program_id).map(d => d.linked_program_id!);
      const dietIds = (deliveries || []).filter(d => d.linked_diet_id).map(d => d.linked_diet_id!);
      
      const [{ data: programs }, { data: diets }] = await Promise.all([
        programIds.length > 0 ? supabase.from("training_programs").select("id, name").in("id", programIds) : Promise.resolve({ data: [] }),
        dietIds.length > 0 ? supabase.from("diet_plans").select("id, name").in("id", dietIds) : Promise.resolve({ data: [] }),
      ]);
      const programMap = new Map((programs || []).map(p => [p.id, p.name]));
      const dietMap = new Map((diets || []).map(d => [d.id, d.name]));

      setPurchases(data.map((p: any) => {
        const svc = svcMap.get(p.service_id);
        const lastDel = lastDeliveryMap.get(p.id);
        const deliveredAt = p.delivered_at || lastDel?.created_at;
        
        // Get delivered plan name
        let deliveredPlanName: string | null = null;
        if (lastDel?.linked_program_id) deliveredPlanName = programMap.get(lastDel.linked_program_id) || null;
        if (lastDel?.linked_diet_id) deliveredPlanName = dietMap.get(lastDel.linked_diet_id) || null;

        // Compute display status
        let displayStatus = p.status;
        if (p.status === "paid" && svc?.delivery_time_days) {
          const purchaseDate = new Date(p.created_at);
          const deadlineDate = new Date(purchaseDate.getTime() + svc.delivery_time_days * 86400000);
          if (new Date() > deadlineDate) {
            displayStatus = "overdue";
          } else {
            displayStatus = "in_progress";
          }
        } else if (p.status === "paid") {
          displayStatus = "in_progress";
        }

        // Can request adjustment? (delivered within 48h)
        const canAdjust = p.status === "delivered" && deliveredAt &&
          (new Date().getTime() - new Date(deliveredAt).getTime()) < 48 * 3600000;

        // Can review? (5 days after purchase or last delivery for recurring)
        const reviewRefDate = deliveredAt || p.created_at;
        const daysSinceDelivery = (new Date().getTime() - new Date(reviewRefDate).getTime()) / 86400000;
        const canReview = (p.status === "delivered" || p.status === "completed") && 
          !reviewedSet.has(p.id) && daysSinceDelivery >= 5;

        return {
          ...p,
          service_title: svc?.title || "Serviço",
          service_category: svc?.category || "workout",
          service_cover: svc?.cover_image_url || null,
          billing_type: svc?.billing_type || "one_time",
          billing_interval: svc?.billing_interval || null,
          billing_count: svc?.billing_count || null,
          has_review: reviewedSet.has(p.id),
          displayStatus,
          canAdjust,
          canReview,
          deliveredAt,
          deliveredPlanName,
        };
      }));
    } else {
      setPurchases([]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Auto-confirm pending purchases when returning from Stripe checkout
  const confirmedRef = useRef(false);
  useEffect(() => {
    if (searchParams.get("payment") !== "success" || !user || confirmedRef.current) return;
    confirmedRef.current = true;
    
    // Replace history so back button won't go to Stripe
    window.history.replaceState(null, "", "/my-purchases");
    
    const confirmPending = async () => {
      const { data: pending } = await supabase
        .from("service_purchases")
        .select("id")
        .eq("buyer_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);

      if (pending && pending.length > 0) {
        const results = await Promise.all(
          pending.map(p =>
            supabase.functions.invoke("marketplace-confirm-purchase", {
              body: { purchase_id: p.id },
            })
          )
        );
        
        const anyConfirmed = results.some(r => r.data?.status === "paid");
        if (anyConfirmed) {
          toast({ title: "Pagamento confirmado! ✅" });
          load();
        }
      }
      
      setSearchParams({}, { replace: true });
    };

    confirmPending();
  }, [searchParams, user, load, setSearchParams]);

  const submitReview = async () => {
    if (!user || !reviewPurchase) return;
    setSubmittingReview(true);

    const { error } = await supabase.from("service_reviews").insert({
      purchase_id: reviewPurchase.id,
      service_id: reviewPurchase.service_id,
      reviewer_id: user.id,
      seller_id: reviewPurchase.seller_id,
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    } as any);

    if (error) {
      toast({ title: "Erro ao enviar avaliação", variant: "destructive" });
    } else {
      toast({ title: "Avaliação enviada! ⭐" });
      setReviewOpen(false);
      setReviewComment("");
      setReviewRating(5);
      load();
    }
    setSubmittingReview(false);
  };

  const submitAdjustment = async () => {
    if (!user || !adjustPurchase || !adjustMessage.trim()) return;
    setSubmittingAdjust(true);

    const { error } = await supabase.rpc("request_purchase_adjustment", {
      _purchase_id: adjustPurchase.id,
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

  const [cancelling, setCancelling] = useState<string | null>(null);

  const cancelRecurrence = async (purchaseId: string) => {
    setCancelling(purchaseId);
    const { error } = await supabase.rpc("cancel_recurring_purchase", {
      _purchase_id: purchaseId,
    } as any);

    if (error) {
      toast({ title: "Erro ao cancelar recorrência", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Recorrência cancelada com sucesso" });
      load();
    }
    setCancelling(null);
  };

  const intervalLabel: Record<string, string> = {
    daily: "Diário",
    weekly: "Semanal",
    monthly: "Mensal",
    quarterly: "Trimestral",
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: "Pendente", color: "bg-muted text-muted-foreground" },
    in_progress: { label: "Em andamento", color: "bg-warning/10 text-warning" },
    overdue: { label: "Atrasado", color: "bg-destructive/10 text-destructive" },
    paid: { label: "Pago", color: "bg-warning/10 text-warning" },
    delivered: { label: "Enviado", color: "bg-info/10 text-info" },
    adjustment: { label: "Em ajuste", color: "bg-warning/10 text-warning" },
    completed: { label: "Concluído", color: "bg-primary/10 text-primary" },
    refunded: { label: "Reembolsado", color: "bg-destructive/10 text-destructive" },
    cancelled: { label: "Cancelado", color: "bg-destructive/10 text-destructive" },
    expired: { label: "Expirado", color: "bg-muted text-muted-foreground" },
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/marketplace")} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-display font-semibold text-foreground">Minhas Compras</h1>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-display font-semibold text-foreground mb-2">Nenhuma compra</h3>
            <p className="text-sm text-muted-foreground mb-6">Explore o marketplace para encontrar serviços</p>
            <Button onClick={() => navigate("/marketplace")} className="gradient-primary text-primary-foreground">
              Explorar Marketplace
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {purchases.map(p => {
              const status = statusMap[p.displayStatus] || statusMap.pending;
              return (
                <div key={p.id} className="glass-card p-4 cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate(`/purchase/${p.id}`)}>
                  <div className="flex items-start gap-3">
                    {p.service_cover && (
                      <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden">
                        <img src={p.service_cover} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-foreground truncate">{p.service_title}</h3>
                      {p.deliveredPlanName && (
                        <p className="text-xs text-primary/80 truncate">📋 {p.deliveredPlanName}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">
                          {p.service_category === "workout" ? "Treino" : "Dieta"}
                        </Badge>
                        <Badge variant="secondary" className={`text-[10px] ${status.color}`}>
                          {p.displayStatus === "overdue" && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                          {status.label}
                        </Badge>
                        {p.billing_type === "recurring" && p.billing_interval && (
                          <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                            <RefreshCw className="h-3 w-3 mr-0.5" />
                            {intervalLabel[p.billing_interval] || p.billing_interval}
                            {p.billing_count && p.billing_count > 1 ? ` (${p.billing_count}x)` : ""}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(p.created_at).toLocaleDateString("pt-BR")} • {p.price === 0 ? "Grátis" : `R$ ${Number(p.price).toFixed(2)}`}
                      </p>
                      {p.billing_type === "recurring" && p.next_renewal_date && (
                        <p className="text-[10px] text-primary mt-0.5">
                          <RefreshCw className="h-3 w-3 inline mr-0.5" />
                          Próxima renovação: {new Date(p.next_renewal_date).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                      {p.displayStatus === "adjustment" && p.adjustment_message && (
                        <p className="text-xs text-warning mt-1 italic">
                          Ajuste: "{p.adjustment_message.substring(0, 80)}{p.adjustment_message.length > 80 ? '...' : ''}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mt-3">
                    {/* Adjustment button - within 48h of delivery */}
                    {p.canAdjust && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setAdjustPurchase(p);
                          setAdjustOpen(true);
                        }}
                      >
                        <Wrench className="h-4 w-4 mr-1" />
                        Solicitar ajuste
                      </Button>
                    )}

                    {/* Review button - after 5 days */}
                    {p.canReview && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setReviewPurchase(p);
                          setReviewOpen(true);
                        }}
                      >
                        <Star className="h-4 w-4 mr-1" />
                        Avaliar
                      </Button>
                    )}

                    {/* Cancel recurrence */}
                    {p.billing_type === "recurring" && p.next_renewal_date && p.status !== "cancelled" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-destructive hover:text-destructive"
                            disabled={cancelling === p.id}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            {cancelling === p.id ? "Cancelando..." : "Cancelar recorrência"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancelar recorrência?</AlertDialogTitle>
                            <AlertDialogDescription>
                              A cobrança recorrente será cancelada e o vendedor será notificado. Você manterá acesso ao conteúdo já entregue.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Voltar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => cancelRecurrence(p.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Confirmar cancelamento
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              );
            })}
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
            <SheetTitle className="text-foreground">Avaliar serviço</SheetTitle>
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

export default MyPurchases;
