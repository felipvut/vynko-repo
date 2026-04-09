import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Search, Send, Loader2 } from "lucide-react";

interface SharePlanSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planType: "workout" | "diet";
  programId?: string;
  dietId?: string;
  planName: string;
}

const SharePlanSheet = ({ open, onOpenChange, planType, programId, dietId, planName }: SharePlanSheetProps) => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ user_id: string; username: string; full_name: string | null; avatar_url: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (search.length >= 2) {
      searchUsers();
    } else {
      setResults([]);
    }
  }, [search]);

  const searchUsers = async () => {
    if (!user) return;
    setLoading(true);

    // Get friend user IDs
    const { data: friendships } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const friendIds = (friendships || []).map((f) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    );

    if (friendIds.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, full_name, avatar_url")
      .in("user_id", friendIds)
      .or(`username.ilike.%${search}%,full_name.ilike.%${search}%`)
      .limit(10);
    setResults(data || []);
    setLoading(false);
  };

  const sharePlan = async (receiverId: string) => {
    if (!user) return;
    setSending(receiverId);
    const { error } = await supabase.from("shared_plans").insert({
      sender_id: user.id,
      receiver_id: receiverId,
      plan_type: planType,
      program_id: programId || null,
      diet_id: dietId || null,
    });
    if (error) {
      toast.error("Erro ao compartilhar");
    } else {
      // Create notification
      await supabase.from("notifications").insert({
        user_id: receiverId,
        type: "shared_plan",
        title: `compartilhou ${planType === "workout" ? "um treino" : "uma dieta"} com você`,
        body: planName,
        actor_id: user.id,
      } as any);
      toast.success(`${planType === "workout" ? "Treino" : "Dieta"} compartilhado(a)!`);
    }
    setSending(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
        <SheetHeader>
          <SheetTitle className="text-left">
            Compartilhar {planType === "workout" ? "Treino" : "Dieta"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          <p className="text-xs text-muted-foreground">
            Busque entre seus amigos para enviar "{planName}". Ele poderá aceitar e aplicar ao seu perfil.
          </p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou @username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {loading && (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            )}
            {!loading && results.length === 0 && search.length >= 2 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum usuário encontrado</p>
            )}
            {results.map((r) => (
              <div key={r.user_id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={r.avatar_url || ""} />
                  <AvatarFallback className="text-xs">{(r.full_name || r.username || "?")[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{r.full_name || r.username}</p>
                  <p className="text-xs text-muted-foreground">@{r.username}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => sharePlan(r.user_id)}
                  disabled={sending === r.user_id}
                  className="gradient-primary text-primary-foreground"
                >
                  {sending === r.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SharePlanSheet;
