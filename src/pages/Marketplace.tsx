import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, Star, ShoppingBag, TrendingUp, Clock, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import BottomNav from "@/components/BottomNav";
import NotificationBell from "@/components/NotificationBell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ServiceListing {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  is_free: boolean;
  cover_image_url: string | null;
  total_sales: number;
  average_rating: number;
  total_reviews: number;
  seller_id: string;
  seller_name: string | null;
  seller_avatar: string | null;
  seller_verified: boolean;
  seller_specialty: string | null;
  billing_type: string;
  billing_interval: string | null;
  delivery_time_days: number | null;
}

const Marketplace = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("popular");
  const [freeOnly, setFreeOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number[]>([500]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadServices = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("marketplace_services")
      .select("*")
      .eq("status", "active");

    if (category !== "all") {
      query = query.eq("category", category);
    }
    if (freeOnly) {
      query = query.eq("is_free", true);
    } else {
      query = query.lte("price", maxPrice[0]);
    }

    if (sortBy === "popular") {
      query = query.order("total_sales", { ascending: false });
    } else if (sortBy === "rating") {
      query = query.order("average_rating", { ascending: false });
    } else if (sortBy === "recent") {
      query = query.order("created_at", { ascending: false });
    } else if (sortBy === "sales") {
      query = query.order("total_sales", { ascending: false });
    }

    const { data: servicesData } = await query.limit(50);

    if (!servicesData || servicesData.length === 0) {
      setServices([]);
      setLoading(false);
      return;
    }

    // Get seller profiles and user profiles
    const sellerIds = [...new Set(servicesData.map((s: any) => s.seller_id))];
    const { data: sellers } = await supabase
      .from("seller_profiles")
      .select("id, user_id, is_verified, specialty")
      .in("id", sellerIds);

    const userIds = (sellers || []).map(s => s.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", userIds);

    const sellerMap = new Map((sellers || []).map(s => [s.id, s]));
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    const enriched: ServiceListing[] = servicesData.map((s: any) => {
      const seller = sellerMap.get(s.seller_id);
      const profile = seller ? profileMap.get(seller.user_id) : null;
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        category: s.category,
        price: s.price,
        is_free: s.is_free,
        cover_image_url: s.cover_image_url,
        total_sales: s.total_sales,
        average_rating: s.average_rating,
        total_reviews: s.total_reviews,
        seller_id: s.seller_id,
        seller_name: profile?.full_name || "Vendedor",
        seller_avatar: profile?.avatar_url || null,
        seller_verified: seller?.is_verified || false,
        seller_specialty: seller?.specialty || null,
        billing_type: s.billing_type || "one_time",
        billing_interval: s.billing_interval || null,
        delivery_time_days: s.delivery_time_days || null,
      };
    });

    // Apply search filter client-side
    const filtered = search
      ? enriched.filter(s =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          s.description.toLowerCase().includes(search.toLowerCase()) ||
          (s.seller_name || "").toLowerCase().includes(search.toLowerCase())
        )
      : enriched;

    setServices(filtered);
    setLoading(false);
  }, [category, sortBy, freeOnly, maxPrice, search]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-display font-bold text-foreground">Marketplace</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/my-purchases")}
              className="text-xs"
            >
              Comprar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/seller-dashboard")}
              className="text-xs"
            >
              Vender
            </Button>
            <NotificationBell />
          </div>
        </div>

        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar serviços..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-secondary/50 border-border/50"
            />
          </div>
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Filter className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-card rounded-t-2xl">
              <SheetHeader>
                <SheetTitle className="text-foreground">Filtros</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 py-4">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="workout">Treino</SelectItem>
                      <SelectItem value="diet">Dieta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Ordenar por</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="popular">Mais populares</SelectItem>
                      <SelectItem value="rating">Melhor avaliados</SelectItem>
                      <SelectItem value="sales">Mais vendidos</SelectItem>
                      <SelectItem value="recent">Mais recentes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Apenas gratuitos</Label>
                  <Switch checked={freeOnly} onCheckedChange={setFreeOnly} />
                </div>

                {!freeOnly && (
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">
                      Preço máximo: R$ {maxPrice[0]}
                    </Label>
                    <Slider
                      value={maxPrice}
                      onValueChange={setMaxPrice}
                      max={1000}
                      step={10}
                      className="mt-2"
                    />
                  </div>
                )}

                <Button className="w-full" onClick={() => setFiltersOpen(false)}>
                  Aplicar filtros
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
          {[
            { value: "all", label: "Todos" },
            { value: "workout", label: "🏋️ Treino" },
            { value: "diet", label: "🥗 Dieta" },
          ].map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                category === cat.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-display font-semibold text-foreground mb-2">
              Nenhum serviço encontrado
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Seja o primeiro a oferecer seus serviços!
            </p>
            <Button onClick={() => navigate("/seller-dashboard")} className="gradient-primary text-primary-foreground">
              Começar a vender
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map(service => (
              <button
                key={service.id}
                onClick={() => navigate(`/marketplace/${service.id}`)}
                className="glass-card overflow-hidden text-left transition-transform active:scale-[0.98]"
              >
                {service.cover_image_url && (
                  <div className="aspect-video w-full overflow-hidden">
                    <img
                      src={service.cover_image_url}
                      alt={service.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold text-foreground truncate">
                        {service.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {service.description}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`shrink-0 text-[10px] ${
                        service.category === "workout"
                          ? "bg-primary/20 text-primary"
                          : "bg-info/20 text-info"
                      }`}
                    >
                      {service.category === "workout" ? "Treino" : "Dieta"}
                    </Badge>
                  </div>

                  {/* Seller info */}
                  <div className="flex items-center gap-2 mb-3">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={service.seller_avatar || undefined} />
                      <AvatarFallback className="text-[10px] bg-secondary">
                        {(service.seller_name || "V")[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground truncate">
                      {service.seller_name}
                    </span>
                    {service.seller_verified && (
                      <Badge variant="secondary" className="text-[9px] bg-primary/10 text-primary px-1">
                        ✓ Verificado
                      </Badge>
                    )}
                  </div>

                  {/* Stats & Price */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {service.average_rating > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 text-warning fill-warning" />
                          {service.average_rating.toFixed(1)}
                        </span>
                      )}
                       {service.total_sales > 0 && (
                        <span className="flex items-center gap-0.5">
                          <TrendingUp className="h-3 w-3" />
                          {service.total_sales} vendas
                        </span>
                      )}
                      {service.delivery_time_days && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {service.delivery_time_days}d
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`font-display font-bold text-sm ${service.is_free ? "text-primary" : "text-foreground"}`}>
                        {service.is_free ? "Grátis" : `R$ ${service.price.toFixed(2)}`}
                      </span>
                      {service.billing_type === "recurring" && service.billing_interval && (
                        <span className="block text-[10px] text-muted-foreground">
                          🔄 {service.billing_interval === "daily" ? "/dia" : service.billing_interval === "weekly" ? "/semana" : service.billing_interval === "monthly" ? "/mês" : "/trimestre"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Marketplace;
