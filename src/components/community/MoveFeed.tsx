import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Heart, MessageCircle, Share2, Volume2, VolumeX, Play,
  UserPlus, Eye, Trophy, Dumbbell, Flame, Flag
} from "lucide-react";
import ReportDialog from "./ReportDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarWithBadge from "@/components/profile/AvatarWithBadge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { Post } from "@/hooks/useCommunity";
import CommentsSheet from "./CommentsSheet";
import { motion, AnimatePresence } from "framer-motion";

/* ========== Single Reel ========== */
interface MoveReelProps {
  post: Post;
  isVisible: boolean;
  onRefresh: () => void;
}

const MoveReel = ({ post, isVisible, onRefresh }: MoveReelProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState(post.user_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const [following, setFollowing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [viewCounted, setViewCounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const lastTapRef = useRef(0);

  const videoUrl = post.video_url;
  const viewCount = (post as any).view_count || 0;
  const hashtags: string[] = (post as any).hashtags || [];
  const isDailyChallenge = (post as any).is_daily_challenge || false;
  const overlays: any[] = (post as any).overlays || [];

  // Check if already following
  useEffect(() => {
    if (!user || user.id === post.user_id) return;
    supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", post.user_id)
      .maybeSingle()
      .then(({ data }) => setFollowing(!!data));
  }, [user, post.user_id]);

  // Auto-play/pause based on visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isVisible) {
      video.currentTime = 0;
      video.play().catch(() => {});
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
      setProgress(0);
    }
  }, [isVisible]);

  // Track progress + view count + gamification
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (video.duration) {
        const pct = (video.currentTime / video.duration) * 100;
        setProgress(pct);
        setCurrentTime(video.currentTime);

        // Track view when watched > 80%
        if (pct > 80 && !viewCounted && user) {
          setViewCounted(true);
          trackView(true);
        }
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [viewCounted, user]);

  const trackView = async (complete: boolean) => {
    if (!user) return;
    try {
      // Upsert view
      await supabase.from("move_views" as any).upsert({
        user_id: user.id,
        post_id: post.id,
        watched_complete: complete,
      }, { onConflict: "user_id,post_id" });

      // Increment view count via RPC
      await supabase.rpc("increment_view_count" as any, { _post_id: post.id });

      // Award XP for watching complete video (5 XP)
      if (complete) {
        await awardMovePoints(user.id, 5, 1);
      }
    } catch {}
  };

  const awardMovePoints = async (userId: string, points: number, videosWatched: number) => {
    try {
      const weekStart = getWeekStart();
      const { data: existing } = await supabase
        .from("move_rankings" as any)
        .select("*")
        .eq("user_id", userId)
        .eq("week_start", weekStart)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("move_rankings" as any)
          .update({
            points: (existing as any).points + points,
            videos_watched: (existing as any).videos_watched + videosWatched,
            updated_at: new Date().toISOString(),
          })
          .eq("id", (existing as any).id);
      } else {
        await supabase
          .from("move_rankings" as any)
          .insert({
            user_id: userId,
            week_start: weekStart,
            points,
            videos_watched: videosWatched,
          });
      }
    } catch {}
  };

  const getWeekStart = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split("T")[0];
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play().catch(() => {}); setPlaying(true); }
    else { video.pause(); setPlaying(false); }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap → like
      if (!liked) toggleLike();
      setShowDoubleTapHeart(true);
      setTimeout(() => setShowDoubleTapHeart(false), 800);
    }
    lastTapRef.current = now;
  };

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      setLiked(false);
      setLikesCount(c => c - 1);
    } else {
      await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
      setLiked(true);
      setLikesCount(c => c + 1);
    }
  };

  const toggleFollow = async () => {
    if (!user || user.id === post.user_id) return;
    if (following) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", post.user_id);
      setFollowing(false);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: post.user_id });
      setFollowing(true);
      toast.success("Seguindo!");
    }
  };

  const share = () => {
    const url = window.location.origin;
    const text = post.content ? `${post.profiles?.full_name}: ${post.content.slice(0, 100)}` : "Confira este Move no Vynko!";
    if (navigator.share) {
      navigator.share({ title: "Vynko Move", text, url });
    } else {
      navigator.clipboard.writeText(`${text} - ${url}`);
      toast.success("Link copiado!");
    }
  };

  const joinChallenge = async () => {
    if (!user) return;
    toast.success("🔥 Desafio aceito! +10 XP");
    await awardMovePoints(user.id, 10, 0);
  };

  const initials = (post.profiles?.full_name || "U").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        src={videoUrl || undefined}
        className="w-full h-full object-contain"
        loop
        muted={muted}
        playsInline
        preload="auto"
        onClick={(e) => {
          handleDoubleTap();
          // Single tap toggles play (with delay to check for double)
          setTimeout(() => {
            if (Date.now() - lastTapRef.current >= 300) togglePlay();
          }, 310);
        }}
      />

      {/* Overlays from editor */}
      {overlays.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {overlays.map((o: any, i: number) => {
            // Time-based visibility for video
            if (o.showAt != null && o.hideAt != null) {
              if (currentTime < o.showAt || currentTime > o.hideAt) return null;
            }
            return (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${o.x}%`,
                  top: `${o.y}%`,
                  transform: `translate(-50%, -50%) scale(${o.scale || 1}) rotate(${o.rotation || 0}deg)`,
                }}
              >
                {o.type === "gif" ? (
                  <img src={o.gifUrl} alt="GIF" className="max-w-[120px] rounded-lg" />
                ) : (
                  <span
                    style={{
                      color: o.color || "#fff",
                      fontSize: `${o.fontSize || 24}px`,
                      fontFamily: o.fontFamily || "system-ui",
                      fontWeight: o.fontWeight || "bold",
                      fontStyle: o.fontStyle || "normal",
                      textAlign: o.textAlign || "center",
                      textShadow: o.textShadow ? "0 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.4)" : "none",
                      backgroundColor: o.textBackground || "transparent",
                      padding: o.textBackground ? "4px 10px" : "0",
                      borderRadius: o.textBackground ? "6px" : "0",
                      whiteSpace: o.type === "sticker" ? "nowrap" : "pre-wrap",
                      maxWidth: "250px",
                      display: "inline-block",
                    }}
                  >
                    {o.content}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Double-tap heart animation */}
      <AnimatePresence>
        {showDoubleTapHeart && (
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <Heart className="h-24 w-24 text-white fill-white" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Play icon when paused */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Play className="h-16 w-16 text-white/60 fill-white/60" />
        </div>
      )}

      {/* Daily Challenge Badge */}
      {isDailyChallenge && (
        <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-orange-500/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
          <Flame className="h-4 w-4 text-white" />
          <span className="text-white text-xs font-bold">Desafio do Dia</span>
        </div>
      )}

      {/* View count (top right) */}
      <div className="absolute top-4 right-4 flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full">
        <Eye className="h-3.5 w-3.5 text-white/80" />
        <span className="text-white/80 text-xs font-medium">
          {viewCount > 999 ? `${(viewCount / 1000).toFixed(1)}k` : viewCount}
        </span>
      </div>

      {/* Right side action buttons */}
      <div className="absolute right-3 bottom-36 flex flex-col items-center gap-5">
        {/* Profile avatar */}
        <button
          onClick={() => {
            // Try username first, fallback to user_id
            const username = (post.profiles as any)?.username;
            if (username) navigate(`/u/${username}`);
          }}
          className="relative"
        >
          <AvatarWithBadge
            userId={post.user_id}
            avatarUrl={post.profiles?.avatar_url}
            fallback={initials}
            className="h-11 w-11 border-2 border-white"
            fallbackClassName="text-xs bg-primary text-primary-foreground"
          />
          {user?.id !== post.user_id && !following && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleFollow(); }}
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-5 w-5 rounded-full bg-primary flex items-center justify-center"
            >
              <UserPlus className="h-3 w-3 text-primary-foreground" />
            </button>
          )}
        </button>

        {/* Like */}
        <button onClick={toggleLike} className="flex flex-col items-center gap-1">
          <Heart className={`h-7 w-7 ${liked ? "fill-red-500 text-red-500" : "text-white"} drop-shadow-lg`} />
          <span className="text-white text-[11px] font-semibold drop-shadow-lg">{likesCount}</span>
        </button>

        {/* Comment */}
        <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-1">
          <MessageCircle className="h-7 w-7 text-white drop-shadow-lg" />
          <span className="text-white text-[11px] font-semibold drop-shadow-lg">{post.comments_count || 0}</span>
        </button>

        {/* Share */}
        <button onClick={share} className="flex flex-col items-center gap-1">
          <Share2 className="h-6 w-6 text-white drop-shadow-lg" />
        </button>

        {/* Mute */}
        <button onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}>
          {muted ? <VolumeX className="h-6 w-6 text-white drop-shadow-lg" /> : <Volume2 className="h-6 w-6 text-white drop-shadow-lg" />}
        </button>

        {/* Report */}
        {user?.id !== post.user_id && (
          <button onClick={(e) => { e.stopPropagation(); setShowReport(true); }} className="flex flex-col items-center gap-1">
            <Flag className="h-5 w-5 text-white/70 drop-shadow-lg" />
          </button>
        )}
      </div>

      {/* Bottom user info & hashtags */}
      <div className="absolute bottom-8 left-4 right-20 space-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { const username = (post.profiles as any)?.username; if (username) navigate(`/u/${username}`); }}
            className="text-white font-bold text-sm drop-shadow-lg hover:underline"
          >
            {post.profiles?.full_name || "Usuário"}
          </button>
          <span className="text-white/50 text-xs">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>

        {post.content && (
          <p className="text-white/90 text-sm drop-shadow-lg line-clamp-2">{post.content}</p>
        )}

        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hashtags.map(tag => (
              <span key={tag} className="text-primary text-xs font-semibold drop-shadow-lg">#{tag}</span>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          {isDailyChallenge && (
            <button
              onClick={joinChallenge}
              className="flex items-center gap-1.5 bg-primary/90 backdrop-blur-sm px-3 py-1.5 rounded-full"
            >
              <Trophy className="h-3.5 w-3.5 text-primary-foreground" />
              <span className="text-primary-foreground text-xs font-bold">Entrar no desafio</span>
            </button>
          )}
          <button
            onClick={() => { toast.success("Exercício salvo no seu treino!"); }}
            className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full"
          >
            <Dumbbell className="h-3.5 w-3.5 text-white" />
            <span className="text-white text-xs font-medium">Adicionar ao treino</span>
          </button>
        </div>
      </div>

      {/* Progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
        <div
          className="h-full bg-primary transition-all duration-200 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <CommentsSheet
        postId={post.id}
        open={showComments}
        onOpenChange={setShowComments}
        onCommentAdded={onRefresh}
      />
      <ReportDialog
        open={showReport}
        onOpenChange={setShowReport}
        postId={post.id}
        postUserId={post.user_id}
        onActionTaken={onRefresh}
      />
    </div>
  );
};

/* ========== Move Feed ========== */
interface MoveFeedProps {
  onRefresh: () => void;
}

const MoveFeed = ({ onRefresh }: MoveFeedProps) => {
  const { user } = useAuth();
  const [videoPosts, setVideoPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showRanking, setShowRanking] = useState(false);
  const [ranking, setRanking] = useState<any[]>([]);

  const loadVideoPosts = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Use recommendation algorithm
    const { data: recommended } = await supabase.rpc("get_recommended_moves" as any, {
      _user_id: user.id,
      _limit: 30,
    });

    if (!recommended || (recommended as any[]).length === 0) {
      // Fallback: just get latest videos
      const { data: fallback } = await supabase
        .from("posts")
        .select("*")
        .eq("post_type", "move")
        .not("video_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(30);

      if (!fallback || fallback.length === 0) {
        setVideoPosts([]);
        setLoading(false);
        return;
      }
      await enrichPosts(fallback);
      return;
    }

    // Fetch full posts in recommended order
    const postIds = (recommended as any[]).map((r: any) => r.post_id);
    const { data: postsData } = await supabase
      .from("posts")
      .select("*")
      .in("id", postIds);

    if (!postsData) { setVideoPosts([]); setLoading(false); return; }

    // Re-order by algorithm score
    const orderMap = new Map((recommended as any[]).map((r: any, i: number) => [r.post_id, i]));
    const sorted = postsData.sort((a, b) => (orderMap.get(a.id) || 0) - (orderMap.get(b.id) || 0));

    await enrichPosts(sorted);
  }, [user]);

  const enrichPosts = async (postsData: any[]) => {
    if (!user) return;
    const userIds = [...new Set(postsData.map(p => p.user_id))];
    const postIds = postsData.map(p => p.id);

    const [profilesRes, likesRes, commentsRes, userLikesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, avatar_url, username").in("user_id", userIds),
      supabase.from("likes").select("post_id").in("post_id", postIds),
      supabase.from("comments").select("post_id").in("post_id", postIds),
      supabase.from("likes").select("post_id").in("post_id", postIds).eq("user_id", user.id),
    ]);

    const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
    const likesCount = new Map<string, number>();
    (likesRes.data || []).forEach(l => likesCount.set(l.post_id, (likesCount.get(l.post_id) || 0) + 1));
    const commentsCount = new Map<string, number>();
    (commentsRes.data || []).forEach(c => commentsCount.set(c.post_id, (commentsCount.get(c.post_id) || 0) + 1));
    const userLikedSet = new Set((userLikesRes.data || []).map(l => l.post_id));

    const enriched: Post[] = postsData.map(p => ({
      ...p,
      profiles: profileMap.get(p.user_id) || null,
      likes_count: likesCount.get(p.id) || 0,
      comments_count: commentsCount.get(p.id) || 0,
      user_liked: userLikedSet.has(p.id),
    }));

    setVideoPosts(enriched);
    setLoading(false);
  };

  const loadRanking = async () => {
    const weekStart = getWeekStart();
    const { data } = await supabase
      .from("move_rankings" as any)
      .select("*")
      .eq("week_start", weekStart)
      .order("points", { ascending: false })
      .limit(20);

    if (data && (data as any[]).length > 0) {
      const userIds = (data as any[]).map((r: any) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      setRanking((data as any[]).map((r: any) => ({ ...r, profile: profileMap.get(r.user_id) })));
    }
    setShowRanking(true);
  };

  const getWeekStart = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split("T")[0];
  };

  useEffect(() => { loadVideoPosts(); }, [loadVideoPosts]);

  // Track visible reel via IntersectionObserver
  const observerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-index"));
            if (!isNaN(idx)) setVisibleIndex(idx);
          }
        });
      },
      { root: container, threshold: 0.6 }
    );

    observerRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [videoPosts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (videoPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-8">
        <Play className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-display font-bold text-lg">Nenhum Move ainda</h3>
        <p className="text-sm text-muted-foreground mt-1">Seja o primeiro a compartilhar um vídeo!</p>
      </div>
    );
  }

  if (showRanking) {
    return (
      <div className="container py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">🏆 Ranking Semanal</h3>
          <button onClick={() => setShowRanking(false)} className="text-sm text-primary font-medium">Voltar</button>
        </div>
        {ranking.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado esta semana ainda.</p>
        ) : (
          ranking.map((r: any, i: number) => (
            <div key={r.id} className="glass-card p-3 flex items-center gap-3">
              <span className={`font-display font-bold text-lg w-8 text-center ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}
              </span>
              <AvatarWithBadge
                userId={r.user_id}
                avatarUrl={r.profile?.avatar_url}
                fallback={(r.profile?.full_name || "U").slice(0, 2).toUpperCase()}
                className="h-9 w-9"
              />
              <div className="flex-1">
                <p className="font-semibold text-sm">{r.profile?.full_name || "Usuário"}</p>
                <p className="text-xs text-muted-foreground">{r.videos_watched} vídeos • {r.points} pts</p>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Ranking button floating */}
      <button
        onClick={loadRanking}
        className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full"
      >
        <Trophy className="h-4 w-4 text-yellow-400" />
        <span className="text-white text-xs font-bold">Ranking</span>
      </button>

      <div
        ref={containerRef}
        className="h-screen overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollBehavior: "smooth" }}
      >
        {videoPosts.map((post, i) => (
          <div
            key={post.id}
            data-index={i}
            ref={(el) => { if (el) observerRefs.current.set(post.id, el); }}
            className="h-screen w-full snap-start snap-always"
          >
            <MoveReel
              post={post}
              isVisible={i === visibleIndex}
              onRefresh={() => { loadVideoPosts(); onRefresh(); }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MoveFeed;
