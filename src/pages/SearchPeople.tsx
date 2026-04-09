import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarWithBadge from "@/components/profile/AvatarWithBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBrazilLocations } from "@/hooks/useBrazilLocations";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ChevronLeft, Search, Filter, UserPlus, UserCheck, MapPin,
  Building2, Loader2, X
} from "lucide-react";

interface PersonResult {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  gym_name: string | null;
  is_following: boolean;
}

const SearchPeople = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterGym, setFilterGym] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [results, setResults] = useState<PersonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [togglingFollow, setTogglingFollow] = useState<string | null>(null);

  const { states } = useBrazilLocations("");
  const { cities, loadingCities } = useBrazilLocations(filterState);

  // Load who I follow
  useEffect(() => {
    if (!user) return;
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .then(({ data }) => {
        setFollowingIds(new Set((data || []).map(f => f.following_id)));
      });
  }, [user]);

  const searchPeople = async () => {
    if (!user) return;
    setLoading(true);

    let q = supabase
      .from("profiles")
      .select("user_id, full_name, username, avatar_url, bio, city, state, gym_name")
      .eq("is_public", true)
      .neq("user_id", user.id)
      .limit(50);

    if (query.trim()) {
      q = q.or(`full_name.ilike.%${query.trim()}%,username.ilike.%${query.trim()}%`);
    }
    if (filterState) {
      q = q.eq("state", filterState);
    }
    if (filterCity) {
      q = q.eq("city", filterCity);
    }
    if (filterGym.trim()) {
      q = q.ilike("gym_name", `%${filterGym.trim()}%`);
    }

    const { data, error } = await q.order("full_name");

    if (error) {
      toast.error("Erro ao buscar pessoas");
      setLoading(false);
      return;
    }

    setResults(
      (data || []).map(p => ({
        ...p,
        is_following: followingIds.has(p.user_id),
      }))
    );
    setLoading(false);
  };

  // Search on mount and when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      searchPeople();
    }, 300);
    return () => clearTimeout(timer);
  }, [query, filterState, filterCity, filterGym, followingIds]);

  const toggleFollow = async (personId: string) => {
    if (!user) return;
    setTogglingFollow(personId);

    const isFollowing = followingIds.has(personId);

    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", personId);

      setFollowingIds(prev => {
        const next = new Set(prev);
        next.delete(personId);
        return next;
      });
      toast.success("Deixou de seguir");
    } else {
      await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: personId });

      setFollowingIds(prev => new Set(prev).add(personId));
      toast.success("Seguindo!");
    }

    setResults(prev =>
      prev.map(p =>
        p.user_id === personId ? { ...p, is_following: !isFollowing } : p
      )
    );
    setTogglingFollow(null);
  };

  const clearFilters = () => {
    setFilterState("");
    setFilterCity("");
    setFilterGym("");
  };

  const hasActiveFilters = filterState || filterCity || filterGym;

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-display font-bold text-lg">Buscar Pessoas</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={hasActiveFilters ? "text-primary" : ""}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="container mt-4 space-y-4">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome ou @username..."
            className="pl-10"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-bold">Filtros</h3>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                  <X className="h-3 w-3 mr-1" /> Limpar
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Estado
                </label>
                <Select value={filterState} onValueChange={v => { setFilterState(v); setFilterCity(""); }}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 bg-popover z-50">
                    {states.map(s => (
                      <SelectItem key={s.sigla} value={s.sigla}>{s.sigla}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Cidade
                </label>
                <Select
                  value={filterCity}
                  onValueChange={setFilterCity}
                  disabled={!filterState || loadingCities}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={loadingCities ? "..." : "Todas"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 bg-popover z-50">
                    {cities.map(c => (
                      <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Academia
              </label>
              <Input
                value={filterGym}
                onChange={e => setFilterGym(e.target.value)}
                placeholder="Nome da academia..."
                className="h-9 text-xs"
              />
            </div>
          </motion.div>
        )}

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-8 text-center space-y-3"
          >
            <Search className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-lg font-display font-bold">Nenhuma pessoa encontrada</h2>
            <p className="text-muted-foreground text-sm">Tente alterar os filtros ou o termo de busca</p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{results.length} resultado(s)</p>
            {results.map((person, i) => {
              const initials = (person.full_name || "?")
                .split(" ")
                .map(n => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <motion.div
                  key={person.user_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-card p-4 flex items-center gap-3"
                >
                  <AvatarWithBadge
                    userId={person.user_id}
                    avatarUrl={person.avatar_url}
                    fallback={initials}
                    className="h-12 w-12 shrink-0"
                    fallbackClassName="bg-primary/10 text-primary text-sm"
                  />

                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/profile/${person.user_id}`)}
                  >
                    <p className="font-medium text-sm truncate hover:text-primary transition-colors">
                      {person.full_name || "Sem nome"}
                    </p>
                    {person.username && (
                      <p className="text-xs text-muted-foreground">@{person.username}</p>
                    )}
                    {person.bio && (
                      <p className="text-xs text-muted-foreground truncate">{person.bio}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {person.city && person.state && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {person.city}, {person.state}
                        </span>
                      )}
                      {person.gym_name && (
                        <span className="flex items-center gap-0.5">
                          <Building2 className="h-3 w-3" />
                          {person.gym_name}
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    variant={person.is_following ? "secondary" : "default"}
                    size="sm"
                    className={!person.is_following ? "gradient-primary text-primary-foreground" : ""}
                    disabled={togglingFollow === person.user_id}
                    onClick={() => toggleFollow(person.user_id)}
                  >
                    {togglingFollow === person.user_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : person.is_following ? (
                      <><UserCheck className="h-4 w-4 mr-1" /> Seguindo</>
                    ) : (
                      <><UserPlus className="h-4 w-4 mr-1" /> Seguir</>
                    )}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPeople;
