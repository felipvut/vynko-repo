import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const MarketplaceChat = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
  };

  const loadConversation = useCallback(async () => {
    if (!user || !conversationId) return;
    setLoading(true);

    const { data: conv } = await supabase
      .from("marketplace_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (!conv) {
      navigate("/seller-dashboard");
      return;
    }
    setConversation(conv);

    const otherId = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id;
    const { data: prof } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url, username")
      .eq("user_id", otherId)
      .single();
    setOtherUser(prof);

    const { data: msgs } = await supabase
      .from("marketplace_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);
    setMessages(msgs || []);

    // Mark messages as read
    await supabase
      .from("marketplace_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .neq("sender_id", user.id)
      .is("read_at", null);

    setLoading(false);
    scrollToBottom();
  }, [user, conversationId]);

  useEffect(() => { loadConversation(); }, [loadConversation]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`mkt-chat-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "marketplace_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        scrollToBottom();
        // Mark as read if from other user
        if (user && (payload.new as any).sender_id !== user.id) {
          supabase
            .from("marketplace_messages")
            .update({ read_at: new Date().toISOString() })
            .eq("id", (payload.new as any).id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user]);

  const handleSend = async () => {
    if (!message.trim() || !user || !conversationId || sending) return;
    setSending(true);
    const content = message.trim();
    setMessage("");

    const { error } = await supabase.from("marketplace_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
    } as any);

    if (error) {
      toast({ title: "Erro ao enviar mensagem", variant: "destructive" });
      setMessage(content);
    }

    // Update conversation updated_at
    await supabase
      .from("marketplace_conversations")
      .update({ updated_at: new Date().toISOString() } as any)
      .eq("id", conversationId);

    setSending(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !conversationId) return;

    const ext = file.name.split(".").pop();
    const path = `${user.id}/chat/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("marketplace").upload(path, file);
    if (upErr) {
      toast({ title: "Erro ao enviar imagem", variant: "destructive" });
      return;
    }

    const { data: urlData } = supabase.storage.from("marketplace").getPublicUrl(path);

    await supabase.from("marketplace_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: "📷 Imagem",
      image_url: urlData.publicUrl,
    } as any);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <Avatar className="h-8 w-8">
          <AvatarImage src={otherUser?.avatar_url || undefined} />
          <AvatarFallback className="text-xs bg-secondary">
            {(otherUser?.full_name || "U")[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-semibold text-foreground text-sm truncate">
            {otherUser?.full_name || "Usuário"}
          </h1>
          <p className="text-[10px] text-muted-foreground">@{otherUser?.username || ""}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">Nenhuma mensagem ainda</p>
        )}
        {messages.map((msg: any) => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  isMe
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-secondary text-foreground rounded-bl-md"
                }`}
              >
                {msg.image_url && (
                  <img src={msg.image_url} alt="" className="rounded-lg max-w-full mb-1" />
                )}
                {msg.content && msg.content !== "📷 Imagem" && (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
                <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="border-t border-border/50 bg-card/95 backdrop-blur-xl px-4 py-3">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <label className="p-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
            <ImageIcon className="h-5 w-5" />
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
          <Input
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Digite sua mensagem..."
            className="bg-secondary/50 border-border/50"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="shrink-0 gradient-primary text-primary-foreground"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceChat;
