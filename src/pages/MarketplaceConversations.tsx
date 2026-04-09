import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";

const MarketplaceConversations = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: convs } = await supabase
      .from("marketplace_conversations")
      .select("*")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("updated_at", { ascending: false });

    if (!convs || convs.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Get other user profiles
    const otherIds = convs.map(c => c.buyer_id === user.id ? c.seller_id : c.buyer_id);
    const uniqueIds = [...new Set(otherIds)];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, username")
      .in("user_id", uniqueIds);
    const profMap = new Map((profiles || []).map(p => [p.user_id, p]));

    // Get last messages
    const convIds = convs.map(c => c.id);
    const { data: lastMsgs } = await supabase
      .from("marketplace_messages")
      .select("conversation_id, content, created_at, sender_id, read_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false });

    // Group by conversation, take first (latest)
    const lastMsgMap = new Map<string, any>();
    (lastMsgs || []).forEach(msg => {
      if (!lastMsgMap.has(msg.conversation_id)) {
        lastMsgMap.set(msg.conversation_id, msg);
      }
    });

    // Count unread per conversation
    const unreadMap = new Map<string, number>();
    (lastMsgs || []).forEach(msg => {
      if (msg.sender_id !== user.id && !msg.read_at) {
        unreadMap.set(msg.conversation_id, (unreadMap.get(msg.conversation_id) || 0) + 1);
      }
    });

    setConversations(convs.map(c => {
      const otherId = c.buyer_id === user.id ? c.seller_id : c.buyer_id;
      const prof = profMap.get(otherId);
      const lastMsg = lastMsgMap.get(c.id);
      return {
        ...c,
        other_name: prof?.full_name || "Usuário",
        other_avatar: prof?.avatar_url || null,
        other_username: prof?.username || "",
        last_message: lastMsg?.content || "",
        last_message_time: lastMsg?.created_at || c.updated_at,
        unread_count: unreadMap.get(c.id) || 0,
      };
    }));

    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-display font-semibold text-foreground">Chat do Marketplace</h1>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-20">
            <MessageCircle className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Nenhuma conversa ainda</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map(c => (
              <button
                key={c.id}
                onClick={() => navigate(`/marketplace-chat/${c.id}`)}
                className="w-full glass-card p-4 flex items-center gap-3 text-left transition-transform active:scale-[0.98]"
              >
                <Avatar className="h-11 w-11">
                  <AvatarImage src={c.other_avatar || undefined} />
                  <AvatarFallback className="bg-secondary text-sm">
                    {(c.other_name || "U")[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-semibold text-sm text-foreground truncate">
                      {c.other_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(c.last_message_time).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-muted-foreground truncate flex-1">
                      {c.last_message || "Nova conversa"}
                    </p>
                    {c.unread_count > 0 && (
                      <Badge className="ml-2 h-5 min-w-[20px] text-[10px] bg-primary text-primary-foreground px-1.5">
                        {c.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default MarketplaceConversations;
