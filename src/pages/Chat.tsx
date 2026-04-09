import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Send, Bot, User, Loader2, Dumbbell, CheckCircle, RefreshCw } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

// Detect workout proposals by looking for patterns like "Treino A", "Treino B", exercise lists, etc.
const hasWorkoutProposal = (text: string): boolean => {
  const patterns = [
    /treino\s+[a-d]/i,
    /\d+x\d+/,
    /séries/i,
    /repetições/i,
  ];
  const matches = patterns.filter(p => p.test(text)).length;
  // Need at least 2 patterns matched AND message must be long enough
  return matches >= 2 && text.length > 400;
};

// Clean display text by removing any hidden markers
const cleanMessageText = (text: string) => {
  return text
    .replace(/<<<WORKOUT_JSON>>>[\s\S]*?<<<END_WORKOUT_JSON>>>/g, "")
    .replace(/<<APPLY_WORKOUT>>/g, "")
    .trim();
};

const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [applyingWorkout, setApplyingWorkout] = useState(false);
  const [appliedIndexes, setAppliedIndexes] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
  const autoGenerateTriggered = useRef(false);

  useEffect(() => {
    if (user) loadHistory();
  }, [user]);

  // Auto-generate workout on first onboarding completion
  useEffect(() => {
    if (!loadingHistory && location.state?.autoGenerate && !autoGenerateTriggered.current && !isLoading && messages.length === 0) {
      autoGenerateTriggered.current = true;
      const autoMsg = "Olá! Acabei de preencher minha anamnese. Por favor, gere um treino personalizado completo para mim com base no meu perfil.";
      const userMsg: Msg = { role: "user", content: autoMsg };
      setMessages([userMsg]);
      setIsLoading(true);
      saveMessage("user", autoMsg).then(() => streamResponse([userMsg]));
    }
  }, [loadingHistory, location.state]);

  // Scroll to bottom on messages change
  useEffect(() => {
    if (!loadingHistory) {
      const useSmooth = initialScrollDone.current;
      if (!initialScrollDone.current) initialScrollDone.current = true;
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: useSmooth ? "smooth" : "auto" });
      });
    }
  }, [messages, loadingHistory]);

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(100);
    if (data) setMessages(data as Msg[]);
    setLoadingHistory(false);
    // initialScrollDone handled by ref
  };

  const saveMessage = async (role: string, content: string) => {
    if (!user) return;
    await supabase.from("chat_messages").insert({ user_id: user.id, role, content });
  };

  const applyWorkout = async (msgIndex: number) => {
    setApplyingWorkout(true);
    try {
      // Use the EXACT message the user clicked on - never search for a different one
      const msg = messages[msgIndex];
      const bestText = cleanMessageText(msg.content);
      
      if (!bestText || bestText.length < 200) {
        toast.error("Não encontrei uma proposta de treino. Peça um novo treino à IA.");
        setApplyingWorkout(false);
        return;
      }
      
      // Send the proposal TEXT to apply-workout which will parse it with AI (temperature=0) and save
      const { data, error } = await supabase.functions.invoke("apply-workout", {
        body: { proposal_text: bestText }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAppliedIndexes(prev => new Set(prev).add(msgIndex));
      toast.success("Treino aplicado com sucesso! 🎉");
      navigate("/training");
    } catch (err: any) {
      toast.error(err.message || "Erro ao aplicar treino");
    }
    setApplyingWorkout(false);
  };

  const regenerateFromChat = async (msgIndex: number) => {
    // Send a follow-up message asking for a different workout
    const text = "Não gostei dessa sugestão. Por favor, sugira um treino diferente.";
    const userMsg: Msg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    await saveMessage("user", text);
    await streamResponse([...messages, userMsg]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    await saveMessage("user", text);
    await streamResponse([...messages, userMsg]);
  };

  const streamResponse = async (allMessages: Msg[]) => {
    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Você precisa estar logado para usar o chat.");
        setIsLoading(false);
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao conectar com o assistente");
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (assistantSoFar) await saveMessage("assistant", assistantSoFar);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao enviar mensagem");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Shift+Enter sends, Enter adds newline (more natural for long texts)
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const renderMessageContent = (msg: Msg, index: number) => {
    const showApply = msg.role === "assistant" && hasWorkoutProposal(msg.content);
    const displayText = cleanMessageText(msg.content);
    const alreadyApplied = appliedIndexes.has(index);

    return (
      <>
        <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
          msg.role === "user"
            ? "gradient-primary text-primary-foreground rounded-br-md"
            : "bg-secondary text-secondary-foreground rounded-bl-md"
        }`}>
          {displayText}
        </div>
        {showApply && !alreadyApplied && (
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              onClick={() => applyWorkout(index)}
              disabled={applyingWorkout || isLoading}
              className="gradient-primary text-primary-foreground"
            >
              {applyingWorkout ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Gerando...</>
              ) : (
                <><Dumbbell className="h-3 w-3 mr-1" /> Aplicar novo treino</>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => regenerateFromChat(index)}
              disabled={applyingWorkout || isLoading}
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Não gostei
            </Button>
          </div>
        )}
        {showApply && alreadyApplied && (
          <div className="flex items-center gap-2 text-xs text-primary mt-2">
            <CheckCircle className="h-4 w-4" />
            Treino aplicado com sucesso!
          </div>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <Button variant="ghost" size="sm" onClick={() => navigate("/training")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-display font-bold">Personal IA</span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {loadingHistory ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Bot className="h-12 w-12 text-primary mx-auto" />
            <h3 className="font-display font-bold text-lg">Fale com seu Personal IA</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Peça ajustes no treino, relate dores, peça exercícios conjugados, drop sets, treino funcional...
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={initialScrollDone.current && i >= messages.length - 2 ? { opacity: 0, y: 5 } : false}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className="flex flex-col">
                {renderMessageContent(msg, i)}
              </div>
              {msg.role === "user" && (
                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </motion.div>
          ))
        )}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border/50 bg-card/50 backdrop-blur-xl p-4">
        <div className="container flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Estou com dor no ombro, adapte meu treino... (Shift+Enter para enviar)"
            className="bg-secondary resize-none min-h-[44px] max-h-[120px]"
            rows={1}
          />
          <Button onClick={send} disabled={isLoading || !input.trim()} className="gradient-primary text-primary-foreground h-[44px] w-[44px] p-0 flex-shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;