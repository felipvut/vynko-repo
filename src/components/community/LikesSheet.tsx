import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LikeUser {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string;
  is_followed: boolean;
}

const LikesSheet = ({ postId, open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<LikeUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);

    (async () => {
      const { data: likes } = await supabase
        .from("likes")
        .select("user_id")
        .eq("post_id", postId);

      if (!likes || likes.length === 0) { setUsers([]); setLoading(false); return; }

      const userIds = likes.map(l => l.user_id);

      const [profilesRes, followsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url, username").in("user_id", userIds),
        supabase.from("follows").select("following_id").eq("follower_id", user.id).in("following_id", userIds),
      ]);

      const followedSet = new Set((followsRes.data || []).map(f => f.following_id));
      const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));

      const result: LikeUser[] = userIds.map(uid => {
        const p = profileMap.get(uid);
        return {
          user_id: uid,
          full_name: p?.full_name || null,
          avatar_url: p?.avatar_url || null,
          username: p?.username || "",
          is_followed: followedSet.has(uid),
        };
      });

      // Sort: followed first, then others
      result.sort((a, b) => (b.is_followed ? 1 : 0) - (a.is_followed ? 1 : 0));
      setUsers(result);
      setLoading(false);
    })();
  }, [open, postId, user]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[60vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Curtidas</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto space-y-2 py-3">
          {loading && <p className="text-sm text-muted-foreground text-center">Carregando...</p>}
          {!loading && users.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma curtida ainda.</p>}
          {users.map(u => {
            const initials = (u.full_name || "U").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
            return (
              <button
                key={u.user_id}
                onClick={() => { onOpenChange(false); navigate(`/u/${u.username}`); }}
                className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-accent transition-colors text-left"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={u.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/20 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">{u.full_name || "Usuário"}</p>
                  {u.username && <p className="text-xs text-muted-foreground">@{u.username}</p>}
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default LikesSheet;
export type { LikeUser };
