import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Dumbbell, UtensilsCrossed, FileText, Clock, Send, Wrench, Eye, Trash2, Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";

const SellerOrderDetail = () => {
  const { purchaseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [purchase, setPurchase] = useState<any>(null);
  const [service, setService] = useState<any>(null);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null); // delivery id being edited
  const [editTitleValue, setEditTitleValue] = useState("");

  // Content cache per delivery
  const [deliveryContent, setDeliveryContent] = useState<Record<string, { program?: any; days?: any[]; diet?: any; meals?: any[]; materials?: any[] }>>({});

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
      navigate("/seller-dashboard?tab=orders");
      return;
    }
    setPurchase(purch);

    const [{ data: svc }, { data: buyer }, { data: dels }] = await Promise.all([
      supabase.from("marketplace_services").select("*").eq("id", purch.service_id).single(),
      supabase.from("profiles").select("*").eq("user_id", purch.buyer_id).single(),
      supabase.from("service_deliveries").select("*").eq("purchase_id", purchaseId).order("created_at", { ascending: false }),
    ]);

    setService(svc);
    setBuyerProfile(buyer);
    setDeliveries(dels || []);

    // Auto-expand the latest delivery
    if (dels && dels.length > 0) {
      setExpandedDelivery(dels[0].id);
      await loadDeliveryContent(dels[0]);
    }

    setLoading(false);
  }, [user, purchaseId]);

  useEffect(() => { load(); }, [load]);

  const loadDeliveryContent = async (delivery: any) => {
    if (deliveryContent[delivery.id]) return;

    const content: any = {};
    const promises: Promise<any>[] = [];

    if (delivery.linked_program_id) {
      promises.push(
        Promise.resolve(supabase.from("training_programs").select("*").eq("id", delivery.linked_program_id).single())
          .then(async ({ data: prog }) => {
            content.program = prog;
            if (prog) {
              const { data: days } = await supabase
                .from("workout_days")
                .select("*, exercises(*)")
                .eq("program_id", prog.id)
                .order("day_order");
              content.days = days || [];
            }
          })
      );
    }

    if (delivery.linked_diet_id) {
      promises.push(
        Promise.resolve(supabase.from("diet_plans").select("*").eq("id", delivery.linked_diet_id).single())
          .then(async ({ data: diet }) => {
            content.diet = diet;
            if (diet) {
              const { data: meals } = await supabase
                .from("diet_meals")
                .select("*")
                .eq("diet_plan_id", diet.id)
                .order("meal_order");
              content.meals = meals || [];
            }
          })
      );
    }

    promises.push(
      Promise.resolve(supabase.from("delivery_materials").select("*, seller_materials(*)").eq("delivery_id", delivery.id))
        .then(({ data }) => { content.materials = data || []; })
    );

    await Promise.all(promises);
    setDeliveryContent(prev => ({ ...prev, [delivery.id]: content }));
  };

  const toggleDelivery = async (delivery: any) => {
    if (expandedDelivery === delivery.id) {
      setExpandedDelivery(null);
    } else {
      setExpandedDelivery(delivery.id);
      await loadDeliveryContent(delivery);
    }
  };

  const saveTitle = async (deliveryId: string, type: "program" | "diet") => {
    const content = deliveryContent[deliveryId];
    if (!content || !editTitleValue.trim()) return;
    const table = type === "program" ? "training_programs" : "diet_plans";
    const id = type === "program" ? content.program?.id : content.diet?.id;
    if (!id) return;

    const { error } = await supabase.from(table).update({ name: editTitleValue.trim() } as any).eq("id", id);
    if (error) {
      toast({ title: "Erro ao renomear", variant: "destructive" });
    } else {
      setDeliveryContent(prev => ({
        ...prev,
        [deliveryId]: {
          ...prev[deliveryId],
          ...(type === "program"
            ? { program: { ...prev[deliveryId].program, name: editTitleValue.trim() } }
            : { diet: { ...prev[deliveryId].diet, name: editTitleValue.trim() } }),
        },
      }));
      toast({ title: "Título atualizado! ✅" });
    }
    setEditingTitle(null);
  };

  const isWorkout = service?.category === "workout";

  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: "Pendente", color: "bg-muted text-muted-foreground" },
    paid: { label: "Pago", color: "bg-warning/10 text-warning" },
    delivered: { label: "Enviado", color: "bg-info/10 text-info" },
    adjustment: { label: "Em ajuste", color: "bg-warning/10 text-warning" },
    completed: { label: "Concluído", color: "bg-primary/10 text-primary" },
    refunded: { label: "Reembolsado", color: "bg-destructive/10 text-destructive" },
    cancelled: { label: "Cancelado", color: "bg-destructive/10 text-destructive" },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const status = statusMap[purchase?.status] || statusMap.pending;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/seller-dashboard?tab=orders")} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-semibold text-foreground truncate">{service?.title || "Pedido"}</h1>
          <p className="text-xs text-muted-foreground">
            {buyerProfile?.full_name || buyerProfile?.username} • {purchase?.price === 0 ? "Grátis" : `R$ ${Number(purchase?.price).toFixed(2)}`}
          </p>
        </div>
        <Badge variant="secondary" className={`text-[10px] ${status.color}`}>
          {status.label}
        </Badge>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Purchase info */}
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Comprador</span>
            <span className="text-sm font-medium text-foreground">{buyerProfile?.full_name || buyerProfile?.username}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Data da compra</span>
            <span className="text-sm text-foreground">{new Date(purchase?.created_at).toLocaleDateString("pt-BR")}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Categoria</span>
            <Badge variant="secondary" className="text-[10px]">{isWorkout ? "Treino" : "Dieta"}</Badge>
          </div>
          {purchase?.status === "adjustment" && purchase?.adjustment_message && (
            <div className="p-2 rounded-lg bg-warning/5 border border-warning/20 mt-2">
              <p className="text-xs text-warning font-medium mb-0.5">Ajuste solicitado:</p>
              <p className="text-xs text-muted-foreground">{purchase.adjustment_message}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {(["paid", "adjustment"].includes(purchase?.status)) && (
          <Button
            className="w-full gradient-primary text-primary-foreground"
            onClick={() => navigate(`/deliver/${purchase.id}`)}
          >
            <Send className="h-4 w-4 mr-2" />
            {purchase?.status === "adjustment" ? "Editar e reenviar ajuste" : "Preparar e enviar"}
          </Button>
        )}

        {/* No deliveries */}
        {deliveries.length === 0 && (
          <div className="glass-card p-6 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-display font-semibold text-foreground mb-1">Nenhuma entrega realizada</h3>
            <p className="text-sm text-muted-foreground">Ainda não foi enviado nenhum conteúdo para este pedido.</p>
          </div>
        )}

        {/* Deliveries */}
        {deliveries.map((del, idx) => {
          const isExpanded = expandedDelivery === del.id;
          const content = deliveryContent[del.id];

          return (
            <div key={del.id} className="glass-card overflow-hidden">
              <button
                className="w-full p-4 flex items-center justify-between text-left"
                onClick={() => toggleDelivery(del)}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-foreground">
                      {del.delivery_type === "initial" ? "Entrega inicial" : `Atualização ${deliveries.length - idx}`}
                    </h3>
                    <Badge variant="secondary" className="text-[10px]">
                      {del.delivery_type === "initial" ? "Inicial" : "Ajuste"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(del.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <Eye className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "text-primary" : ""}`} />
              </button>

              {isExpanded && content && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
                  {/* Workout content */}
                  {content.program && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Dumbbell className="h-4 w-4 text-primary" />
                        {editingTitle === `prog-${del.id}` ? (
                          <div className="flex items-center gap-1 flex-1">
                            <Input
                              value={editTitleValue}
                              onChange={e => setEditTitleValue(e.target.value)}
                              className="h-7 text-sm"
                              autoFocus
                              onKeyDown={e => { if (e.key === "Enter") saveTitle(del.id, "program"); if (e.key === "Escape") setEditingTitle(null); }}
                            />
                            <button onClick={() => saveTitle(del.id, "program")} className="p-1 text-primary"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setEditingTitle(null)} className="p-1 text-muted-foreground"><X className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <>
                            <h4 className="text-sm font-semibold text-foreground">{content.program.name}</h4>
                            <button onClick={() => { setEditingTitle(`prog-${del.id}`); setEditTitleValue(content.program.name); }} className="p-1 text-muted-foreground hover:text-foreground">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                      {content.program.description && (
                        <p className="text-xs text-muted-foreground">{content.program.description}</p>
                      )}
                      {(content.days || []).map((day: any, dayIdx: number) => (
                        <div key={day.id} className="bg-secondary/30 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-foreground">{day.name}</span>
                            {day.muscle_groups && <span className="text-[10px] text-muted-foreground">{day.muscle_groups}</span>}
                          </div>
                          {(day.exercises || [])
                            .sort((a: any, b: any) => (a.exercise_order || 0) - (b.exercise_order || 0))
                            .map((ex: any) => (
                              <div key={ex.id} className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground w-4 text-right">{ex.exercise_order}.</span>
                                <span className="flex-1">{ex.name}</span>
                                <span>{ex.sets}×{ex.reps}</span>
                              </div>
                            ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Diet content */}
                  {content.diet && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4 text-primary" />
                        {editingTitle === `diet-${del.id}` ? (
                          <div className="flex items-center gap-1 flex-1">
                            <Input
                              value={editTitleValue}
                              onChange={e => setEditTitleValue(e.target.value)}
                              className="h-7 text-sm"
                              autoFocus
                              onKeyDown={e => { if (e.key === "Enter") saveTitle(del.id, "diet"); if (e.key === "Escape") setEditingTitle(null); }}
                            />
                            <button onClick={() => saveTitle(del.id, "diet")} className="p-1 text-primary"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setEditingTitle(null)} className="p-1 text-muted-foreground"><X className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <>
                            <h4 className="text-sm font-semibold text-foreground">{content.diet.name}</h4>
                            <button onClick={() => { setEditingTitle(`diet-${del.id}`); setEditTitleValue(content.diet.name); }} className="p-1 text-muted-foreground hover:text-foreground">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                      <div className="flex gap-3 text-[10px] text-muted-foreground">
                        {content.diet.total_calories && <span>🔥 {content.diet.total_calories} kcal</span>}
                        {content.diet.protein_grams && <span>🥩 {content.diet.protein_grams}g P</span>}
                        {content.diet.carbs_grams && <span>🍚 {content.diet.carbs_grams}g C</span>}
                        {content.diet.fat_grams && <span>🧈 {content.diet.fat_grams}g G</span>}
                      </div>
                      {(content.meals || []).map((meal: any) => (
                        <div key={meal.id} className="bg-secondary/30 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-foreground">{meal.meal_name}</span>
                            <span className="text-[10px] text-muted-foreground">{meal.calories} kcal</span>
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-pre-line">{meal.foods}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Delivery notes */}
                  {del.notes && (
                    <div className="bg-secondary/30 rounded-lg p-3">
                      <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Observações
                      </p>
                      <p className="text-xs text-muted-foreground">{del.notes}</p>
                    </div>
                  )}

                  {/* Materials */}
                  {content.materials && content.materials.length > 0 && (
                    <div className="bg-secondary/30 rounded-lg p-3">
                      <p className="text-xs font-medium text-foreground mb-1">📎 Materiais</p>
                      {content.materials.map((m: any) => (
                        <p key={m.id} className="text-xs text-muted-foreground">{m.seller_materials?.title}</p>
                      ))}
                    </div>
                  )}

                  {purchase?.status === "adjustment" && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(`/deliver/${purchase.id}`)}
                    >
                      <Wrench className="h-4 w-4 mr-2" />
                      Editar esta entrega
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
};

export default SellerOrderDetail;
