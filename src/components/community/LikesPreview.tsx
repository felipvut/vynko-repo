import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  postId: string;
  likesCount: number;
  onShowAll: () => void;
}

interface LikerPreview {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string;
}

const LikesPreview = ({ postId, likesCount, onShowAll }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [likers, setLikers] = useState<LikerPreview[]>([]);

  useEffect(() => {
    if (!user || likesCount === 0) return;

    (async () => {
      // Get all likers for this post
      const { data: likes } = await supabase
        .from("likes")
        .select("user_id")
        .eq("post_id", postId)
        .limit(20);

      if (!likes || likes.length === 0) return;

      const userIds = likes.map(l => l.user_id);

      const [profilesRes, followsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url, username").in("user_id", userIds),
        supabase.from("follows").select("following_id").eq("follower_id", user.id).in("following_id", userIds),
      ]);

      const followedSet = new Set((followsRes.data || []).map(f => f.following_id));
      const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));

      const result = userIds.map(uid => {
        const p = profileMap.get(uid);
        return {
          user_id: uid,
          full_name: p?.full_name || null,
          avatar_url: p?.avatar_url || null,
          username: p?.username || "",
          is_followed: followedSet.has(uid),
        };
      });

      // Sort: followed users first
      result.sort((a, b) => (b.is_followed ? 1 : 0) - (a.is_followed ? 1 : 0));
      setLikers(result.slice(0, 3));
    })();
  }, [postId, likesCount, user]);

  if (likers.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <div className="flex -space-x-2">
        {likers.map(l => {
          const initials = (l.full_name || "U").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
          return (
            <Avatar key={l.user_id} className="h-5 w-5 border border-background">
              <AvatarImage src={l.avatar_url || undefined} />
              <AvatarFallback className="text-[8px] bg-primary/20 text-primary">{initials}</AvatarFallback>
            </Avatar>
          );
        })}
      </div>
      <span>
        Curtido por{" "}
        <button onClick={() => navigate(`/u/${likers[0].username}`)} className="font-semibold text-foreground hover:underline">
          {likers[0].full_name || "Usuário"}
        </button>
        {likesCount > 1 && (
          <>
            {" "}e{" "}
            <button onClick={onShowAll} className="font-semibold text-foreground hover:underline">
              mais {likesCount - 1}
            </button>
          </>
        )}
      </span>
    </div>
  );
};

export default LikesPreview;
