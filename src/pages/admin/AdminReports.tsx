import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  CheckCircle, XCircle, Eye, Shield, Trash2, Ban, AlertTriangle,
  User, Calendar, MessageSquare, Image as ImageIcon, Loader2,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  hate_speech: "Discurso de ódio",
  harassment: "Assédio",
  nudity: "Nudez",
  violence: "Violência",
  misinformation: "Desinformação",
  illegal: "Conteúdo ilegal",
  impersonation: "Falsidade ideológica",
  self_harm: "Autolesão",
  copyright: "Direitos autorais",
  other: "Outro",
};

type ReportDetail = {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_post_id: string | null;
  reported_comment_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  actions_taken: string[] | null;
};

const AdminReports = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "resolved" | "dismissed">("pending");
  const [selectedReport, setSelectedReport] = useState<ReportDetail | null>(null);

  const { data: reports, isLoading } = useQuery({
    queryKey: ["admin-reports", filter],
    queryFn: async () => {
      const { data } = await supabase
        .from("reports")
        .select("*")
        .eq("status", filter)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as ReportDetail[];
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Denúncias</h2>
          <div className="flex gap-2">
            {(["pending", "resolved", "dismissed"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={filter === s ? "default" : "outline"}
                onClick={() => setFilter(s)}
              >
                {s === "pending" ? "Pendentes" : s === "resolved" ? "Resolvidas" : "Descartadas"}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Detalhes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : !reports?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma denúncia encontrada
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedReport(r)}>
                    <TableCell className="text-sm">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{REASON_LABELS[r.reason] || r.reason}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.reported_post_id ? "Post" : r.reported_comment_id ? "Comentário" : "Usuário"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {r.details || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "pending" ? "destructive" : "secondary"}>
                        {r.status === "pending" ? "Pendente" : r.status === "resolved" ? "Resolvida" : "Descartada"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setSelectedReport(r); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedReport && (
        <ReportDetailDialog
          report={selectedReport}
          adminId={user?.id || ""}
          onClose={() => setSelectedReport(null)}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
            setSelectedReport(null);
          }}
        />
      )}
    </AdminLayout>
  );
};

// ─── Report Detail Dialog ───

function ReportDetailDialog({
  report,
  adminId,
  onClose,
  onUpdated,
}: {
  report: ReportDetail;
  adminId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [suspendDays, setSuspendDays] = useState("7");
  const [actions, setActions] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  const toggleAction = (action: string) => {
    setActions((prev) => {
      const next = new Set(prev);
      next.has(action) ? next.delete(action) : next.add(action);
      return next;
    });
  };

  // Fetch reporter profile
  const { data: reporter } = useQuery({
    queryKey: ["profile", report.reporter_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url")
        .eq("user_id", report.reporter_id)
        .maybeSingle();
      return data;
    },
  });

  // Fetch reported user profile
  const { data: reportedUser } = useQuery({
    queryKey: ["profile", report.reported_user_id],
    enabled: !!report.reported_user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url")
        .eq("user_id", report.reported_user_id!)
        .maybeSingle();
      return data;
    },
  });

  // Fetch reported post
  const { data: reportedPost } = useQuery({
    queryKey: ["post-detail", report.reported_post_id],
    enabled: !!report.reported_post_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, content, image_url, video_url, post_type, created_at, user_id")
        .eq("id", report.reported_post_id!)
        .maybeSingle();
      return data;
    },
  });

  // Fetch reported comment
  const { data: reportedComment } = useQuery({
    queryKey: ["comment-detail", report.reported_comment_id],
    enabled: !!report.reported_comment_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("comments")
        .select("id, content, created_at, user_id")
        .eq("id", report.reported_comment_id!)
        .maybeSingle();
      return data;
    },
  });

  // Fetch risk score for reported user
  const { data: riskScore } = useQuery({
    queryKey: ["risk-score", report.reported_user_id],
    enabled: !!report.reported_user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_risk_scores")
        .select("risk_score, total_reports_received")
        .eq("user_id", report.reported_user_id!)
        .maybeSingle();
      return data;
    },
  });

  // Fetch active suspensions for reported user
  const { data: activeSuspension } = useQuery({
    queryKey: ["active-suspension", report.reported_user_id],
    enabled: !!report.reported_user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_suspensions")
        .select("*")
        .eq("user_id", report.reported_user_id!)
        .is("lifted_at", null)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const handleExecuteActions = async () => {
    if (actions.size === 0) {
      toast.error("Selecione pelo menos uma ação");
      return;
    }

    setProcessing(true);
    const actionsArr = Array.from(actions);
    const targetUserId = report.reported_user_id || reportedPost?.user_id || reportedComment?.user_id;

    try {
      // 1. Suspend user temporarily
      if (actions.has("suspend") && targetUserId) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(suspendDays));
        const { error } = await supabase.from("user_suspensions").insert({
          user_id: targetUserId,
          suspended_by: adminId,
          reason: `Denúncia: ${REASON_LABELS[report.reason] || report.reason}. ${report.details || ""}`,
          report_id: report.id,
          expires_at: expiresAt.toISOString(),
        });
        if (error) throw error;
      }

      // 2. Delete post
      if (actions.has("delete_post") && report.reported_post_id) {
        const { error } = await supabase.from("posts").delete().eq("id", report.reported_post_id);
        if (error) throw error;
      }

      // 3. Delete user (via edge function)
      if (actions.has("delete_user") && targetUserId) {
        const { error } = await supabase.functions.invoke("delete-account", {
          body: { target_user_id: targetUserId },
        });
        if (error) throw error;
      }

      // 4. Allow post (dismiss report)
      // Just mark as dismissed, no other action needed

      // Update report status
      const finalStatus = actions.has("allow_post") ? "dismissed" : "resolved";
      const { error: reportErr } = await supabase
        .from("reports")
        .update({
          status: finalStatus,
          resolved_by: adminId,
          resolved_at: new Date().toISOString(),
          actions_taken: actionsArr,
        })
        .eq("id", report.id);
      if (reportErr) throw reportErr;

      toast.success("Ações executadas com sucesso!");
      onUpdated();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao executar ações");
    } finally {
      setProcessing(false);
    }
  };

  const handleDismiss = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("reports")
        .update({
          status: "dismissed",
          resolved_by: adminId,
          resolved_at: new Date().toISOString(),
          actions_taken: ["dismissed"],
        })
        .eq("id", report.id);
      if (error) throw error;
      toast.success("Denúncia descartada");
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Erro ao descartar");
    } finally {
      setProcessing(false);
    }
  };

  const isPending = report.status === "pending";

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Detalhes da Denúncia
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Report info */}
          <div className="rounded-lg border border-border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="destructive" className="text-xs">
                {REASON_LABELS[report.reason] || report.reason}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(report.created_at).toLocaleString("pt-BR")}
              </span>
            </div>
            {report.details && (
              <p className="text-sm text-muted-foreground">{report.details}</p>
            )}
            {report.actions_taken && report.actions_taken.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                <span className="text-xs text-muted-foreground">Ações tomadas:</span>
                {report.actions_taken.map((a) => (
                  <Badge key={a} variant="outline" className="text-xs">
                    {a === "suspend" ? "Suspenso" : a === "delete_post" ? "Post excluído" : a === "delete_user" ? "Usuário excluído" : a === "allow_post" ? "Post permitido" : a}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* People involved */}
          <div className="grid grid-cols-2 gap-4">
            {/* Reporter */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Denunciante</span>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={reporter?.avatar_url || ""} />
                  <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{reporter?.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">@{reporter?.username || "?"}</p>
                </div>
              </div>
            </div>

            {/* Reported user */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Denunciado</span>
              {reportedUser ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={reportedUser?.avatar_url || ""} />
                    <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{reportedUser?.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">@{reportedUser?.username || "?"}</p>
                    {riskScore && (
                      <div className="flex items-center gap-1 mt-1">
                        <Shield className="h-3 w-3 text-destructive" />
                        <span className="text-xs text-destructive">
                          Risco: {riskScore.risk_score} ({riskScore.total_reports_received} denúncias)
                        </span>
                      </div>
                    )}
                    {activeSuspension && (
                      <Badge variant="destructive" className="text-xs mt-1">
                        Suspenso até {new Date(activeSuspension.expires_at).toLocaleDateString("pt-BR")}
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Usuário não identificado</p>
              )}
            </div>
          </div>

          {/* Reported content */}
          {reportedPost && (
            <div className="rounded-lg border border-border p-4 space-y-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Conteúdo denunciado ({reportedPost.post_type === "video" ? "Move" : "Post"})
              </span>
              {reportedPost.content && (
                <p className="text-sm bg-muted/50 rounded-md p-3">{reportedPost.content}</p>
              )}
              {reportedPost.image_url && (
                <div className="relative">
                  <img
                    src={reportedPost.image_url}
                    alt="Post denunciado"
                    className="rounded-md max-h-60 object-cover w-full"
                  />
                </div>
              )}
              {reportedPost.video_url && (
                <video
                  src={reportedPost.video_url}
                  controls
                  className="rounded-md max-h-60 w-full"
                />
              )}
              <p className="text-xs text-muted-foreground">
                Publicado em {new Date(reportedPost.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
          )}

          {reportedComment && (
            <div className="rounded-lg border border-border p-4 space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Comentário denunciado</span>
              <p className="text-sm bg-muted/50 rounded-md p-3">{reportedComment.content}</p>
              <p className="text-xs text-muted-foreground">
                Publicado em {new Date(reportedComment.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
          )}

          {/* Actions */}
          {isPending && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Ações de moderação
                </h4>
                <p className="text-xs text-muted-foreground">
                  Selecione uma ou mais ações. Elas serão executadas simultaneamente.
                </p>

                <div className="space-y-3">
                  {/* Suspend */}
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <Checkbox
                      id="suspend"
                      checked={actions.has("suspend")}
                      onCheckedChange={() => toggleAction("suspend")}
                    />
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="suspend" className="flex items-center gap-2 cursor-pointer">
                        <Ban className="h-4 w-4 text-orange-400" />
                        Bloquear temporariamente o usuário
                      </Label>
                      {actions.has("suspend") && (
                        <Select value={suspendDays} onValueChange={setSuspendDays}>
                          <SelectTrigger className="w-40 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 dia</SelectItem>
                            <SelectItem value="3">3 dias</SelectItem>
                            <SelectItem value="7">7 dias</SelectItem>
                            <SelectItem value="14">14 dias</SelectItem>
                            <SelectItem value="30">30 dias</SelectItem>
                            <SelectItem value="90">90 dias</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  {/* Delete user */}
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 hover:bg-destructive/5 transition-colors">
                    <Checkbox
                      id="delete_user"
                      checked={actions.has("delete_user")}
                      onCheckedChange={() => toggleAction("delete_user")}
                    />
                    <Label htmlFor="delete_user" className="flex items-center gap-2 cursor-pointer">
                      <Trash2 className="h-4 w-4 text-destructive" />
                      Excluir usuário permanentemente
                    </Label>
                  </div>

                  {/* Delete post */}
                  {report.reported_post_id && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <Checkbox
                        id="delete_post"
                        checked={actions.has("delete_post")}
                        onCheckedChange={() => toggleAction("delete_post")}
                      />
                      <Label htmlFor="delete_post" className="flex items-center gap-2 cursor-pointer">
                        <Trash2 className="h-4 w-4 text-orange-400" />
                        Excluir post
                      </Label>
                    </div>
                  )}

                  {/* Allow post */}
                  {report.reported_post_id && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <Checkbox
                        id="allow_post"
                        checked={actions.has("allow_post")}
                        onCheckedChange={() => toggleAction("allow_post")}
                      />
                      <Label htmlFor="allow_post" className="flex items-center gap-2 cursor-pointer">
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        Permitir post (não viola regras)
                      </Label>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleExecuteActions}
                    disabled={processing || actions.size === 0}
                    className="flex-1"
                  >
                    {processing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</>
                    ) : (
                      <><Shield className="h-4 w-4 mr-2" /> Executar ações ({actions.size})</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDismiss}
                    disabled={processing}
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Descartar
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AdminReports;
