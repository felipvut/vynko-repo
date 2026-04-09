import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Conversation {
  friendId: string;
  friendName: string | null;
  friendAvatar: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

export const useConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get accepted friendships
    const { data: friendships } = await supabase
      .from("friendships")
      .select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted");

    if (!friendships || friendships.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const friendIds = friendships.map(f =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    );

    // Get profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", friendIds);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    // Get all DMs to build conversation summaries
    const { data: messages } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    const convos: Conversation[] = friendIds.map(friendId => {
      const friendMsgs = (messages || []).filter(
        m => (m.sender_id === friendId && m.receiver_id === user.id) ||
             (m.sender_id === user.id && m.receiver_id === friendId)
      );
      const lastMsg = friendMsgs[0] || null;
      const unread = friendMsgs.filter(
        m => m.receiver_id === user.id && !m.read_at
      ).length;
      const profile = profileMap.get(friendId);

      return {
        friendId,
        friendName: profile?.full_name || null,
        friendAvatar: profile?.avatar_url || null,
        lastMessage: lastMsg?.content || null,
        lastMessageAt: lastMsg?.created_at || null,
        unreadCount: unread,
      };
    });

    // Sort: conversations with messages first (most recent), then others
    convos.sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt.localeCompare(a.lastMessageAt);
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return (a.friendName || "").localeCompare(b.friendName || "");
    });

    setConversations(convos);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return { conversations, loading, refresh: load };
};

export const useChat = (friendId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user || !friendId) return;
    setLoading(true);

    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true })
      .limit(200);

    setMessages((data as DirectMessage[]) || []);
    setLoading(false);

    // Mark unread as read
    if (data && data.length > 0) {
      const unread = data.filter(m => m.receiver_id === user.id && !m.read_at);
      if (unread.length > 0) {
        await supabase
          .from("direct_messages")
          .update({ read_at: new Date().toISOString() })
          .eq("receiver_id", user.id)
          .eq("sender_id", friendId)
          .is("read_at", null);
      }
    }
  }, [user, friendId]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !friendId) return;

    const channel = supabase
      .channel(`dm-${[user.id, friendId].sort().join("-")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const msg = payload.new as DirectMessage;
          if (
            (msg.sender_id === user.id && msg.receiver_id === friendId) ||
            (msg.sender_id === friendId && msg.receiver_id === user.id)
          ) {
            setMessages(prev => [...prev, msg]);
            // Auto-mark as read if received
            if (msg.receiver_id === user.id) {
              supabase
                .from("direct_messages")
                .update({ read_at: new Date().toISOString() })
                .eq("id", msg.id);
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, friendId]);

  const send = async (content: string) => {
    if (!user || !friendId || !content.trim()) return;
    await supabase.from("direct_messages").insert({
      sender_id: user.id,
      receiver_id: friendId,
      content: content.trim(),
    } as any);
  };

  return { messages, loading, send, refresh: load };
};
