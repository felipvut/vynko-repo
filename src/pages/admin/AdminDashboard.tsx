import { useState, useMemo, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useBrazilLocations } from "@/hooks/useBrazilLocations";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  Users, FileText, Flag, Dumbbell, Trophy, TrendingUp, ShoppingBag, DollarSign,
  MapPin, Filter, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";


// ── helpers ──
const fmt = (v: number | string) => typeof v === "number" ? v.toLocaleString("pt-BR") : v;
const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const toISODate = (d: Date) => format(d, "yyyy-MM-dd");

const StatCard = ({ title, value, subtitle, icon: Icon, color }: { title: string; value: number | string; subtitle?: string; icon: any; color: string }) => (
  <Card className="bg-card border-border">
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{typeof value === "number" ? fmt(value) : value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const AdminDashboard = () => {
  const [stateFilter, setStateFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [dateStart, setDateStart] = useState<Date | undefined>(undefined);
  const [dateEnd, setDateEnd] = useState<Date | undefined>(undefined);
  const { states, cities, loadingCities } = useBrazilLocations(stateFilter);

  // Effective end date: if not set, default to today
  const effectiveDateEnd = dateEnd || (dateStart ? new Date() : undefined);
  const startStr = dateStart ? toISODate(dateStart) : "";
  const endStr = effectiveDateEnd ? toISODate(effectiveDateEnd) : "";

  const hasFilters = stateFilter || cityFilter || dateStart || dateEnd;

  const clearFilters = () => {
    setStateFilter("");
    setCityFilter("");
    setDateStart(undefined);
    setDateEnd(undefined);
  };

  // ── Stats (with location + date filters) ──
  const { data: stats } = useQuery({
    queryKey: ["admin-stats-v2", stateFilter, cityFilter, startStr, endStr],
    queryFn: async () => {
      // Build profile filter for location
      let profileQuery = supabase.from("profiles").select("user_id, city, state, created_at");
      if (stateFilter) profileQuery = profileQuery.eq("state", stateFilter);
      if (cityFilter) profileQuery = profileQuery.eq("city", cityFilter);
      if (startStr) profileQuery = profileQuery.gte("created_at", startStr);
      if (endStr) profileQuery = profileQuery.lte("created_at", endStr + "T23:59:59");
      const { data: profileData } = await profileQuery;
      const filteredUserIds = profileData?.map((p) => p.user_id) ?? [];

      // City distribution for map
      const cityDist: Record<string, { count: number; state: string }> = {};
      profileData?.forEach((p) => {
        if (p.city && p.state) {
          const key = `${p.city}|${p.state}`;
          if (!cityDist[key]) cityDist[key] = { count: 0, state: p.state };
          cityDist[key].count++;
        }
      });

      const hasLocationFilter = stateFilter || cityFilter;
      const userSlice = filteredUserIds.slice(0, 500);

      // Helper: apply user + date filters to a query
      const applyFilters = (q: any) => {
        if (startStr) q = q.gte("created_at", startStr);
        if (endStr) q = q.lte("created_at", endStr + "T23:59:59");
        if (hasLocationFilter && userSlice.length > 0) {
          q = q.in("user_id", userSlice);
        } else if (hasLocationFilter && userSlice.length === 0) {
          // No matching users → force empty
          q = q.eq("user_id", "00000000-0000-0000-0000-000000000000");
        }
        return q;
      };

      // Posts
      let postsQ = supabase.from("posts").select("id", { count: "exact", head: true });
      postsQ = applyFilters(postsQ);

      // Moves
      let movesQ = supabase.from("posts").select("id", { count: "exact", head: true }).eq("post_type", "video");
      movesQ = applyFilters(movesQ);

      // Reports
      let reportsQ = supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending");
      if (startStr) reportsQ = reportsQ.gte("created_at", startStr);
      if (endStr) reportsQ = reportsQ.lte("created_at", endStr + "T23:59:59");
      if (hasLocationFilter && userSlice.length > 0) {
        reportsQ = reportsQ.in("reporter_id", userSlice);
      } else if (hasLocationFilter && userSlice.length === 0) {
        reportsQ = reportsQ.eq("reporter_id", "00000000-0000-0000-0000-000000000000");
      }

      // Gyms
      let gymsQ = supabase.from("gyms").select("id", { count: "exact", head: true });
      if (stateFilter) gymsQ = gymsQ.eq("state", stateFilter);
      if (cityFilter) gymsQ = gymsQ.eq("city", cityFilter);
      if (startStr) gymsQ = gymsQ.gte("created_at", startStr);
      if (endStr) gymsQ = gymsQ.lte("created_at", endStr + "T23:59:59");

      // Active challenges
      let challengesQ = supabase.from("challenges").select("id", { count: "exact", head: true }).eq("status", "active");
      if (startStr) challengesQ = challengesQ.gte("created_at", startStr);
      if (endStr) challengesQ = challengesQ.lte("created_at", endStr + "T23:59:59");
      if (hasLocationFilter && userSlice.length > 0) {
        challengesQ = challengesQ.in("created_by", userSlice);
      } else if (hasLocationFilter && userSlice.length === 0) {
        challengesQ = challengesQ.eq("created_by", "00000000-0000-0000-0000-000000000000");
      }

      // Workout sessions
      let sessionsQ = supabase.from("workout_sessions").select("id", { count: "exact", head: true });
      if (startStr) sessionsQ = sessionsQ.gte("started_at", startStr);
      if (endStr) sessionsQ = sessionsQ.lte("started_at", endStr + "T23:59:59");
      if (hasLocationFilter && userSlice.length > 0) {
        sessionsQ = sessionsQ.in("user_id", userSlice);
      } else if (hasLocationFilter && userSlice.length === 0) {
        sessionsQ = sessionsQ.eq("user_id", "00000000-0000-0000-0000-000000000000");
      }

      const [reports, gyms, activeChallenges, sessions, posts, moves] = await Promise.all([
        reportsQ, gymsQ, challengesQ, sessionsQ, postsQ, movesQ,
      ]);

      // Marketplace stats (apply date + location)
      let servicesQ = supabase.from("marketplace_services").select("id, billing_type");
      if (startStr) servicesQ = servicesQ.gte("created_at", startStr);
      if (endStr) servicesQ = servicesQ.lte("created_at", endStr + "T23:59:59");
      if (hasLocationFilter && userSlice.length > 0) {
        servicesQ = servicesQ.in("user_id", userSlice);
      } else if (hasLocationFilter && userSlice.length === 0) {
        servicesQ = servicesQ.eq("user_id", "00000000-0000-0000-0000-000000000000");
      }

      let purchasesQ = supabase.from("service_purchases").select("id, price, status, next_renewal_date, buyer_id")
        .not("status", "in", "(pending,cancelled,refunded,expired)");
      if (startStr) purchasesQ = purchasesQ.gte("created_at", startStr);
      if (endStr) purchasesQ = purchasesQ.lte("created_at", endStr + "T23:59:59");
      if (hasLocationFilter && userSlice.length > 0) {
        purchasesQ = purchasesQ.in("buyer_id", userSlice);
      } else if (hasLocationFilter && userSlice.length === 0) {
        purchasesQ = purchasesQ.eq("buyer_id", "00000000-0000-0000-0000-000000000000");
      }

      const [{ data: services }, { data: purchases }] = await Promise.all([servicesQ, purchasesQ]);

      const totalServices = services?.length ?? 0;
      const recurringPurchases = purchases?.filter((p) => p.next_renewal_date) ?? [];
      const oneTimePurchases = purchases?.filter((p) => !p.next_renewal_date) ?? [];
      const recurringRevenue = recurringPurchases.reduce((s, p) => s + Number(p.price || 0), 0);
      const oneTimeRevenue = oneTimePurchases.reduce((s, p) => s + Number(p.price || 0), 0);

      return {
        users: profileData?.length ?? 0,
        posts: posts.count ?? 0,
        moves: moves.count ?? 0,
        pendingReports: reports.count ?? 0,
        gyms: gyms.count ?? 0,
        activeChallenges: activeChallenges.count ?? 0,
        workoutSessions: sessions.count ?? 0,
        cityDistribution: cityDist,
        totalServices,
        recurringPurchases: recurringPurchases.length,
        oneTimePurchases: oneTimePurchases.length,
        recurringRevenue,
        oneTimeRevenue,
      };
    },
    staleTime: 30_000,
  });

  // ── Timeline data for charts (respects both date + location filters) ──
  const { data: timelineData } = useQuery({
    queryKey: ["admin-timeline", startStr, endStr, stateFilter, cityFilter],
    queryFn: async () => {
      const start = startStr || "2024-01-01";
      const end = endStr || toISODate(new Date());

      // If location filter, get filtered user IDs first
      let filteredUserIds: string[] | null = null;
      if (stateFilter || cityFilter) {
        let pq = supabase.from("profiles").select("user_id");
        if (stateFilter) pq = pq.eq("state", stateFilter);
        if (cityFilter) pq = pq.eq("city", cityFilter);
        const { data } = await pq;
        filteredUserIds = data?.map(p => p.user_id) ?? [];
        if (filteredUserIds.length === 0) return [];
      }

      const userSlice = filteredUserIds?.slice(0, 500) ?? null;

      // Profiles timeline
      let profilesQ = supabase.from("profiles").select("created_at")
        .gte("created_at", start).lte("created_at", end + "T23:59:59")
        .order("created_at", { ascending: true });
      if (stateFilter) profilesQ = profilesQ.eq("state", stateFilter);
      if (cityFilter) profilesQ = profilesQ.eq("city", cityFilter);

      // Posts timeline
      let postsTlQ = supabase.from("posts").select("created_at, post_type")
        .gte("created_at", start).lte("created_at", end + "T23:59:59")
        .order("created_at", { ascending: true });
      if (userSlice) postsTlQ = postsTlQ.in("user_id", userSlice);

      // Challenges timeline
      let challengesTlQ = supabase.from("challenges").select("created_at, status, closed_at")
        .gte("created_at", start).lte("created_at", end + "T23:59:59")
        .order("created_at", { ascending: true });
      if (userSlice) challengesTlQ = challengesTlQ.in("created_by", userSlice);

      // Challenge participants
      let participantsTlQ = supabase.from("challenge_participants").select("joined_at")
        .gte("joined_at", start).lte("joined_at", end + "T23:59:59");
      if (userSlice) participantsTlQ = participantsTlQ.in("user_id", userSlice);

      const [{ data: profiles }, { data: postsTl }, { data: challengesTl }, { data: participantsTl }] = await Promise.all([
        profilesQ, postsTlQ, challengesTlQ, participantsTlQ,
      ]);

      // Group by month
      const monthMap: Record<string, {
        users: number; posts: number; moves: number;
        challengesCreated: number; challengesClosed: number; challengeParticipants: number;
      }> = {};

      const getMonth = (d: string) => d.substring(0, 7);
      const ensure = (m: string) => {
        if (!monthMap[m]) monthMap[m] = { users: 0, posts: 0, moves: 0, challengesCreated: 0, challengesClosed: 0, challengeParticipants: 0 };
      };

      profiles?.forEach((p) => { const m = getMonth(p.created_at); ensure(m); monthMap[m].users++; });
      postsTl?.forEach((p) => {
        const m = getMonth(p.created_at); ensure(m);
        monthMap[m].posts++;
        if (p.post_type === "video") monthMap[m].moves++;
      });
      challengesTl?.forEach((c) => {
        const m = getMonth(c.created_at); ensure(m);
        monthMap[m].challengesCreated++;
        if (c.closed_at) { const cm = getMonth(c.closed_at); ensure(cm); monthMap[cm].challengesClosed++; }
      });
      participantsTl?.forEach((p) => { const m = getMonth(p.joined_at); ensure(m); monthMap[m].challengeParticipants++; });

      return Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month: month.substring(5) + "/" + month.substring(2, 4),
          ...data,
        }));
    },
    staleTime: 60_000,
  });

  // ── Daily engagement data (posts, moves, workouts per day) ──
  const { data: dailyEngagement } = useQuery({
    queryKey: ["admin-daily-engagement", startStr, endStr, stateFilter, cityFilter],
    queryFn: async () => {
      const start = startStr || toISODate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
      const end = endStr || toISODate(new Date());

      let userSlice: string[] | null = null;
      if (stateFilter || cityFilter) {
        let pq = supabase.from("profiles").select("user_id");
        if (stateFilter) pq = pq.eq("state", stateFilter);
        if (cityFilter) pq = pq.eq("city", cityFilter);
        const { data } = await pq;
        const ids = data?.map(p => p.user_id) ?? [];
        if (ids.length === 0) return [];
        userSlice = ids.slice(0, 500);
      }

      let postsQ = supabase.from("posts").select("created_at, post_type")
        .gte("created_at", start).lte("created_at", end + "T23:59:59");
      if (userSlice) postsQ = postsQ.in("user_id", userSlice);

      let sessionsQ = supabase.from("workout_sessions").select("started_at")
        .gte("started_at", start).lte("started_at", end + "T23:59:59");
      if (userSlice) sessionsQ = sessionsQ.in("user_id", userSlice);

      const [{ data: posts }, { data: sessions }] = await Promise.all([postsQ, sessionsQ]);

      const dayMap: Record<string, { posts: number; moves: number; workouts: number }> = {};
      const getDay = (d: string) => d.substring(0, 10);
      const ensureDay = (d: string) => { if (!dayMap[d]) dayMap[d] = { posts: 0, moves: 0, workouts: 0 }; };

      posts?.forEach(p => { const d = getDay(p.created_at); ensureDay(d); dayMap[d].posts++; if (p.post_type === "video") dayMap[d].moves++; });
      sessions?.forEach(s => { const d = getDay(s.started_at); ensureDay(d); dayMap[d].workouts++; });

      return Object.entries(dayMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, data]) => ({
          day: day.substring(8) + "/" + day.substring(5, 7),
          ...data,
        }));
    },
    staleTime: 60_000,
  });

  // ── Map component (dynamic import) ──
  const [MapComponent, setMapComponent] = useState<React.ComponentType<any> | null>(null);
  useEffect(() => {
    import("@/components/admin/AdminGeoMap").then((mod) => setMapComponent(() => mod.default));
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Dashboard</h2>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Filtros</span>
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground gap-1">
                  <X className="w-3 h-3" /> Limpar filtros
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Estado</Label>
                <Select value={stateFilter} onValueChange={(v) => { setStateFilter(v === "_all" ? "" : v); setCityFilter(""); }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos</SelectItem>
                    {states.map((s) => (
                      <SelectItem key={s.sigla} value={s.sigla}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Cidade</Label>
                <Select value={cityFilter} onValueChange={(v) => setCityFilter(v === "_all" ? "" : v)} disabled={!stateFilter || loadingCities}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todas</SelectItem>
                    {cities.map((c) => (
                      <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Data início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal", !dateStart && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {dateStart ? format(dateStart, "dd/MM/yyyy") : <span>Selecionar</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateStart} onSelect={setDateStart} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs">Data fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal", !dateEnd && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {dateEnd ? format(dateEnd, "dd/MM/yyyy") : <span>Hoje (padrão)</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateEnd} onSelect={setDateEnd} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard title="Usuários" value={stats?.users ?? "..."} icon={Users} color="bg-primary/10 text-primary" />
          <StatCard title="Posts" value={stats?.posts ?? "..."} icon={FileText} color="bg-blue-500/10 text-blue-400" />
          <StatCard title="Moves" value={stats?.moves ?? "..."} icon={TrendingUp} color="bg-cyan-500/10 text-cyan-400" />
          <StatCard title="Denúncias pendentes" value={stats?.pendingReports ?? "..."} icon={Flag} color="bg-destructive/10 text-destructive" />
          <StatCard title="Academias" value={stats?.gyms ?? "..."} icon={Dumbbell} color="bg-purple-500/10 text-purple-400" />
          <StatCard title="Desafios ativos" value={stats?.activeChallenges ?? "..."} icon={Trophy} color="bg-yellow-500/10 text-yellow-400" />
          <StatCard title="Treinos realizados" value={stats?.workoutSessions ?? "..."} icon={TrendingUp} color="bg-green-500/10 text-green-400" />
          <StatCard title="Serviços anunciados" value={stats?.totalServices ?? "..."} icon={ShoppingBag} color="bg-orange-500/10 text-orange-400" />
          <StatCard
            title="Serviços adquiridos"
            value={((stats?.recurringPurchases ?? 0) + (stats?.oneTimePurchases ?? 0))}
            subtitle={`${stats?.recurringPurchases ?? 0} recorrente · ${stats?.oneTimePurchases ?? 0} único`}
            icon={ShoppingBag}
            color="bg-emerald-500/10 text-emerald-400"
          />
          <StatCard
            title="Receita serviços"
            value={fmtMoney((stats?.recurringRevenue ?? 0) + (stats?.oneTimeRevenue ?? 0))}
            subtitle={`${fmtMoney(stats?.recurringRevenue ?? 0)} recorrente · ${fmtMoney(stats?.oneTimeRevenue ?? 0)} único`}
            icon={DollarSign}
            color="bg-emerald-500/10 text-emerald-400"
          />
        </div>

        {/* Geo Map */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5" /> Distribuição geográfica
            </CardTitle>
          </CardHeader>
          <CardContent>
            {MapComponent && stats?.cityDistribution ? (
              <MapComponent cityDistribution={stats.cityDistribution} />
            ) : (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground text-sm">
                Carregando mapa...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts */}
        {timelineData && timelineData.length > 0 && (
          <>
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground text-lg">Evolução de usuários e conteúdo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                    <Legend />
                    <Line type="monotone" dataKey="users" name="Usuários" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="posts" name="Posts" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="moves" name="Moves" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {dailyEngagement && dailyEngagement.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground text-lg">Engajamento diário - Posts, Moves & Treinos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyEngagement}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} interval="preserveStartEnd" />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                    <Legend />
                    <Line type="monotone" dataKey="posts" name="Posts" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="moves" name="Moves" stroke="#06b6d4" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="workouts" name="Treinos" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            )}

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground text-lg">Desafios - Evolução e engajamento</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                    <Legend />
                    <Line type="monotone" dataKey="challengesCreated" name="Criados" stroke="#eab308" strokeWidth={2} />
                    <Line type="monotone" dataKey="challengesClosed" name="Encerrados" stroke="#ef4444" strokeWidth={2} />
                    <Line type="monotone" dataKey="challengeParticipants" name="Participantes" stroke="#22c55e" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
