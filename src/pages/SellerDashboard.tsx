import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Package, DollarSign, Star, BarChart3, Users, Edit, Eye, EyeOff, Wrench, XCircle, AlertTriangle, Dumbbell, UtensilsCrossed, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";

const SellerDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const defaultTab = searchParams.get("tab") || "services";
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refunding, setRefunding] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let { data: sp } = await supabase
      .from("seller_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sp) {
      const { data: newSp, error } = await supabase
        .from("seller_profiles")
        .insert({ user_id: user.id } as any)
        .select()
        .single();
      if (error) {
        toast({ title: "Erro ao criar perfil de vendedor", variant: "destructive" });
        setLoading(false);
        return;
      }
      sp = newSp;
    }
    setSellerProfile(sp);

    const { data: svcData } = await supabase
      .from("marketplace_services")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setServices(svcData || []);

    // Load purchases (as seller) with service info
    const { data: purchData } = await supabase
      .from("service_purchases")
      .select("*")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (purchData && purchData.length > 0) {
      const svcIds = [...new Set(purchData.map(p => p.service_id))];
      const buyerIds = [...new Set(purchData.map(p => p.buyer_id))];
      const purchaseIds = purchData.map(p => p.id);
      
      const [{ data: svcInfo }, { data: buyerInfo }, { data: deliveries }] = await Promise.all([
        supabase.from("marketplace_services").select("id, title, category, delivery_time_days, billing_type, billing_interval, billing_count").in("id", svcIds),
        supabase.from("profiles").select("user_id, full_name, username").in("user_id", buyerIds),
        supabase.from("service_deliveries")
          .select("purchase_id, created_at, linked_program_id, linked_diet_id")
          .in("purchase_id", purchaseIds)
          .order("created_at", { ascending: false }),
      ]);
      
      const svcMap = new Map((svcInfo || []).map(s => [s.id, s]));
      const buyerMap = new Map((buyerInfo || []).map(b => [b.user_id, b]));

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

      setPurchases(purchData.map(p => {
        const svc = svcMap.get(p.service_id);
        const buyer = buyerMap.get(p.buyer_id);
        const lastDel = lastDeliveryMap.get(p.id);
        
        let deliveredPlanName: string | null = null;
        if (lastDel?.linked_program_id) deliveredPlanName = programMap.get(lastDel.linked_program_id) || null;
        if (lastDel?.linked_diet_id) deliveredPlanName = dietMap.get(lastDel.linked_diet_id) || null;

        // Compute display status for seller view
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

        return {
          ...p,
          service_title: svc?.title || "Serviço",
          service_category: svc?.category,
          billing_type: svc?.billing_type || "one_time",
          billing_interval: svc?.billing_interval || null,
          billing_count: svc?.billing_count || null,
          buyer_name: buyer?.full_name || buyer?.username || "Comprador",
          displayStatus,
          deliveredPlanName,
        };
      }));
    } else {
      setPurchases([]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Auto-confirm any pending purchases that may have been paid
  useEffect(() => {
    if (!user || purchases.length === 0) return;
    const pendingPurchases = purchases.filter(p => p.status === "pending");
    if (pendingPurchases.length === 0) return;

    const confirmAll = async () => {
      const results = await Promise.all(
        pendingPurchases.map(p =>
          supabase.functions.invoke("marketplace-confirm-purchase", {
            body: { purchase_id: p.id },
          })
        )
      );
      const anyConfirmed = results.some(r => r.data?.status === "paid");
      if (anyConfirmed) {
        toast({ title: "Pagamento(s) confirmado(s)! ✅" });
        load();
      }
    };
    confirmAll();
  }, [purchases.length]); // only run when purchases list changes

  const paidStatuses = ["paid", "delivered", "completed"];
  const totalRevenue = purchases
    .filter(p => paidStatuses.includes(p.status))
    .reduce((acc, p) => acc + Number(p.price), 0);
  const totalSales = purchases.filter(p => paidStatuses.includes(p.status)).length;
  const activeClients = purchases.filter(p => ["paid", "delivered"].includes(p.status) && p.next_renewal_date).length;

  const toggleServiceStatus = async (serviceId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    await supabase
      .from("marketplace_services")
      .update({ status: newStatus })
      .eq("id", serviceId);
    load();
  };

  const handleRefund = async (purchaseId: string) => {
    setRefunding(purchaseId);
    try {
      const { data, error } = await supabase.functions.invoke("marketplace-refund", {
        body: { purchase_id: purchaseId },
      });
      if (error) throw error;
      toast({ title: "Compra cancelada e reembolso processado" });
      load();
    } catch (err: any) {
      toast({ title: "Erro ao processar reembolso", description: err.message, variant: "destructive" });
    }
    setRefunding(null);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-display font-semibold text-foreground">Painel do Vendedor</h1>
      </div>

      <div className="px-4 pt-4 space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-4">
            <DollarSign className="h-5 w-5 text-primary mb-1" />
            <p className="text-xl font-display font-bold text-foreground">R$ {totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Receita total</p>
          </div>
          <div className="glass-card p-4">
            <Package className="h-5 w-5 text-info mb-1" />
            <p className="text-xl font-display font-bold text-foreground">{totalSales}</p>
            <p className="text-xs text-muted-foreground">Vendas</p>
          </div>
          <div className="glass-card p-4">
            <Star className="h-5 w-5 text-warning mb-1" />
            <p className="text-xl font-display font-bold text-foreground">
              {sellerProfile?.average_rating ? Number(sellerProfile.average_rating).toFixed(1) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Avaliação</p>
          </div>
          <div className="glass-card p-4">
            <Users className="h-5 w-5 text-primary mb-1" />
            <p className="text-xl font-display font-bold text-foreground">{activeClients}</p>
            <p className="text-xs text-muted-foreground">Clientes ativos</p>
          </div>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full bg-secondary/50">
            <TabsTrigger value="services" className="flex-1">Serviços</TabsTrigger>
            <TabsTrigger value="orders" className="flex-1">
              Pedidos
              {purchases.filter(p => p.displayStatus === "adjustment" || p.displayStatus === "overdue").length > 0 && (
                <span className="ml-1 h-2 w-2 rounded-full bg-destructive inline-block" />
              )}
            </TabsTrigger>
            <TabsTrigger value="library" className="flex-1">Biblioteca</TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="space-y-3 mt-4">
            <Button
              onClick={() => navigate("/create-service")}
              className="w-full gradient-primary text-primary-foreground"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Serviço
            </Button>

            {services.length === 0 ? (
              <div className="text-center py-10">
                <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado</p>
              </div>
            ) : (
              services.map(svc => (
                <div key={svc.id} className="glass-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold text-foreground truncate">{svc.title}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">
                          {svc.category === "workout" ? "Treino" : "Dieta"}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${svc.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                        >
                          {svc.status === "active" ? "Ativo" : svc.status === "paused" ? "Pausado" : "Rascunho"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] bg-info/10 text-info">
                          {svc.billing_type === "recurring" ? (
                            <>
                              <RefreshCw className="h-3 w-3 mr-0.5" />
                              {svc.billing_interval === "daily" ? "Diário" : svc.billing_interval === "weekly" ? "Semanal" : svc.billing_interval === "monthly" ? "Mensal" : svc.billing_interval === "quarterly" ? "Trimestral" : "Recorrente"}
                              {svc.billing_count && svc.billing_count > 1 ? ` (${svc.billing_count}x)` : ""}
                            </>
                          ) : "Pagamento único"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {purchases.filter(p => ["paid", "delivered", "completed"].includes(p.status) && p.service_id === svc.id).length} vendas • {svc.is_free ? "Grátis" : `R$ ${Number(svc.price).toFixed(2)}`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleServiceStatus(svc.id, svc.status)}
                      >
                        {svc.status === "active" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigate(`/edit-service/${svc.id}`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="orders" className="space-y-3 mt-4">
            {purchases.length === 0 ? (
              <div className="text-center py-10">
                <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum pedido ainda</p>
              </div>
            ) : (
              purchases.map(p => {
                const status = statusMap[p.displayStatus] || statusMap.pending;
                return (
                  <div key={p.id} className="glass-card p-4 cursor-pointer" onClick={() => navigate(`/seller-order/${p.id}`)}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.service_title}</p>
                        {p.deliveredPlanName && (
                          <p className="text-xs text-primary/80 truncate">📋 {p.deliveredPlanName}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {p.buyer_name} • {new Date(p.created_at).toLocaleDateString("pt-BR")}
                        </p>
                        {p.billing_type === "recurring" && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                              <RefreshCw className="h-3 w-3 mr-0.5" />
                              Recorrente
                            </Badge>
                            {p.next_renewal_date && (
                              <span className="text-[10px] text-muted-foreground">
                                Renova: {new Date(p.next_renewal_date).toLocaleDateString("pt-BR")}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-foreground">
                          {p.price === 0 ? "Grátis" : `R$ ${Number(p.price).toFixed(2)}`}
                        </p>
                        <Badge variant="secondary" className={`text-[10px] ${status.color}`}>
                          {p.displayStatus === "overdue" && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                          {p.displayStatus === "adjustment" && <Wrench className="h-3 w-3 mr-0.5" />}
                          {status.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Show adjustment message */}
                    {p.displayStatus === "adjustment" && p.adjustment_message && (
                      <div className="mt-2 p-2 rounded-lg bg-warning/5 border border-warning/20">
                        <p className="text-xs text-warning font-medium mb-0.5">Solicitação de ajuste:</p>
                        <p className="text-xs text-muted-foreground">{p.adjustment_message}</p>
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      {/* Deliver / Re-deliver for paid, in_progress, overdue, adjustment */}
                      {["paid", "in_progress", "overdue", "adjustment"].includes(p.displayStatus) && (
                        <Button
                          size="sm"
                          className="flex-1 gradient-primary text-primary-foreground"
                          onClick={() => navigate(`/deliver/${p.id}`)}
                        >
                          {p.displayStatus === "adjustment" ? "Reenviar ajustado" : "Preparar serviço"}
                        </Button>
                      )}

                      {/* Cancel & refund option for adjustment status */}
                      {p.displayStatus === "adjustment" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive border-destructive/30"
                              disabled={refunding === p.id}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              {refunding === p.id ? "..." : "Cancelar"}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancelar e reembolsar?</AlertDialogTitle>
                              <AlertDialogDescription>
                                A compra será cancelada e o valor será reembolsado ao comprador no mesmo método de pagamento. Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Voltar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRefund(p.id)}
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
              })
            )}
          </TabsContent>

          <TabsContent value="library" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">
              Pré-cadastre treinos, dietas e materiais para entregar rapidamente aos clientes.
            </p>

            {/* Quick create */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate("/seller-templates?create=workout")}
                className="p-4 text-left rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                <Dumbbell className="h-6 w-6 text-primary mb-2" />
                <p className="text-sm font-display font-semibold text-foreground">Criar Treino</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Template de treino para venda</p>
              </button>
              <button
                onClick={() => navigate("/seller-templates?create=diet")}
                className="p-4 text-left rounded-xl border border-info/30 bg-info/10 hover:bg-info/20 transition-colors"
              >
                <UtensilsCrossed className="h-6 w-6 text-info mb-2" />
                <p className="text-sm font-display font-semibold text-foreground">Criar Dieta</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Template de dieta para venda</p>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button className="flex-1 gradient-primary text-primary-foreground" onClick={() => navigate("/seller-templates")}>
                📋 Templates
              </Button>
              <Button className="flex-1 gradient-primary text-primary-foreground" onClick={() => navigate("/seller-materials")}>
                📁 Materiais de apoio
              </Button>
            </div>

          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
};

export default SellerDashboard;
