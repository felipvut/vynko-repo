import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus } from "lucide-react";
import StoryViewer from "./StoryViewer";

export interface StoryUser {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  stories: StoryItem[];
  hasUnseen: boolean;
  score?: number;
}

export interface StoryItem {
  id: string;
  user_id: string;
  image_url: string | null;
  video_url: string | null;
  content: string | null;
  created_at: string;
  post_type: string;
  overlays?: any[];
}

interface StoriesBarProps {
  onAddStory: () => void;
  refreshKey?: number;
}

const StoriesBar = ({ onAddStory, refreshKey }: StoriesBarProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [storyUsers, setStoryUsers] = useState<StoryUser[]>([]);
  const [selectedUserIndex, setSelectedUserIndex] = useState<number | null>(null);
  const [ownProfile, setOwnProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadStories = useCallback(async () => {
    if (!user) return;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: posts } = await supabase
      .from("posts")
      .select("id, user_id, image_url, video_url, content, created_at, post_type, overlays")
      .eq("post_type", "move")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (!posts || posts.length === 0) {
      setStoryUsers([]);
      return;
    }

    const postIds = posts.map(p => p.id);
    const userIds = [...new Set(posts.map(p => p.user_id))];

    // Parallel fetch: views, profiles, interaction counts for scoring
    const [viewedRes, profilesRes, likesGivenRes, commentsGivenRes] = await Promise.all([
      supabase.from("move_views").select("post_id").eq("user_id", user.id).in("post_id", postIds),
      supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", [...userIds, user.id]),
      // How many likes the current user gave to posts by each creator (interaction frequency)
      supabase.from("likes").select("post_id").eq("user_id", user.id),
      supabase.from("comments").select("post_id").eq("user_id", user.id),
    ]);

    const viewedSet = new Set((viewedRes.data || []).map(v => v.post_id));
    const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));

    // Build interaction frequency map: how much current user interacts with each creator
    const interactionCount = new Map<string, number>();
    const allUserPostIds = new Set(posts.map(p => p.id));
    [...(likesGivenRes.data || []), ...(commentsGivenRes.data || [])].forEach(item => {
      if (allUserPostIds.has(item.post_id)) {
        const post = posts.find(p => p.id === item.post_id);
        if (post) {
          interactionCount.set(post.user_id, (interactionCount.get(post.user_id) || 0) + 1);
        }
      }
    });

    // Group stories by user
    const userMap = new Map<string, StoryItem[]>();
    posts.forEach(p => {
      const list = userMap.get(p.user_id) || [];
      list.push({ ...p, overlays: Array.isArray(p.overlays) ? p.overlays : [] } as StoryItem);
      userMap.set(p.user_id, list);
    });

    // Build StoryUser list with score-based ordering
    const result: StoryUser[] = [];

    userMap.forEach((stories, userId) => {
      const profile = profileMap.get(userId);
      const hasUnseen = stories.some(s => !viewedSet.has(s.id));
      
      // Score calculation:
      // Recência da publicação × peso 4
      const latestStory = stories[stories.length - 1];
      const recencyHours = (Date.now() - new Date(latestStory.created_at).getTime()) / (1000 * 60 * 60);
      const recencyScore = Math.max(0, (24 - recencyHours) / 24) * 4;
      
      // Interação recente × peso 3
      const interactionScore = Math.min((interactionCount.get(userId) || 0), 10) / 10 * 3;
      
      // Frequência de visualização × peso 2
      const viewedCount = stories.filter(s => viewedSet.has(s.id)).length;
      const viewFreqScore = Math.min(viewedCount, 5) / 5 * 2;

      const totalScore = recencyScore + interactionScore + viewFreqScore;

      result.push({
        user_id: userId,
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
        stories,
        hasUnseen,
        score: totalScore,
      });
    });

    // Sort: own user first, then unseen first, then by score descending
    result.sort((a, b) => {
      if (a.user_id === user.id) return -1;
      if (b.user_id === user.id) return 1;
      if (a.hasUnseen && !b.hasUnseen) return -1;
      if (!a.hasUnseen && b.hasUnseen) return 1;
      return (b.score || 0) - (a.score || 0);
    });

    // Store own profile for the + button
    setOwnProfile(profileMap.get(user.id) || null);
    setStoryUsers(result);
  }, [user]);

  useEffect(() => { loadStories(); }, [loadStories, refreshKey]);

  const initials = (name: string | null) =>
    (name || "U").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const handleStoryViewed = () => {
    // Refresh to update borders
    loadStories();
  };

  return (
    <>
      <div
        ref={scrollRef}
        className="flex items-center gap-3 px-4 py-3 overflow-x-auto scrollbar-hide"
      >
        {/* Add story button */}
        <button onClick={onAddStory} className="flex flex-col items-center gap-1 shrink-0">
          <div className="relative">
            <div className="h-[62px] w-[62px] rounded-full bg-muted overflow-hidden">
              <Avatar className="h-full w-full">
                <AvatarImage src={ownProfile?.avatar_url || undefined} />
                <AvatarFallback className="bg-muted text-muted-foreground text-lg">
                  {initials(ownProfile?.full_name || null)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center border-2 border-background">
              <Plus className="h-3 w-3 text-primary-foreground" />
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground w-16 text-center truncate">
            Seu Move
          </span>
        </button>

        {/* Story users */}
        {storyUsers.map((su, index) => (
          <button
            key={su.user_id}
            onClick={() => setSelectedUserIndex(index)}
            className="flex flex-col items-center gap-1 shrink-0"
          >
            <div
              className={`h-[66px] w-[66px] rounded-full p-[3px] ${
                su.hasUnseen
                  ? "bg-gradient-to-tr from-primary via-accent to-primary"
                  : "bg-muted-foreground/30"
              }`}
            >
              <div className="h-full w-full rounded-full bg-background p-[2px]">
                <Avatar className="h-full w-full">
                  <AvatarImage src={su.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-muted">{initials(su.full_name)}</AvatarFallback>
                </Avatar>
              </div>
            </div>
            <span className="text-[10px] text-foreground w-16 text-center truncate">
              {su.user_id === user?.id ? "Você" : (su.full_name?.split(" ")[0] || "Usuário")}
            </span>
          </button>
        ))}
      </div>

      {/* Story Viewer */}
      {selectedUserIndex !== null && (
        <StoryViewer
          storyUsers={storyUsers}
          initialUserIndex={selectedUserIndex}
          onClose={() => {
            setSelectedUserIndex(null);
            handleStoryViewed();
          }}
        />
      )}
    </>
  );
};

export default StoriesBar;
