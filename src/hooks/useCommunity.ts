import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Post {
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
  // joined
  profiles?: { full_name: string | null; avatar_url: string | null; username?: string } | null;
  likes_count?: number;
  comments_count?: number;
  user_liked?: boolean;
}

export interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null; username?: string } | null;
}

export interface FriendRequest {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
}

export const useFeed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeed = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get hidden post IDs
    const { data: hiddenData } = await supabase
      .from("hidden_posts")
      .select("post_id")
      .eq("user_id", user.id);
    const hiddenIds = new Set((hiddenData || []).map(h => h.post_id));

    // Fetch all accessible posts (RLS handles visibility: public, friends, own)
    const { data: postsData } = await supabase
      .from("posts")
      .select("*")
      .neq("post_type", "move")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!postsData) { setLoading(false); return; }

    // Filter out hidden posts client-side
    const filteredPosts = postsData.filter(p => !hiddenIds.has(p.id));

    // Get profiles, likes counts, comments counts
    const userIds = [...new Set(filteredPosts.map(p => p.user_id))];
    const postIds = filteredPosts.map(p => p.id);

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

    const enriched: Post[] = filteredPosts.map(p => ({
      ...p,
      profiles: profileMap.get(p.user_id) || null,
      likes_count: likesCount.get(p.id) || 0,
      comments_count: commentsCount.get(p.id) || 0,
      user_liked: userLikedSet.has(p.id),
    }));

    setPosts(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  return { posts, loading, refresh: loadFeed };
};

export const useComments = (postId: string | null) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (!data) { setLoading(false); return; }

    const userIds = [...new Set(data.map(c => c.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url, username").in("user_id", userIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    setComments(data.map(c => ({ ...c, profiles: profileMap.get(c.user_id) || null })));
    setLoading(false);
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  return { comments, loading, refresh: load };
};

export const useFriendships = () => {
  const { user } = useAuth();
  const [pending, setPending] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from("friendships")
      .select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (!data) { setLoading(false); return; }

    const otherIds = data.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", otherIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    const enriched = data.map(f => {
      const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
      return { ...f, profiles: profileMap.get(otherId) || null };
    });

    setPending(enriched.filter(f => f.status === "pending" && f.addressee_id === user.id));
    setFriends(enriched.filter(f => f.status === "accepted"));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return { pending, friends, loading, refresh: load };
};
