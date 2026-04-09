import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Star, Shield, Clock, MessageCircle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import AvatarWithBadge from "@/components/profile/AvatarWithBadge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";

const SellerPublicProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    loadSeller();
  }, [userId]);

  const loadSeller = async () => {
    setLoading(true);

    const [{ data: prof }, { data: sp }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId!).single(),
      supabase.from("seller_profiles").select("*").eq("user_id", userId!).single(),
    ]);

    setProfile(prof);
    setSeller(sp);

    if (sp) {
      const { data: svcData } = await supabase
        .from("marketplace_services")
        .select("*")
        .eq("seller_id", sp.id)
        .eq("status", "active")
        .order("total_sales", { ascending: false });
      setServices(svcData || []);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile || !seller) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Vendedor não encontrado</p>
        <Button variant="outline" onClick={() => navigate("/marketplace")}>Voltar</Button>
      </div>
    );
  }

  const memberSince = new Date(seller.created_at);
  const monthsOnPlatform = Math.max(1, Math.floor((Date.now() - memberSince.getTime()) / (30 * 24 * 60 * 60 * 1000)));

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-display font-semibold text-foreground truncate">{profile.full_name}</h1>
      </div>

      <div className="px-4 pt-6 space-y-6">
        {/* Profile header */}
        <div className="flex items-center gap-4">
          <AvatarWithBadge
            userId={userId!}
            avatarUrl={profile.avatar_url}
            fallback={(profile.full_name || "V")[0]}
            className="h-20 w-20"
            fallbackClassName="bg-secondary text-2xl"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-display font-bold text-foreground">{profile.full_name}</h2>
              {seller.is_verified && <Shield className="h-5 w-5 text-primary" />}
            </div>
            {seller.specialty && (
              <p className="text-sm text-primary">{seller.specialty}</p>
            )}
            {profile.bio && (
              <p className="text-xs text-muted-foreground mt-1">{profile.bio}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="glass-card p-3 text-center">
            <p className="text-lg font-display font-bold text-foreground">
              {seller.average_rating ? Number(seller.average_rating).toFixed(1) : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">Avaliação</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-lg font-display font-bold text-foreground">{seller.total_sales}</p>
            <p className="text-[10px] text-muted-foreground">Vendas</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-lg font-display font-bold text-foreground">{Math.round(Number(seller.response_rate))}%</p>
            <p className="text-[10px] text-muted-foreground">Resposta</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-lg font-display font-bold text-foreground">{monthsOnPlatform}m</p>
            <p className="text-[10px] text-muted-foreground">Na plataforma</p>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Services */}
        <div>
          <h3 className="text-sm font-display font-semibold text-foreground mb-3">
            Serviços ({services.length})
          </h3>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum serviço disponível</p>
          ) : (
            <div className="space-y-3">
              {services.map(svc => (
                <button
                  key={svc.id}
                  onClick={() => navigate(`/marketplace/${svc.id}`)}
                  className="glass-card p-4 w-full text-left transition-transform active:scale-[0.98]"
                >
                  <div className="flex items-start gap-3">
                    {svc.cover_image_url && (
                      <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden">
                        <img src={svc.cover_image_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-foreground truncate">{svc.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {svc.category === "workout" ? "Treino" : "Dieta"}
                        </Badge>
                        {svc.average_rating > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Star className="h-2.5 w-2.5 text-warning fill-warning" />
                            {Number(svc.average_rating).toFixed(1)}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm font-bold mt-1 ${svc.is_free ? "text-primary" : "text-foreground"}`}>
                        {svc.is_free ? "Grátis" : `R$ ${Number(svc.price).toFixed(2)}`}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SellerPublicProfile;
