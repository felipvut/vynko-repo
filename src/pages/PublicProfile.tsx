import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PostCard from "@/components/community/PostCard";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ChevronLeft, MapPin, Building2, Dumbbell, Trophy, Flame, Medal,
  UserPlus, UserCheck, Loader2, ShieldOff, Target, MessageSquare,
  Ruler, Weight, Calendar, Heart, Send
} from "lucide-react";
import UserBadges from "@/components/profile/UserBadges";
import AvatarWithBadge from "@/components/profile/AvatarWithBadge";

interface ProfileData {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  gym_name: string | null;
  is_public: boolean | null;
  show_total_workouts: boolean | null;
  show_prs: boolean | null;
  show_streak: boolean | null;
  show_ranking: boolean | null;
  show_challenges_won: boolean | null;
}

interface ChallengeInfo {
  id: string;
  title: string;
  challenge_type: string;
  end_date: string;
  progress: number;
  goal_value: number;
}

interface PostInfo {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  visibility: string;
  post_type: string;
  workout_session_id: string | null;
  created_at: string;
  updated_at: string;
  hashtags?: string[];
  category?: string;
  duration_seconds?: number;
  view_count?: number;
  is_daily_challenge?: boolean;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
  likes_count?: number;
  comments_count?: number;
  user_liked?: boolean;
}

const PublicProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [togglingFollow, setTogglingFollow] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [isPrivateNonFriend, setIsPrivateNonFriend] = useState(false);

  const [currentStreak, setCurrentStreak] = useState<number | null>(null);
  const [challenges, setChallenges] = useState<ChallengeInfo[]>([]);
  const [posts, setPosts] = useState<PostInfo[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [anamnesis, setAnamnesis] = useState<{ age: number | null; weight: number | null; height: number | null } | null>(null);
  const [totalWorkouts, setTotalWorkouts] = useState<number | null>(null);

  useEffect(() => {
    if (userId) resolveAndLoad();
  }, [userId]);

  const resolveAndLoad = async () => {
    if (!userId || !user) return;
    setLoading(true);
    setIsPrivateNonFriend(false);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    let targetUserId = userId;

    if (!isUuid) {
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .ilike("username", userId)
        .maybeSingle();
      if (!data) {
        setProfile(null);
        setLoading(false);
        return;
      }
      targetUserId = data.user_id;
    }

    if (targetUserId === user.id) {
      navigate("/profile", { replace: true });
      return;
    }

    setResolvedUserId(targetUserId);
    await loadProfile(targetUserId);
  };

  const loadProfile = async (targetId: string) => {
    if (!user) return;

    const [profileRes, followRes, followersRes, followingRes, anamnesisRes, friendshipRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, bio, city, state, gym_name, is_public, show_total_workouts, show_prs, show_streak, show_ranking, show_challenges_won")
        .eq("user_id", targetId)
        .maybeSingle(),
      supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", targetId)
        .maybeSingle(),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", targetId),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", targetId),
      supabase
        .from("anamnesis")
        .select("age, weight, height")
        .eq("user_id", targetId)
        .maybeSingle(),
      supabase
        .from("friendships")
        .select("id, status, requester_id")
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${user.id})`)
        .maybeSingle(),
    ]);

    if (!profileRes.data) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const isFriend = friendshipRes.data?.status === "accepted";

    // Private profile: only friends can see
    if (!profileRes.data.is_public && !isFriend) {
      setProfile(profileRes.data);
      setIsPrivateNonFriend(true);
      setFriendshipStatus(friendshipRes.data?.status || null);
      setLoading(false);
      return;
    }

    setProfile(profileRes.data);
    setIsFollowing(!!followRes.data);
    setFollowersCount(followersRes.count || 0);
    setFollowingCount(followingRes.count || 0);
    setAnamnesis(anamnesisRes.data || null);
    setFriendshipStatus(friendshipRes.data?.status || null);
    setFriendshipId(friendshipRes.data?.id || null);

    const p = profileRes.data;

    // Parallel loads for extra sections
    const extraPromises: Promise<any>[] = [];

    // Streak + total workouts from user_xp
    if (p.show_streak || p.show_total_workouts) {
      extraPromises.push(Promise.resolve(
        supabase
          .from("user_xp")
          .select("current_streak, total_xp")
          .eq("user_id", targetId)
          .maybeSingle()
          .then(({ data }) => {
            if (p.show_streak) setCurrentStreak(data?.current_streak || 0);
          })
      ));
    }

    // Workout sessions count
    if (p.show_total_workouts) {
      extraPromises.push(Promise.resolve(
        supabase
          .from("workout_sessions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", targetId)
          .not("finished_at", "is", null)
          .then(({ count }) => { setTotalWorkouts(count || 0); })
      ));
    }

    // Challenges the user is participating in
    if (p.show_challenges_won) {
      extraPromises.push(Promise.resolve(
        supabase
          .from("challenge_participants")
          .select("challenge_id, progress, challenges(id, title, challenge_type, end_date, goal_value)")
          .eq("user_id", targetId)
          .then(({ data }) => {
            const mapped = (data || [])
              .filter((cp: any) => cp.challenges)
              .map((cp: any) => ({
                id: cp.challenges.id,
                title: cp.challenges.title,
                challenge_type: cp.challenges.challenge_type,
                end_date: cp.challenges.end_date,
                progress: cp.progress,
                goal_value: cp.challenges.goal_value,
              }));
            setChallenges(mapped);
          })
      ));
    }

    // Posts (RLS already handles visibility)
    extraPromises.push(Promise.resolve(
      supabase
        .from("posts")
        .select("*")
        .eq("user_id", targetId)
        .neq("post_type", "move")
        .order("created_at", { ascending: false })
        .limit(20)
        .then(async ({ data: postsData }) => {
          if (!postsData || postsData.length === 0) { setPosts([]); return; }

          const postIds = postsData.map(p => p.id);
          const [likesRes, commentsRes, userLikesRes] = await Promise.all([
            supabase.from("likes").select("post_id").in("post_id", postIds),
            supabase.from("comments").select("post_id").in("post_id", postIds),
            supabase.from("likes").select("post_id").in("post_id", postIds).eq("user_id", user.id),
          ]);

          const likesCount = new Map<string, number>();
          (likesRes.data || []).forEach(l => likesCount.set(l.post_id, (likesCount.get(l.post_id) || 0) + 1));
          const commentsCount = new Map<string, number>();
          (commentsRes.data || []).forEach(c => commentsCount.set(c.post_id, (commentsCount.get(c.post_id) || 0) + 1));
          const userLikedSet = new Set((userLikesRes.data || []).map(l => l.post_id));

          setPosts(postsData.map(post => ({
            ...post,
            profiles: { full_name: p.full_name, avatar_url: p.avatar_url },
            likes_count: likesCount.get(post.id) || 0,
            comments_count: commentsCount.get(post.id) || 0,
            user_liked: userLikedSet.has(post.id),
          })));
        })
    ));

    await Promise.all(extraPromises);
    setLoading(false);
  };

  const toggleFollow = async () => {
    if (!user || !resolvedUserId) return;
    setTogglingFollow(true);

    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", resolvedUserId);
      setIsFollowing(false);
      toast.success("Deixou de seguir");
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: resolvedUserId });
      setIsFollowing(true);
      toast.success("Seguindo!");
    }

    setTogglingFollow(false);
  };

  const sendFriendRequest = async () => {
    if (!user || !resolvedUserId) return;
    setSendingRequest(true);
    const { error } = await supabase.from("friendships").insert({
      requester_id: user.id,
      addressee_id: resolvedUserId,
    });
    if (error?.code === "23505") {
      toast.info("Solicitação já enviada");
    } else if (error) {
      toast.error("Erro ao enviar solicitação");
    } else {
      setFriendshipStatus("pending");
      toast.success("Solicitação de amizade enviada!");
    }
    setSendingRequest(false);
  };

  const initials = (profile?.full_name || "?")
    .split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen pb-8">
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="container flex items-center h-14">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </div>
        </header>
        <div className="container mt-12 text-center space-y-4">
          <ShieldOff className="h-16 w-16 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-display font-bold">Perfil não encontrado</h2>
          <p className="text-muted-foreground text-sm">Este usuário não existe.</p>
        </div>
      </div>
    );
  }

  if (isPrivateNonFriend) {
    return (
      <div className="min-h-screen pb-8">
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="container flex items-center h-14">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </div>
        </header>
        <div className="container mt-12 text-center space-y-4">
          <AvatarWithBadge
            userId={resolvedUserId || ""}
            avatarUrl={profile.avatar_url}
            fallback={(profile.full_name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            className="h-20 w-20 mx-auto"
            fallbackClassName="text-xl bg-primary/20 text-primary"
          />
          <h2 className="text-xl font-display font-bold">{profile.full_name || "Usuário"}</h2>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <ShieldOff className="h-4 w-4" />
            <p className="text-sm">Perfil privado</p>
          </div>
          <p className="text-muted-foreground text-sm">Apenas amigos podem ver as informações deste perfil.</p>
          {!friendshipStatus && (
            <Button
              className="gradient-primary text-primary-foreground"
              disabled={sendingRequest}
              onClick={sendFriendRequest}
            >
              {sendingRequest ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Heart className="h-4 w-4 mr-1" />}
              Solicitar amizade
            </Button>
          )}
          {friendshipStatus === "pending" && (
            <Button variant="outline" disabled>
              <Heart className="h-4 w-4 mr-1" /> Solicitação enviada
            </Button>
          )}
        </div>
      </div>
    );
  }

  const metrics = [
    { label: "Streak", icon: Flame, value: currentStreak !== null ? `${currentStreak}d` : null, visible: profile.show_streak },
    { label: "Ranking", icon: Medal, value: "—", visible: profile.show_ranking },
  ].filter(m => m.visible && m.value !== null);

  const challengeTypeLabel = (t: string) => {
    switch (t) {
      case "workout_count": return "Treinos";
      case "workout_minutes": return "Minutos";
      case "exercise_sets": return "Séries";
      default: return t;
    }
  };

  return (
    <div className="min-h-screen pb-8">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <Button variant="ghost" size="sm" onClick={() => navigate("/search-people")}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <span className="font-display font-bold">Perfil</span>
          <div className="w-16" />
        </div>
      </header>

      <div className="container mt-6 space-y-6">
        {/* Avatar & Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3">
          <AvatarWithBadge
            userId={resolvedUserId || ""}
            avatarUrl={profile.avatar_url}
            fallback={initials}
            className="h-24 w-24"
            fallbackClassName="text-2xl bg-primary/20 text-primary"
          />

          <div className="text-center space-y-2">
            <h1 className="text-xl font-display font-bold">{profile.full_name || "Sem nome"}</h1>
            {resolvedUserId && <UserBadges userId={resolvedUserId} />}
            <p className="text-sm text-muted-foreground max-w-xs">
              {profile.bio || "Sem biografia"}
            </p>
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
              {profile.city && profile.state ? (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {profile.city}, {profile.state}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Localização não informada
                </span>
              )}
              {profile.gym_name && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {profile.gym_name}
                </span>
              )}
            </div>

            {/* Follower / Following counts */}
            <div className="flex items-center justify-center gap-6 mt-2">
              <div className="text-center">
                <p className="text-lg font-bold">{followersCount}</p>
                <p className="text-xs text-muted-foreground">Seguidores</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">{followingCount}</p>
                <p className="text-xs text-muted-foreground">Seguindo</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isFollowing ? "secondary" : "default"}
              className={!isFollowing ? "gradient-primary text-primary-foreground" : ""}
              disabled={togglingFollow}
              onClick={toggleFollow}
              size="sm"
            >
              {togglingFollow ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : isFollowing ? (
                <UserCheck className="h-4 w-4 mr-1" />
              ) : (
                <UserPlus className="h-4 w-4 mr-1" />
              )}
              {isFollowing ? "Seguindo" : "Seguir"}
            </Button>

            {friendshipStatus === "accepted" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/dm/${resolvedUserId}`)}
              >
                <MessageSquare className="h-4 w-4 mr-1" /> Mensagem
              </Button>
            ) : friendshipStatus === "pending" ? (
              <Button variant="outline" size="sm" disabled>
                <Heart className="h-4 w-4 mr-1" /> Solicitação enviada
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={sendingRequest}
                onClick={sendFriendRequest}
              >
                {sendingRequest ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Heart className="h-4 w-4 mr-1" />
                )}
                Amizade
              </Button>
            )}
          </div>
        </motion.div>

        {/* Metrics */}
        {metrics.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-4 space-y-3">
            <h3 className="font-display font-bold text-sm">Métricas</h3>
            <div className="grid grid-cols-2 gap-3">
              {metrics.map((m, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <m.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-sm font-bold">{m.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Challenges */}
        {profile.show_challenges_won && challenges.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4 space-y-3">
            <h3 className="font-display font-bold text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Desafios
            </h3>
            <div className="space-y-2">
              {challenges.map(ch => {
                const pct = ch.goal_value > 0 ? Math.min(100, Math.round((ch.progress / ch.goal_value) * 100)) : 0;
                const ended = new Date(ch.end_date) < new Date();
                return (
                  <div key={ch.id} className="p-3 rounded-lg bg-muted/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{ch.title}</p>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {challengeTypeLabel(ch.challenge_type)} • {ended ? "Encerrado" : "Ativo"}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-right">
                      {ch.progress}/{ch.goal_value} ({pct}%)
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Posts */}
        {posts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-3">
            <h3 className="font-display font-bold text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> Publicações
            </h3>
            {posts.map((post, i) => (
              <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.03 }}>
                <PostCard post={post} onRefresh={() => resolvedUserId && loadProfile(resolvedUserId)} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Empty state when no extra content */}
        {metrics.length === 0 && challenges.length === 0 && posts.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Este usuário não tem conteúdo público visível.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PublicProfile;
