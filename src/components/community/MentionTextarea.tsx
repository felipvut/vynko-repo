import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMentionSuggestions, type MentionSuggestion } from "@/hooks/useMentionSuggestions";

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
}

type Suggestion = MentionSuggestion;

const MentionTextarea = ({ value, onChange, placeholder, rows = 4 }: Props) => {
  const { suggestions, search: searchMentions, clear: clearMentions } = useMentionSuggestions();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);

    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const atMatch = textBefore.match(/@([a-zA-Z0-9_.]*)$/);

    if (atMatch) {
      setMentionStart(cursorPos - atMatch[0].length);
      setMentionQuery(atMatch[1]);
      setShowSuggestions(true);
      searchMentions(atMatch[1]);
    } else {
      setShowSuggestions(false);
      setMentionQuery("");
    }
  };

  const selectSuggestion = (s: Suggestion) => {
    const username = s.username || s.full_name || "user";
    const before = value.slice(0, mentionStart);
    const after = value.slice(mentionStart + mentionQuery.length + 1);
    const newValue = `${before}@${username} ${after}`;
    onChange(newValue);
    setShowSuggestions(false);
    clearMentions();

    setTimeout(() => {
      textareaRef.current?.focus();
      const pos = before.length + username.length + 2;
      textareaRef.current?.setSelectionRange(pos, pos);
    }, 0);
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        rows={rows}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 bottom-full mb-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.user_id}
              type="button"
              onClick={() => selectSuggestion(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 flex items-center gap-2 transition-colors"
            >
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {(s.full_name || "?")[0]}
              </div>
              <div className="flex flex-col">
                <span className="text-sm">{s.full_name}</span>
                <span className="text-xs text-muted-foreground">@{s.username}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionTextarea;

// Utility to render content with highlighted @mentions as links
// Now uses a component that resolves usernames to display names
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const mentionCache = new Map<string, string>();

const MentionLink = ({ username }: { username: string }) => {
  const [displayName, setDisplayName] = useState(username);

  useEffect(() => {
    if (mentionCache.has(username)) {
      setDisplayName(mentionCache.get(username)!);
      return;
    }
    supabase
      .from("profiles")
      .select("full_name")
      .ilike("username", username)
      .maybeSingle()
      .then(({ data }) => {
        const name = data?.full_name || username;
        mentionCache.set(username, name);
        setDisplayName(name);
      });
  }, [username]);

  return (
    <a href={`/u/${username}`} className="text-primary font-semibold hover:underline" onClick={e => e.stopPropagation()}>
      @{displayName}
    </a>
  );
};

export const renderMentions = (text: string) => {
  const parts = text.split(/(@[a-zA-Z0-9_.]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const username = part.slice(1);
      return <MentionLink key={i} username={username} />;
    }
    return part;
  });
};
