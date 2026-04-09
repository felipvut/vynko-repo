import { useState } from "react";
import { Flag, AlertTriangle, Ban, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const REPORT_REASONS = [
  "Venda/Oferta de substâncias ilegais",
  "Incentivo a atividades ilegais",
  "Violação de direitos autorais",
  "Golpes/fraudes",
  "Discurso de Ódio/Discriminação",
  "Conteúdo Sexual/Inadequado",
  "Pedofilia",
  "Informações Falsas/Perigosas",
  "Spam/Publicidade Indevida",
  "Conteúdo Sensível/Violento",
  "Violação das Regras da Comunidade",
] as const;

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postUserId: string;
  commentId?: string;
  onActionTaken?: () => void;
}

const ReportDialog = ({ open, onOpenChange, postId, postUserId, commentId, onActionTaken }: ReportDialogProps) => {
  const { user } = useAuth();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [blockUser, setBlockUser] = useState(false);
  const [hidePost, setHidePost] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isOwnPost = user?.id === postUserId;

  const handleSubmit = async () => {
    if (!user || !selectedReason) return;
    setSubmitting(true);

    // 1. Submit report
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_post_id: postId,
      reported_user_id: postUserId,
      reported_comment_id: commentId || null,
      reason: selectedReason,
      details: details.trim() || null,
    });

    if (error) {
      setSubmitting(false);
      toast.error("Erro ao enviar denúncia");
      return;
    }

    // 2. Block user if selected
    if (blockUser && !isOwnPost) {
      await supabase.from("blocks").insert({
        blocker_id: user.id,
        blocked_id: postUserId,
      });
    }

    // 3. Hide post if selected (and not blocking, since block already hides everything)
    if (hidePost && !blockUser) {
      await supabase.from("hidden_posts").insert({
        user_id: user.id,
        post_id: postId,
      });
    }

    setSubmitting(false);

    const messages: string[] = ["Denúncia enviada com sucesso."];
    if (blockUser) messages.push("Usuário bloqueado.");
    if (hidePost && !blockUser) messages.push("Postagem ocultada.");

    toast.success(messages.join(" "));
    resetAndClose();
    onActionTaken?.();
  };

  const resetAndClose = () => {
    setSelectedReason(null);
    setDetails("");
    setBlockUser(false);
    setHidePost(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Denunciar conteúdo
          </DialogTitle>
          <DialogDescription>
            Selecione o motivo da denúncia. Sua identidade será mantida em sigilo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {REPORT_REASONS.map((reason) => (
            <button
              key={reason}
              onClick={() => setSelectedReason(reason)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                selectedReason === reason
                  ? "border-destructive bg-destructive/10 text-destructive font-medium"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
              }`}
            >
              {reason}
            </button>
          ))}
        </div>

        {selectedReason && (
          <>
            <div className="space-y-2 mt-2">
              <label className="text-sm text-muted-foreground">
                Detalhes adicionais (opcional)
              </label>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Descreva mais detalhes sobre o problema..."
                maxLength={500}
                rows={3}
              />
            </div>

            {/* Optional actions */}
            {!isOwnPost && (
              <div className="space-y-3 mt-3 p-3 rounded-lg border border-border">
                <p className="text-sm font-medium">Ações adicionais (opcional)</p>

                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={blockUser}
                    onCheckedChange={(v) => {
                      setBlockUser(!!v);
                      if (v) setHidePost(false);
                    }}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <Ban className="h-3.5 w-3.5" />
                      Bloquear usuário
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Você não verá mais nenhum conteúdo deste usuário
                    </p>
                  </div>
                </label>

                {!blockUser && (
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={hidePost}
                      onCheckedChange={(v) => setHidePost(!!v)}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <EyeOff className="h-3.5 w-3.5" />
                        Ocultar esta postagem
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Apenas esta postagem será ocultada, você continuará vendo as demais do usuário
                      </p>
                    </div>
                  </label>
                )}
              </div>
            )}
          </>
        )}

        <div className="flex items-center gap-2 mt-2 p-3 rounded-lg bg-muted/50">
          <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Denúncias falsas ou abusivas podem resultar em penalidades à sua conta.
          </p>
        </div>

        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={!selectedReason || submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Enviando..." : "Enviar denúncia"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;
