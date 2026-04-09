import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface MentionSuggestion {
  user_id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
}

export const useMentionSuggestions = () => {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!user || query.length < 1) {
      setSuggestions([]);
      return;
    }

    setLoading(true);

    // Get people I follow + people who follow me
    const [followingRes, followersRes] = await Promise.all([
      supabase.from("follows").select("following_id").eq("follower_id", user.id),
      supabase.from("follows").select("follower_id").eq("following_id", user.id),
    ]);

    const ids = new Set<string>();
    (followingRes.data || []).forEach(f => ids.add(f.following_id));
    (followersRes.data || []).forEach(f => ids.add(f.follower_id));
    ids.delete(user.id);

    if (ids.size === 0) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, username")
      .in("user_id", [...ids])
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(6);

    setSuggestions((profiles || []) as MentionSuggestion[]);
    setLoading(false);
  }, [user]);

  const clear = useCallback(() => {
    setSuggestions([]);
  }, []);

  return { suggestions, loading, search, clear };
};
