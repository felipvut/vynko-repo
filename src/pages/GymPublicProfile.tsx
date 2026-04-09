import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Dumbbell, Users, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BottomNav from "@/components/BottomNav";

const GymPublicProfile = () => {
  const { gymId } = useParams<{ gymId: string }>();

  const { data: gym, isLoading } = useQuery({
    queryKey: ["gym-public", gymId],
    queryFn: async () => {
      const { data } = await supabase.from("gyms").select("*").eq("id", gymId!).single();
      return data;
    },
    enabled: !!gymId,
  });

  const { data: equipment } = useQuery({
    queryKey: ["gym-equipment", gymId],
    queryFn: async () => {
      const { data } = await supabase.from("gym_equipment").select("*").eq("gym_id", gymId!).order("category");
      return data ?? [];
    },
    enabled: !!gymId,
  });

  const { data: members } = useQuery({
    queryKey: ["gym-members", gymId],
    queryFn: async () => {
      const { data } = await supabase.from("gym_members").select("user_id").eq("gym_id", gymId!).eq("status", "active");
      if (!data?.length) return [];
      const userIds = data.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, full_name, avatar_url")
        .in("user_id", userIds);
      return profiles ?? [];
    },
    enabled: !!gymId,
  });

  const equipByCategory = equipment?.reduce<Record<string, typeof equipment>>((acc, eq) => {
    if (!acc[eq.category]) acc[eq.category] = [];
    acc[eq.category].push(eq);
    return acc;
  }, {}) ?? {};

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!gym) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
        <Dumbbell className="w-12 h-12 text-muted-foreground mb-4" />
        <p>Academia não encontrada</p>
        <Link to="/" className="text-primary mt-4">Voltar</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/20 to-background p-6 pb-8">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Dumbbell className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">{gym.name}</h1>
            <div className="flex items-center gap-1 text-muted-foreground mt-1">
              <MapPin className="w-3 h-3" />
              <span className="text-sm">{gym.city}, {gym.state}</span>
            </div>
            {gym.address && <p className="text-xs text-muted-foreground mt-0.5">{gym.address}</p>}
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{members?.length ?? 0} membros</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="w-4 h-4" />
            <span>{equipment?.length ?? 0} equipamentos</span>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-6 mt-4">
        {/* Equipment */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" /> Equipamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(equipByCategory).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum equipamento cadastrado</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(equipByCategory).map(([cat, items]) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</p>
                    <div className="flex flex-wrap gap-2">
                      {items.map((eq) => (
                        <Badge key={eq.id} variant="secondary" className="text-xs">
                          {eq.name} {eq.quantity > 1 ? `(${eq.quantity})` : ""}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Members */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Membros
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!members?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum membro</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {members.map((m) => (
                  <Link
                    key={m.user_id}
                    to={`/profile/${m.user_id}`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.full_name || m.username}</p>
                      <p className="text-xs text-muted-foreground truncate">@{m.username}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default GymPublicProfile;
