import { useState, useMemo } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Users, Share2, Copy, TrendingUp,
  UserCheck, Calendar,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

const AffiliateDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: affiliate, isLoading } = useQuery({
    queryKey: ["my-affiliate", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("affiliates")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: referrals } = useQuery({
    queryKey: ["affiliate-referrals", affiliate?.id, startDate, endDate],
    queryFn: async () => {
      if (!affiliate) return [];
      const { data } = await supabase
        .from("affiliate_referrals")
        .select("id, referred_user_id, created_at")
        .eq("affiliate_id", (affiliate as any).id)
        .gte("created_at", startOfDay(new Date(startDate)).toISOString())
        .lte("created_at", endOfDay(new Date(endDate)).toISOString())
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!affiliate && (affiliate as any).status === "approved",
  });

  const { data: referralProfiles } = useQuery({
    queryKey: ["referral-profiles", referrals?.map((r: any) => r.referred_user_id)],
    queryFn: async () => {
      if (!referrals?.length) return [];
      const ids = referrals.map((r: any) => r.referred_user_id);
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, full_name, avatar_url, created_at")
        .in("user_id", ids);
      return data ?? [];
    },
    enabled: !!referrals && referrals.length > 0,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!affiliate || (affiliate as any).status !== "approved") {
    return <Navigate to="/affiliate-register" />;
  }

  const referralLink = `${window.location.origin}/auth?ref=${(affiliate as any).referral_code}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Link copiado!");
  };

  const totalReferrals = referrals?.length ?? 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-gradient-to-br from-primary/20 to-background p-6 pb-4">
        <button onClick={() => navigate("/profile")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Dashboard de Afiliado</h1>
        {(affiliate as any).category && (
          <Badge variant="secondary" className="mt-2">{(affiliate as any).category}</Badge>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Referral Link */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Share2 className="w-4 h-4" /> Seu link de afiliação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={referralLink} readOnly className="text-xs bg-muted" />
              <Button size="sm" variant="outline" onClick={copyLink}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Código: <span className="font-mono font-bold text-foreground">{(affiliate as any).referral_code}</span></p>
          </CardContent>
        </Card>

        {/* Date Filter */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-border">
            <CardContent className="pt-4 text-center">
              <Users className="w-6 h-6 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{totalReferrals}</p>
              <p className="text-xs text-muted-foreground">Cadastrados</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 text-center">
              <TrendingUp className="w-6 h-6 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{totalReferrals}</p>
              <p className="text-xs text-muted-foreground">No período</p>
            </CardContent>
          </Card>
        </div>

        {/* Referral List */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Usuários indicados</CardTitle>
          </CardHeader>
          <CardContent>
            {!referrals?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário indicado neste período</p>
            ) : (
              <div className="space-y-2">
                {referrals.map((r: any) => {
                  const profile = referralProfiles?.find((p: any) => p.user_id === r.referred_user_id);
                  return (
                    <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} className="w-full h-full object-cover" />
                          ) : (
                            <Users className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{profile?.full_name || profile?.username || "Usuário"}</p>
                          <p className="text-xs text-muted-foreground">@{profile?.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(r.created_at), "dd/MM/yyyy")}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
};

export default AffiliateDashboard;
