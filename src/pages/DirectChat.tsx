import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useDirectMessages";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const DirectChat = () => {
  const { friendId } = useParams<{ friendId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { messages, loading, send } = useChat(friendId || null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [friendProfile, setFriendProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);

  useEffect(() => {
    if (friendId) {
      supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", friendId)
        .maybeSingle()
        .then(({ data }) => setFriendProfile(data));
    }
  }, [friendId]);

  useEffect(() => {
    const useSmooth = initialScrollDone.current;
    if (!initialScrollDone.current) initialScrollDone.current = true;
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: useSmooth ? "smooth" : "auto" });
    });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    await send(text);
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const initials = (name: string | null) =>
    (name || "U").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center gap-3 h-14">
          <Button variant="ghost" size="sm" onClick={() => navigate("/messages")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarImage src={friendProfile?.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-primary/20 text-primary">
              {initials(friendProfile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <span
            className="font-display font-bold cursor-pointer hover:text-primary transition-colors"
            onClick={() => navigate(`/profile/${friendId}`)}
          >
            {friendProfile?.full_name || "Carregando..."}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-muted-foreground text-sm">Nenhuma mensagem ainda.</p>
            <p className="text-muted-foreground text-xs">Diga olá! 👋</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <motion.div
                key={msg.id}
                initial={initialScrollDone.current && i >= messages.length - 2 ? { opacity: 0, y: 5 } : false}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  isMe
                    ? "gradient-primary text-primary-foreground rounded-br-md"
                    : "bg-secondary text-secondary-foreground rounded-bl-md"
                }`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border/50 bg-card/50 backdrop-blur-xl p-4">
        <div className="container flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            className="bg-secondary resize-none min-h-[44px] max-h-[120px]"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="gradient-primary text-primary-foreground h-[44px] w-[44px] p-0 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DirectChat;
