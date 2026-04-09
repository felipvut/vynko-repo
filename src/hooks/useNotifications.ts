import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  actor_id: string | null;
  reference_id: string | null;
  read_at: string | null;
  created_at: string;
  actor_profile?: { full_name: string | null; username: string; avatar_url: string | null } | null;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching notifications:", error);
      return;
    }

    // Fetch actor profiles
    const actorIds = [...new Set((data || []).filter(n => n.actor_id).map(n => n.actor_id!))];
    let profilesMap: Record<string, any> = {};

    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, username, avatar_url")
        .in("user_id", actorIds);

      if (profiles) {
        profilesMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));
      }
    }

    const enriched = (data || []).map(n => ({
      ...n,
      actor_profile: n.actor_id ? profilesMap[n.actor_id] || null : null,
    }));

    setNotifications(enriched);
    setUnreadCount(enriched.filter(n => !n.read_at).length);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);

    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);

    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setUnreadCount(0);
  }, [user]);

  // Check for expiry notifications on mount
  useEffect(() => {
    if (!user) return;
    const checkExpiry = async () => {
      const now = new Date();

      // Check training program expiry
      const { data: programs } = await supabase
        .from("training_programs")
        .select("id, name, expires_at")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (programs) {
        for (const p of programs) {
          const expiresAt = new Date(p.expires_at);
          const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysLeft <= 3 && daysLeft >= 0) {
            const { data: existing } = await supabase
              .from("notifications")
              .select("id")
              .eq("user_id", user.id)
              .eq("type", "workout_expiring")
              .eq("reference_id", p.id)
              .limit(1);

            if (!existing?.length) {
              await supabase.from("notifications").insert({
                user_id: user.id,
                type: "workout_expiring",
                title: daysLeft === 0 ? "Seu treino expira hoje!" : `Seu treino expira em ${daysLeft} dia${daysLeft > 1 ? "s" : ""}`,
                reference_id: p.id,
              } as any);
            }
          }
        }
      }

      // Check anamnesis expiry (45 days)
      const { data: anamnesis } = await supabase
        .from("anamnesis")
        .select("id, updated_at")
        .eq("user_id", user.id)
        .eq("completed", true)
        .maybeSingle();

      if (anamnesis) {
        const updatedAt = new Date(anamnesis.updated_at);
        const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceUpdate >= 45) {
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", user.id)
            .eq("type", "anamnesis_expired")
            .gte("created_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .limit(1);

          if (!existing?.length) {
            await supabase.from("notifications").insert({
              user_id: user.id,
              type: "anamnesis_expired",
              title: "Faz um tempinho desde sua última atualização, revise suas preferências rapidinho!",
              reference_id: anamnesis.id,
            } as any);
          }
        }
      }

      // Check training inactivity alerts (3, 7, 10, 15, 21, 30 days)
      const { data: lastSession } = await supabase
        .from("workout_sessions")
        .select("started_at")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(1);

      if (lastSession?.length) {
        const lastDate = new Date(lastSession[0].started_at);
        const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        const thresholds = [3, 7, 10, 15, 21, 30];
        
        for (const threshold of thresholds) {
          if (daysSince >= threshold) {
            const alertType = `inactivity_${threshold}d`;
            const { data: existing } = await supabase
              .from("notifications")
              .select("id")
              .eq("user_id", user.id)
              .eq("type", alertType)
              .gte("created_at", new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
              .limit(1);

            if (!existing?.length) {
              const messages: Record<number, string> = {
                3: "Já faz 3 dias sem treinar. Bora voltar? 💪",
                7: "1 semana sem treinar! Não perca seu progresso.",
                10: "10 dias sem treinar. Seu corpo sente falta!",
                15: "15 dias parado. Que tal retomar hoje?",
                21: "3 semanas sem treinar! Volte antes que perca seus ganhos.",
                30: "1 mês sem treinar! É hora de recomeçar. 🚀",
              };
              await supabase.from("notifications").insert({
                user_id: user.id,
                type: alertType,
                title: messages[threshold] || `${daysSince} dias sem treinar`,
              } as any);
            }
            break; // Only send the highest applicable threshold
          }
        }
      }
    };

    checkExpiry();
  }, [user]);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh: fetchNotifications };
}
