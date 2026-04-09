import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Users, Search, Shield, Ban, KeyRound, Loader2, MapPin, Calendar, Clock, Mail, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const AVAILABLE_ROLES = ["admin", "moderator", "user", "gym_manager"] as const;

const AdminUsers = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [addingRole, setAddingRole] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("user_id, username, full_name, avatar_url, city, state, gym_name, created_at, bio")
        .order("created_at", { ascending: false })
        .limit(100);

      if (search.trim()) {
        query = query.or(`username.ilike.%${search}%,full_name.ilike.%${search}%`);
      }

      const { data } = await query;
      return data ?? [];
    },
    staleTime: 10_000,
  });

  const { data: roles } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      const map: Record<string, string[]> = {};
      data?.forEach((r) => {
        if (!map[r.user_id]) map[r.user_id] = [];
        map[r.user_id].push(r.role);
      });
      return map;
    },
  });

  const { data: riskScores } = useQuery({
    queryKey: ["admin-risk-scores"],
    queryFn: async () => {
      const { data } = await supabase.from("user_risk_scores").select("user_id, risk_score, total_reports_received");
      const map: Record<string, { risk: number; reports: number }> = {};
      data?.forEach((r) => {
        map[r.user_id] = { risk: r.risk_score, reports: r.total_reports_received };
      });
      return map;
    },
  });

  const userIds = users?.map((u) => u.user_id) ?? [];
  const { data: lastLogins } = useQuery({
    queryKey: ["admin-last-logins", userIds],
    queryFn: async () => {
      if (!userIds.length) return {};
      const { data } = await supabase.rpc("get_users_last_login", { user_ids: userIds });
      const map: Record<string, string | null> = {};
      (data as any[])?.forEach((r: any) => {
        map[r.user_id] = r.last_sign_in_at;
      });
      return map;
    },
    enabled: userIds.length > 0,
  });

  const { data: emails } = useQuery({
    queryKey: ["admin-user-emails", userIds],
    queryFn: async () => {
      if (!userIds.length) return {};
      const { data } = await supabase.rpc("get_user_emails", { user_ids: userIds });
      const map: Record<string, string> = {};
      (data as any[])?.forEach((r: any) => { map[r.user_id] = r.email; });
      return map;
    },
    enabled: userIds.length > 0,
  });

  const { data: suspensions } = useQuery({
    queryKey: ["admin-suspensions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_suspensions")
        .select("user_id, expires_at, reason, lifted_at")
        .is("lifted_at", null)
        .gt("expires_at", new Date().toISOString());
      const map: Record<string, any> = {};
      data?.forEach((s) => { map[s.user_id] = s; });
      return map;
    },
  });

  const handleAddRole = async (userId: string, role: string) => {
    setAddingRole(true);
    try {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role } as any);
      if (error) {
        if (error.code === "23505") toast.info("Usuário já possui essa role");
        else throw error;
      } else {
        toast.success(`Role "${role}" adicionada`);
        queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao adicionar role");
    }
    setAddingRole(false);
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
      if (error) throw error;
      toast.success(`Role "${role}" removida`);
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover role");
    }
  };

  const handleBlock = async (userId: string, days: number) => {
    setBlocking(true);
    try {
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("user_suspensions").insert({
        user_id: userId,
        suspended_by: (await supabase.auth.getUser()).data.user?.id,
        expires_at: expiresAt,
        reason: `Bloqueio administrativo por ${days} dias`,
      } as any);
      if (error) throw error;
      toast.success(`Usuário bloqueado por ${days} dias`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao bloquear");
    }
    setBlocking(false);
  };

  const handleResetPassword = async (userId: string) => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Senha deve ter ao menos 6 caracteres");
      return;
    }
    setResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: { user_id: userId, new_password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Senha redefinida com sucesso!");
      setNewPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao redefinir senha");
    }
    setResettingPassword(false);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Usuários</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou @..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Academia</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead>Último login</TableHead>
                <TableHead>Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : !users?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const userRoles = roles?.[u.user_id] ?? [];
                  const risk = riskScores?.[u.user_id];
                  const lastLogin = lastLogins?.[u.user_id];
                  const isSuspended = !!suspensions?.[u.user_id];
                  return (
                    <TableRow
                      key={u.user_id}
                      className="cursor-pointer hover:bg-secondary/50 transition-colors"
                      onClick={() => setSelectedUser(u)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {u.full_name || u.username}
                              {isSuspended && <Badge variant="destructive" className="ml-2 text-[10px]">Bloqueado</Badge>}
                            </p>
                            <p className="text-xs text-muted-foreground">@{u.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.city && u.state ? `${u.city}, ${u.state}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.gym_name || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {userRoles.length ? (
                            userRoles.map((r) => (
                              <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="text-xs">
                                {r}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">user</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {risk && risk.risk > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            {risk.risk} ({risk.reports} denúncias)
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lastLogin
                          ? new Date(lastLogin).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              {/* Profile Info */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-lg font-bold">{selectedUser.full_name || "—"}</p>
                  <p className="text-sm text-muted-foreground">@{selectedUser.username}</p>
                </div>
              </div>

              {/* Email */}
              {emails?.[selectedUser.user_id] && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{emails[selectedUser.user_id]}</span>
                </div>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Local</p>
                    <p className="font-medium">{selectedUser.city && selectedUser.state ? `${selectedUser.city}, ${selectedUser.state}` : "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Academia</p>
                    <p className="font-medium">{selectedUser.gym_name || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Cadastro</p>
                    <p className="font-medium">{new Date(selectedUser.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Último login</p>
                    <p className="font-medium">
                      {lastLogins?.[selectedUser.user_id]
                        ? new Date(lastLogins[selectedUser.user_id]!).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bio */}
              {selectedUser.bio && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Bio</p>
                  <p className="text-sm">{selectedUser.bio}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-2">Roles</p>
                <div className="flex gap-1 flex-wrap mb-2">
                  {(roles?.[selectedUser.user_id] ?? []).length > 0 ? (
                    roles![selectedUser.user_id].map((r) => (
                      <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="gap-1">
                        {r}
                        <button onClick={() => handleRemoveRole(selectedUser.user_id, r)} className="ml-0.5 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">user</Badge>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <Select onValueChange={(val) => handleAddRole(selectedUser.user_id, val)} disabled={addingRole}>
                    <SelectTrigger className="w-48 h-8 text-xs">
                      <SelectValue placeholder="Adicionar role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_ROLES.filter(r => !(roles?.[selectedUser.user_id] ?? []).includes(r)).map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Risk */}
              {riskScores?.[selectedUser.user_id] && riskScores[selectedUser.user_id].risk > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Risco</p>
                  <Badge variant="destructive">
                    Score: {riskScores[selectedUser.user_id].risk} · {riskScores[selectedUser.user_id].reports} denúncias
                  </Badge>
                </div>
              )}

              {/* Suspension status */}
              {suspensions?.[selectedUser.user_id] && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  <p className="text-sm font-medium text-destructive">⚠️ Usuário bloqueado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Até: {new Date(suspensions[selectedUser.user_id].expires_at).toLocaleDateString("pt-BR")}
                    {suspensions[selectedUser.user_id].reason && ` · ${suspensions[selectedUser.user_id].reason}`}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3 pt-2 border-t border-border">
                {/* Block */}
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2"><Ban className="h-4 w-4" /> Bloquear usuário</p>
                  <div className="flex gap-2">
                    {[3, 7, 15, 30].map((days) => (
                      <Button
                        key={days}
                        size="sm"
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive/10"
                        disabled={blocking}
                        onClick={() => handleBlock(selectedUser.user_id, days)}
                      >
                        {days}d
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Reset Password */}
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2"><KeyRound className="h-4 w-4" /> Redefinir senha</p>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Nova senha (mín. 6 caracteres)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      disabled={resettingPassword || !newPassword}
                      onClick={() => handleResetPassword(selectedUser.user_id)}
                    >
                      {resettingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUsers;
