import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useComments } from "@/hooks/useCommunity";
import { useMentionSuggestions } from "@/hooks/useMentionSuggestions";
import { renderMentions } from "./MentionTextarea";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommentAdded: () => void;
}

const CommentsSheet = ({ postId, open, onOpenChange, onCommentAdded }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { comments, loading, refresh } = useComments(open ? postId : null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mention state
  const { suggestions, search: searchMentions, clear: clearMentions } = useMentionSuggestions();
  const [showMentions, setShowMentions] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionQuery, setMentionQuery] = useState("");

  const submit = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: text.trim(),
    });
    setText("");
    setSending(false);
    setShowMentions(false);
    clearMentions();
    refresh();
    onCommentAdded();
  };

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);

    const cursorPos = e.target.selectionStart || 0;
    const textBefore = val.slice(0, cursorPos);
    const atMatch = textBefore.match(/@([a-zA-Z0-9_.]*)$/);

    if (atMatch) {
      setMentionStart(cursorPos - atMatch[0].length);
      setMentionQuery(atMatch[1]);
      setShowMentions(true);
      searchMentions(atMatch[1]);
    } else {
      setShowMentions(false);
      setMentionQuery("");
      clearMentions();
    }
  }, [searchMentions, clearMentions]);

  const selectMention = useCallback((username: string) => {
    const before = text.slice(0, mentionStart);
    const after = text.slice(mentionStart + mentionQuery.length + 1);
    const newValue = `${before}@${username} ${after}`;
    setText(newValue);
    setShowMentions(false);
    clearMentions();

    setTimeout(() => {
      inputRef.current?.focus();
      const pos = before.length + username.length + 2;
      inputRef.current?.setSelectionRange(pos, pos);
    }, 0);
  }, [text, mentionStart, mentionQuery, clearMentions]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Comentários</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-3">
          {loading && <p className="text-sm text-muted-foreground text-center">Carregando...</p>}
          {!loading && comments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum comentário ainda.</p>
          )}
          {comments.map(c => {
            const initials = (c.profiles?.full_name || "U").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
            return (
              <div key={c.id} className="flex gap-3">
                <button onClick={() => { if (c.profiles?.username) { onOpenChange(false); navigate(`/u/${c.profiles.username}`); } }} className="flex-shrink-0">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={c.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-primary/20 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                </button>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <button onClick={() => { if (c.profiles?.username) { onOpenChange(false); navigate(`/u/${c.profiles.username}`); } }} className="text-sm font-semibold hover:underline">
                      {c.profiles?.full_name || "Usuário"}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm">{renderMentions(c.content)}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="relative pt-2 border-t border-border">
          {/* Mention suggestions */}
          {showMentions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 bottom-full mb-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.user_id}
                  type="button"
                  onClick={() => selectMention(s.username)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 flex items-center gap-2 transition-colors"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={s.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-primary/20 text-primary">
                      {(s.full_name || "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm">{s.full_name}</span>
                    <span className="text-xs text-muted-foreground">@{s.username}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              placeholder="Escreva um comentário..."
              value={text}
              onChange={handleInputChange}
              onKeyDown={e => {
                if (e.key === "Enter" && !showMentions) submit();
              }}
            />
            <Button size="sm" onClick={submit} disabled={sending || !text.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CommentsSheet;
