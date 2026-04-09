import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Share2, MoreHorizontal, Flag, Volume2, VolumeX, Play } from "lucide-react";
import ReportDialog from "./ReportDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarWithBadge from "@/components/profile/AvatarWithBadge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Post } from "@/hooks/useCommunity";
import { renderMentions } from "./MentionTextarea";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import CommentsSheet from "./CommentsSheet";
import LikesSheet from "./LikesSheet";
import LikesPreview from "./LikesPreview";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PostCardProps {
  post: Post;
  onRefresh: () => void;
}

const VideoPlayer = ({ src, aspectSquare = true }: { src: string; aspectSquare?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
          setPlaying(true);
        } else {
          video.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play().catch(() => {}); setPlaying(true); }
    else { video.pause(); setPlaying(false); }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-lg bg-secondary/30`}
      style={aspectSquare ? { aspectRatio: '1 / 1' } : {}}
    >
      <video
        ref={videoRef}
        src={src}
        className={`${aspectSquare ? 'absolute inset-0 w-full h-full object-cover' : 'w-full max-h-[80vh] object-contain'}`}
        loop muted={muted} playsInline preload="metadata" onClick={togglePlay}
      />
      {!playing && (
        <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Play className="h-12 w-12 text-white/90 fill-white/90" />
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}
        className="absolute bottom-3 right-3 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center"
      >
        {muted ? <VolumeX className="h-4 w-4 text-white" /> : <Volume2 className="h-4 w-4 text-white" />}
      </button>
    </div>
  );
};

const PostCard = ({ post, onRefresh }: PostCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(post.user_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const isOwn = user?.id === post.user_id;

  const goToProfile = () => {
    const username = post.profiles?.username;
    if (username) navigate(`/u/${username}`);
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

  const deletePost = async () => {
    await supabase.from("posts").delete().eq("id", post.id);
    toast.success("Post removido");
    onRefresh();
  };

  const share = () => {
    const url = window.location.origin;
    const text = post.content ? `${post.profiles?.full_name}: ${post.content.slice(0, 100)}` : "Confira este post no Vynko!";
    if (navigator.share) {
      navigator.share({ title: "Vynko", text, url });
    } else {
      navigator.clipboard.writeText(`${text} - ${url}`);
      toast.success("Link copiado!");
    }
  };

  const initials = (post.profiles?.full_name || "U").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const videoUrl = post.video_url;

  return (
    <>
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={goToProfile} className="flex items-center gap-3 text-left">
            <AvatarWithBadge
              userId={post.user_id}
              avatarUrl={post.profiles?.avatar_url}
              fallback={initials}
              className="h-9 w-9"
            />
            <div>
              <p className="font-semibold text-sm">{post.profiles?.full_name || "Usuário"}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isOwn && <DropdownMenuItem onClick={deletePost} className="text-destructive">Excluir post</DropdownMenuItem>}
              {!isOwn && <DropdownMenuItem onClick={() => setShowReport(true)}><Flag className="h-4 w-4 mr-2" />Denunciar</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {post.content && <p className="text-sm whitespace-pre-wrap">{renderMentions(post.content)}</p>}

        {post.hashtags && post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.hashtags.map(tag => (
              <span key={tag} className="text-primary text-xs font-semibold">#{tag}</span>
            ))}
          </div>
        )}

        {videoUrl && <VideoPlayer src={videoUrl} />}

        {!videoUrl && post.image_url && (
          <div className="relative w-full overflow-hidden rounded-lg bg-secondary/30" style={{ aspectRatio: '1 / 1' }}>
            <img src={post.image_url} alt="Post" className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" />
          </div>
        )}

        <div className="flex items-center gap-4 pt-1">
          <button onClick={toggleLike} className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors">
            <Heart className={`h-5 w-5 ${liked ? "fill-primary text-primary" : ""}`} />
            <span>{likesCount}</span>
          </button>
          <button onClick={() => setShowComments(true)} className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors">
            <MessageCircle className="h-5 w-5" />
            <span>{post.comments_count || 0}</span>
          </button>
          <button onClick={share} className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors ml-auto">
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        {/* Likes preview */}
        {likesCount > 0 && (
          <LikesPreview postId={post.id} likesCount={likesCount} onShowAll={() => setShowLikes(true)} />
        )}
      </div>

      <CommentsSheet postId={post.id} open={showComments} onOpenChange={setShowComments} onCommentAdded={onRefresh} />
      <LikesSheet postId={post.id} open={showLikes} onOpenChange={setShowLikes} />
      <ReportDialog open={showReport} onOpenChange={setShowReport} postId={post.id} postUserId={post.user_id} onActionTaken={onRefresh} />
    </>
  );
};

export default PostCard;
