import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Volume2, VolumeX, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { StoryUser } from "./StoriesBar";

interface StoryViewerProps {
  storyUsers: StoryUser[];
  initialUserIndex: number;
  onClose: () => void;
}

const STORY_DURATION = 6000; // 6s per image story

const StoryViewer = ({ storyUsers, initialUserIndex, onClose }: StoryViewerProps) => {
  const { user } = useAuth();
  const [userIndex, setUserIndex] = useState(initialUserIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const currentUser = storyUsers[userIndex];
  const currentStory = currentUser?.stories[storyIndex];
  const isVideo = currentStory?.video_url != null;

  // Mark story as viewed
  const markViewed = useCallback(async (postId: string) => {
    if (!user) return;
    try {
      await supabase.from("move_views").upsert(
        { user_id: user.id, post_id: postId, watched_complete: true } as any,
        { onConflict: "user_id,post_id" }
      );
    } catch {}
  }, [user]);

  // Navigate to next story
  const goNext = useCallback(() => {
    if (!currentUser) return;
    if (storyIndex < currentUser.stories.length - 1) {
      setStoryIndex(i => i + 1);
      setProgress(0);
    } else if (userIndex < storyUsers.length - 1) {
      setUserIndex(i => i + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentUser, storyIndex, userIndex, storyUsers.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(i => i - 1);
      setProgress(0);
    } else if (userIndex > 0) {
      setUserIndex(i => i - 1);
      const prevUser = storyUsers[userIndex - 1];
      setStoryIndex(prevUser.stories.length - 1);
      setProgress(0);
    }
  }, [storyIndex, userIndex, storyUsers]);

  // Mark current story as viewed
  useEffect(() => {
    if (currentStory) markViewed(currentStory.id);
  }, [currentStory, markViewed]);

  // Timer for image stories
  useEffect(() => {
    if (!currentStory || isVideo || paused) return;

    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / STORY_DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(interval);
        goNext();
      }
    }, 50);

    timerRef.current = interval as unknown as number;
    return () => clearInterval(interval);
  }, [currentStory?.id, isVideo, paused, goNext]);

  // Video progress tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo) return;

    video.currentTime = 0;
    video.play().catch(() => {});

    const onTime = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };
    const onEnd = () => goNext();

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", onEnd);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", onEnd);
    };
  }, [currentStory?.id, isVideo, goNext]);

  // Tap zones
  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let clientX: number;
    if ("touches" in e) {
      clientX = e.changedTouches[0].clientX;
    } else {
      clientX = e.clientX;
    }
    const x = clientX - rect.left;
    const third = rect.width / 3;

    if (x < third) {
      goPrev();
    } else if (x > third * 2) {
      goNext();
    } else {
      // Middle tap — pause/resume
      setPaused(p => !p);
      if (videoRef.current) {
        if (videoRef.current.paused) videoRef.current.play();
        else videoRef.current.pause();
      }
    }
  };

  // Swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;

    if (Math.abs(dy) > 100 && dy > 0 && Math.abs(dy) > Math.abs(dx)) {
      // Swipe down → close
      onClose();
    } else if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        // Swipe left → next user
        if (userIndex < storyUsers.length - 1) {
          setUserIndex(i => i + 1);
          setStoryIndex(0);
          setProgress(0);
        } else {
          onClose();
        }
      } else {
        // Swipe right → prev user
        if (userIndex > 0) {
          setUserIndex(i => i - 1);
          const prevUser = storyUsers[userIndex - 1];
          setStoryIndex(prevUser.stories.length - 1);
          setProgress(0);
        }
      }
    } else {
      // Treat as tap
      handleTap(e);
    }
    touchStartRef.current = null;
  };

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  if (!currentUser || !currentStory) return null;

  const initials = (currentUser.full_name || "U").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      {/* Story content area */}
      <div
        className="relative w-full h-full max-w-[430px] mx-auto"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleTap}
      >
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-2 pt-2">
          {currentUser.stories.map((_, i) => (
            <div key={i} className="flex-1 h-[2px] bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{
                  width: i < storyIndex ? "100%" : i === storyIndex ? `${progress}%` : "0%",
                  transition: i === storyIndex ? "width 0.1s linear" : "none",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-4 left-0 right-0 z-20 flex items-center justify-between px-3 pt-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 border border-white/50">
              <AvatarImage src={currentUser.avatar_url || undefined} />
              <AvatarFallback className="text-[10px] bg-muted">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-white text-sm font-semibold drop-shadow-lg">
                {currentUser.full_name || "Usuário"}
              </p>
              <p className="text-white/60 text-[10px] drop-shadow-lg">
                {formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2" onTouchEnd={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            {isVideo && (
              <button
                onClick={() => setMuted(m => !m)}
                className="p-2"
              >
                {muted ? <VolumeX className="h-5 w-5 text-white" /> : <Volume2 className="h-5 w-5 text-white" />}
              </button>
            )}
            <button
              onClick={() => onClose()}
              className="p-2"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* Media */}
        {isVideo ? (
          <video
            ref={videoRef}
            src={currentStory.video_url!}
            className="w-full h-full object-contain"
            muted={muted}
            playsInline
            preload="auto"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={currentStory.image_url!}
              alt=""
              className="w-full h-full object-contain"
            />
          </div>
        )}

        {/* Overlays from editor */}
        {(() => {
          const storyOverlays: any[] = currentStory.overlays || [];
          if (storyOverlays.length === 0) return null;
          return (
            <div className="absolute inset-0 pointer-events-none z-10">
              {storyOverlays.map((o: any, i: number) => (
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
              ))}
            </div>
          );
        })()}

        {/* Caption overlay */}
        {currentStory.content && (
          <div className="absolute bottom-16 left-0 right-0 z-20 px-4">
            <p className="text-white text-sm drop-shadow-lg bg-black/30 backdrop-blur-sm rounded-lg px-3 py-2">
              {currentStory.content}
            </p>
          </div>
        )}

        {/* Navigation arrows (desktop) */}
        {userIndex > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setUserIndex(i => i - 1); setStoryIndex(0); setProgress(0); }}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 hidden md:flex h-8 w-8 rounded-full bg-white/20 items-center justify-center"
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
        )}
        {userIndex < storyUsers.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); setUserIndex(i => i + 1); setStoryIndex(0); setProgress(0); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 hidden md:flex h-8 w-8 rounded-full bg-white/20 items-center justify-center"
          >
            <ChevronRight className="h-5 w-5 text-white" />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};

export default StoryViewer;
