import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, MessageSquare, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useConversations } from "@/hooks/useDirectMessages";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const DirectMessages = () => {
  const navigate = useNavigate();
  const { conversations, loading } = useConversations();
  const [search, setSearch] = useState("");

  const filtered = conversations.filter(c =>
    !search.trim() || (c.friendName || "").toLowerCase().includes(search.toLowerCase())
  );

  const initials = (name: string | null) =>
    (name || "U").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-display font-bold text-lg">Mensagens</span>
          </div>
        </div>
      </header>

      <div className="container mt-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar conversa..."
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-8 text-center space-y-4">
            <MessageSquare className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-xl font-display font-bold">Nenhuma conversa</h2>
            <p className="text-muted-foreground text-sm">
              Adicione amigos para começar a conversar!
            </p>
          </motion.div>
        ) : (
          filtered.map((conv, i) => (
            <motion.div
              key={conv.friendId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass-card p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => navigate(`/dm/${conv.friendId}`)}
            >
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={conv.friendAvatar || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {initials(conv.friendName)}
                  </AvatarFallback>
                </Avatar>
                {conv.unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                    {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm truncate">{conv.friendName || "Usuário"}</p>
                  {conv.lastMessageAt && (
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true, locale: ptBR })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {conv.lastMessage || "Nenhuma mensagem ainda"}
                </p>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default DirectMessages;
