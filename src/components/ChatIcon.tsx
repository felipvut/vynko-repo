import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const ChatIcon = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .is("read_at", null);
    setUnreadCount(count || 0);
  }, [user]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  // Realtime subscription for new DMs
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("dm-unread-badge")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `receiver_id=eq.${user.id}` },
        () => fetchUnread()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages", filter: `receiver_id=eq.${user.id}` },
        () => fetchUnread()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchUnread]);

  return (
    <Button variant="ghost" size="sm" className="relative" onClick={() => navigate("/messages")}>
      <MessageSquare className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Button>
  );
};

export default ChatIcon;
