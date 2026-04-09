import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Check, X, Dumbbell, UtensilsCrossed, Loader2 } from "lucide-react";
import { respondToSharedPlan } from "@/lib/sharedPlans";

interface SharedPlan {
  id: string;
  sender_id: string;
  plan_type: string;
  program_id: string | null;
  diet_id: string | null;
  created_at: string;
  status?: string;
  applied_at?: string | null;
  sender_name?: string;
  sender_avatar?: string;
  plan_name?: string;
}

interface PendingSharesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccepted?: () => void;
}

const PendingSharesSheet = ({ open, onOpenChange, onAccepted }: PendingSharesSheetProps) => {
  const { user } = useAuth();
  const [shares, setShares] = useState<SharedPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) loadShares();
  }, [open, user]);

  const loadShares = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("shared_plans")
      .select("*")
      .eq("receiver_id", user.id)
      .or("status.eq.pending,and(status.eq.accepted,applied_at.is.null)")
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const enriched = await Promise.all(
        data.map(async (s: any) => {
          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("user_id", s.sender_id)
            .maybeSingle();

          let planName = "";
          if (s.plan_type === "workout" && s.program_id) {
            const { data: prog } = await supabase
              .from("training_programs")
              .select("name")
              .eq("id", s.program_id)
              .maybeSingle();
            planName = prog?.name || "Treino";
          } else if (s.plan_type === "diet" && s.diet_id) {
            const { data: diet } = await supabase
              .from("diet_plans")
              .select("name")
              .eq("id", s.diet_id)
              .maybeSingle();
            planName = diet?.name || "Dieta";
          }

          return {
            ...s,
            sender_name: prof?.full_name || "Usuário",
            sender_avatar: prof?.avatar_url,
            plan_name: planName,
          };
        })
      );
      setShares(enriched);
    } else {
      setShares([]);
    }
    setLoading(false);
  };

  const respond = async (shareId: string, accept: boolean) => {
    if (!user) return;
    setProcessing(shareId);
    const share = shares.find(s => s.id === shareId);
    try {
      await respondToSharedPlan(shareId, accept);

      if (accept && share) {
        toast.success(`${share.plan_type === "workout" ? "Treino" : "Dieta"} aplicado(a) com sucesso! 🎉`);
        onAccepted?.();
      } else {
        toast.success("Compartilhamento rejeitado.");
      }

      setShares(prev => prev.filter(s => s.id !== shareId));
    } catch (error) {
      toast.error(accept ? "Erro ao aplicar compartilhamento" : "Erro ao processar");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
        <SheetHeader>
          <SheetTitle className="text-left">Planos compartilhados com você</SheetTitle>
        </SheetHeader>

        <div className="space-y-3 mt-4 max-h-60 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : shares.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum plano pendente</p>
          ) : (
            shares.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={s.sender_avatar || ""} />
                  <AvatarFallback className="text-xs">{(s.sender_name || "?")[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.sender_name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {s.plan_type === "workout" ? <Dumbbell className="h-3 w-3" /> : <UtensilsCrossed className="h-3 w-3" />}
                    {s.plan_name}
                  </p>
                  {s.status === "accepted" && !s.applied_at && (
                    <p className="text-[11px] text-muted-foreground">Aceito, mas ainda não aplicado</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" className="h-8 px-3 gradient-primary text-primary-foreground" onClick={() => respond(s.id, true)} disabled={processing === s.id}>
                    {processing === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => respond(s.id, false)} disabled={processing === s.id || s.status === "accepted"}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PendingSharesSheet;
