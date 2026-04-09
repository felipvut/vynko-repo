import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Star, ShoppingBag, Clock, Users, MessageCircle, Share2, Shield, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const ServiceDetail = () => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [service, setService] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (!serviceId) return;
    loadService();
  }, [serviceId]);

  const loadService = async () => {
    setLoading(true);

    const [
      { data: svc },
      { data: mediaData },
      { data: reviewsData },
    ] = await Promise.all([
      supabase.from("marketplace_services").select("*").eq("id", serviceId).single(),
      supabase.from("service_media").select("*").eq("service_id", serviceId!).order("media_order"),
      supabase.from("service_reviews").select("*").eq("service_id", serviceId!).order("created_at", { ascending: false }).limit(10),
    ]);

    if (svc) {
      setService(svc);
      const { data: sellerData } = await supabase
        .from("seller_profiles")
        .select("*")
        .eq("id", svc.seller_id)
        .single();
      setSeller(sellerData);

      if (sellerData) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", sellerData.user_id)
          .single();
        setSellerProfile(profile);
      }
    }

    setMedia(mediaData || []);

    // Enrich reviews with reviewer names
    if (reviewsData && reviewsData.length > 0) {
      const reviewerIds = reviewsData.map((r: any) => r.reviewer_id);
      const { data: reviewerProfiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", reviewerIds);
      const profMap = new Map((reviewerProfiles || []).map(p => [p.user_id, p]));
      setReviews(reviewsData.map((r: any) => ({
        ...r,
        reviewer_name: profMap.get(r.reviewer_id)?.full_name || "Usuário",
        reviewer_avatar: profMap.get(r.reviewer_id)?.avatar_url || null,
      })));
    }

    setLoading(false);
  };

  const handlePurchase = async () => {
    if (!user || !service) return;
    if (service.user_id === user.id) {
      toast({ title: "Você não pode comprar seu próprio serviço", variant: "destructive" });
      return;
    }

    setPurchasing(true);

    if (service.is_free) {
      // Direct free purchase
      const { error } = await supabase.from("service_purchases").insert({
        service_id: service.id,
        buyer_id: user.id,
        seller_id: service.user_id,
        price: 0,
        status: "paid",
      } as any);

      if (error) {
        toast({ title: "Erro ao adquirir serviço", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Serviço adquirido com sucesso! 🎉" });
        navigate("/my-purchases");
      }
    } else {
      // Stripe checkout
      try {
        const { data, error } = await supabase.functions.invoke("marketplace-checkout", {
          body: { service_id: service.id },
        });
        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
        }
      } catch (err: any) {
        toast({ title: "Erro ao processar pagamento", description: err.message, variant: "destructive" });
      }
    }
    setPurchasing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Serviço não encontrado</p>
        <Button variant="outline" onClick={() => navigate("/marketplace")}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-display font-semibold text-foreground truncate flex-1">{service.title}</h1>
      </div>

      {/* Cover */}
      {service.cover_image_url && (
        <div className="aspect-video w-full overflow-hidden">
          <img src={service.cover_image_url} alt={service.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Media gallery */}
      {media.length > 0 && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
          {media.map((m: any) => (
            <div key={m.id} className="shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-border/50">
              {m.media_type === "photo" ? (
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <video src={m.url} className="w-full h-full object-cover" />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-4 space-y-6">
        {/* Title & Category */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-display font-bold text-foreground">{service.title}</h2>
            <Badge className={`shrink-0 ${service.category === "workout" ? "bg-primary/20 text-primary" : "bg-info/20 text-info"}`}>
              {service.category === "workout" ? "Treino" : "Dieta"}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {service.average_rating > 0 && (
              <span className="flex items-center gap-0.5">
                <Star className="h-3.5 w-3.5 text-warning fill-warning" />
                {Number(service.average_rating).toFixed(1)} ({service.total_reviews})
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <TrendingUp className="h-3.5 w-3.5" />
              {service.total_sales} vendas
            </span>
            {service.delivery_time_days && (
              <span className="flex items-center gap-0.5">
                <Clock className="h-3.5 w-3.5" />
                Prazo de disponibilização: {service.delivery_time_days} {service.delivery_time_days === 1 ? "dia" : "dias"}
              </span>
            )}
          </div>
        </div>

        {/* Billing info */}
        {service.billing_type === "recurring" && service.billing_interval && (
          <div className="glass-card p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">🔄</div>
            <div>
              <p className="text-sm font-display font-semibold text-foreground">Serviço recorrente</p>
              <p className="text-xs text-muted-foreground">
                Cobrança {service.billing_interval === "daily" ? "diária" : service.billing_interval === "weekly" ? "semanal" : service.billing_interval === "monthly" ? "mensal" : "trimestral"}
                {service.billing_count && service.billing_count > 1 ? ` (a cada ${service.billing_count} ${service.billing_interval === "daily" ? "dias" : service.billing_interval === "weekly" ? "semanas" : service.billing_interval === "monthly" ? "meses" : "trimestres"})` : ""}
                {" "}— você recebe atualizações do plano a cada ciclo
              </p>
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <h3 className="text-sm font-display font-semibold text-foreground mb-1">Descrição</h3>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{service.description}</p>
        </div>

        <Separator className="bg-border/50" />

        {/* Seller card */}
        {sellerProfile && (
          <button
            onClick={() => navigate(`/seller/${seller?.user_id}`)}
            className="glass-card p-4 w-full text-left"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={sellerProfile.avatar_url || undefined} />
                <AvatarFallback className="bg-secondary text-sm">
                  {(sellerProfile.full_name || "V")[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-semibold text-foreground truncate">
                    {sellerProfile.full_name}
                  </span>
                  {seller?.is_verified && (
                    <Shield className="h-4 w-4 text-primary shrink-0" />
                  )}
                </div>
                {seller?.specialty && (
                  <p className="text-xs text-muted-foreground">{seller.specialty}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {seller?.average_rating > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3 text-warning fill-warning" />
                      {Number(seller.average_rating).toFixed(1)}
                    </span>
                  )}
                  <span>{seller?.total_sales || 0} vendas</span>
                </div>
              </div>
            </div>
          </button>
        )}

        <Separator className="bg-border/50" />

        {/* Reviews */}
        {reviews.length > 0 && (
          <div>
            <h3 className="text-sm font-display font-semibold text-foreground mb-3">
              Avaliações ({service.total_reviews})
            </h3>
            <div className="space-y-3">
              {reviews.map((review: any) => (
                <div key={review.id} className="glass-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={review.reviewer_avatar || undefined} />
                      <AvatarFallback className="text-[10px] bg-secondary">
                        {(review.reviewer_name || "U")[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-foreground">{review.reviewer_name}</span>
                    <div className="flex items-center gap-0.5 ml-auto">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${i < review.rating ? "text-warning fill-warning" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-xs text-muted-foreground">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom purchase bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/50 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <span className={`text-xl font-display font-bold ${service.is_free ? "text-primary" : "text-foreground"}`}>
              {service.is_free ? "Grátis" : `R$ ${Number(service.price).toFixed(2)}`}
            </span>
            {service.billing_type === "recurring" && service.billing_interval && (
              <span className="text-xs text-muted-foreground ml-1">
                🔄 {service.billing_interval === "daily" ? "/dia" : service.billing_interval === "weekly" ? "/semana" : service.billing_interval === "monthly" ? "/mês" : "/trimestre"}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!user || !service) return;
                // Check existing conversation or create one
                const { data: existing } = await supabase
                  .from("marketplace_conversations")
                  .select("id")
                  .eq("buyer_id", user.id)
                  .eq("seller_id", service.user_id)
                  .maybeSingle();

                if (existing) {
                  navigate(`/marketplace-chat/${existing.id}`);
                } else {
                  const { data: newConv, error } = await supabase
                    .from("marketplace_conversations")
                    .insert({
                      buyer_id: user.id,
                      seller_id: service.user_id,
                    } as any)
                    .select()
                    .single();
                  if (newConv) {
                    navigate(`/marketplace-chat/${newConv.id}`);
                  } else {
                    toast({ title: "Erro ao iniciar chat", variant: "destructive" });
                  }
                }
              }}
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              Chat
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={purchasing}
              className="gradient-primary text-primary-foreground font-semibold px-6"
            >
              {purchasing ? (
                <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                service.is_free ? "Adquirir" : "Comprar"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetail;
