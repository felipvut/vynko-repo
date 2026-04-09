import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserXp {
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_workout_date: string | null;
}

export interface Badge {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  category: string;
}

export interface UserBadge {
  badge_id: string;
  earned_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  total_xp: number;
  level: number;
  current_streak: number;
  full_name: string;
  avatar_url: string | null;
}

const XP_PER_LEVEL = 200;

export function xpForNextLevel(level: number) {
  return level * XP_PER_LEVEL;
}

export function xpProgress(totalXp: number, level: number) {
  const currentLevelXp = (level - 1) * XP_PER_LEVEL;
  const nextLevelXp = level * XP_PER_LEVEL;
  return ((totalXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;
}

export function useGamification() {
  const { user } = useAuth();
  const [userXp, setUserXp] = useState<UserXp | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [xpRes, badgesRes, earnedRes, lbRes] = await Promise.all([
        supabase.from("user_xp").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("badges").select("*").order("category"),
        supabase.from("user_badges").select("*").eq("user_id", user.id),
        supabase.from("user_xp").select("*").order("total_xp", { ascending: false }).limit(20),
      ]);

      if (xpRes.data) {
        setUserXp(xpRes.data as any);
      } else {
        setUserXp({ total_xp: 0, level: 1, current_streak: 0, longest_streak: 0, last_workout_date: null });
      }

      setBadges((badgesRes.data || []) as any);
      setEarnedBadges((earnedRes.data || []) as any);

      // Enrich leaderboard with profile names
      const lbData = lbRes.data || [];
      const enriched = await Promise.all(
        lbData.map(async (entry: any) => {
          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("user_id", entry.user_id)
            .maybeSingle();
          return {
            ...entry,
            full_name: prof?.full_name || "Anônimo",
            avatar_url: prof?.avatar_url || null,
          };
        })
      );
      setLeaderboard(enriched);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const triggerGamification = async () => {
    if (!user) return null;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const res = await supabase.functions.invoke("gamification", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (res.error) {
      console.error("Gamification error:", res.error);
      return null;
    }

    // Refresh data
    await fetch();
    return res.data;
  };

  return {
    userXp,
    badges,
    earnedBadges,
    leaderboard,
    loading,
    triggerGamification,
    refresh: fetch,
  };
}
