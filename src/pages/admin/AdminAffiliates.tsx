import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users2, Check, X, Eye, Search } from "lucide-react";

const CATEGORIES = [
  "Influenciador Fitness",
  "Personal Trainer",
  "Nutricionista",
  "Atleta",
  "Criador de Conteúdo",
  "Parceiro Comercial",
  "Outro",
];

const TIERS = [
  { value: "bronze", label: "Bronze" },
  { value: "prata", label: "Prata" },
  { value: "ouro", label: "Ouro" },
  { value: "elite", label: "Elite" },
  { value: "legend", label: "Legend" },
];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Recusado", variant: "destructive" },
};

const AdminAffiliates = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [selectedAffiliate, setSelectedAffiliate] = useState<any>(null);
  const [category, setCategory] = useState("");
  const [tier, setTier] = useState("");

  const { data: affiliates, isLoading } = useQuery({
    queryKey: ["admin-affiliates", statusFilter, search],
    queryFn: async () => {
      let query = supabase
        .from("affiliates")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (search.trim()) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,cpf.ilike.%${search}%`);
      }

      const { data } = await query.limit(50);
      return data ?? [];
    },
  });

  const { data: socialLinks } = useQuery({
    queryKey: ["affiliate-social-links", selectedAffiliate?.id],
    queryFn: async () => {
      if (!selectedAffiliate) return [];
      const { data } = await supabase
        .from("affiliate_social_links")
        .select("*")
        .eq("affiliate_id", selectedAffiliate.id);
      return data ?? [];
    },
    enabled: !!selectedAffiliate,
  });

  const { data: referralCount } = useQuery({
    queryKey: ["affiliate-referral-count", selectedAffiliate?.id],
    queryFn: async () => {
      if (!selectedAffiliate) return 0;
      const { count } = await supabase
        .from("affiliate_referrals")
        .select("id", { count: "exact", head: true })
        .eq("affiliate_id", selectedAffiliate.id);
      return count ?? 0;
    },
    enabled: !!selectedAffiliate,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, cat, tierVal }: { id: string; status: string; cat?: string; tierVal?: string }) => {
      const update: any = { status };
      if (status === "approved") {
        update.approved_at = new Date().toISOString();
        update.approved_by = user?.id;
        if (cat) update.category = cat;
        if (tierVal) update.tier = tierVal;
      }
      if (cat) update.category = cat;
      if (tierVal) update.tier = tierVal;
      const { error } = await supabase.from("affiliates").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-affiliates"] });
      setSelectedAffiliate(null);
      toast.success("Status atualizado");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const formatCPF = (cpf: string) => {
    if (!cpf) return "";
    const d = cpf.replace(/\D/g, "");
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Afiliados</h2>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex gap-1">
            {[
              { value: "pending", label: "Pendentes" },
              { value: "approved", label: "Aprovados" },
              { value: "rejected", label: "Recusados" },
              { value: "all", label: "Todos" },
            ].map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={statusFilter === f.value ? "default" : "outline"}
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !affiliates?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum afiliado encontrado</p>
        ) : (
          <div className="space-y-2">
            {affiliates.map((a: any) => {
              const s = STATUS_MAP[a.status] || STATUS_MAP.pending;
              return (
                <Card key={a.id} className="border-border cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => { setSelectedAffiliate(a); setCategory(a.category || ""); setTier((a as any).tier || ""); }}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-foreground">{a.full_name}</p>
                      <p className="text-xs text-muted-foreground">{a.email} · CPF: {formatCPF(a.cpf)}</p>
                      {a.category && <p className="text-xs text-muted-foreground mt-0.5">Categoria: {a.category}</p>}
                      {(a as any).tier && <p className="text-xs text-muted-foreground">Nível: <span className="font-semibold capitalize">{(a as any).tier}</span></p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={s.variant}>{s.label}</Badge>
                      <p className="text-xs text-muted-foreground font-mono">{a.referral_code}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedAffiliate} onOpenChange={(o) => { if (!o) setSelectedAffiliate(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes do Afiliado</DialogTitle></DialogHeader>
          {selectedAffiliate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Nome:</span> <span className="text-foreground font-medium">{selectedAffiliate.full_name}</span></div>
                <div><span className="text-muted-foreground">CPF:</span> <span className="text-foreground font-medium">{formatCPF(selectedAffiliate.cpf)}</span></div>
                <div><span className="text-muted-foreground">Email:</span> <span className="text-foreground font-medium">{selectedAffiliate.email}</span></div>
                <div><span className="text-muted-foreground">Telefone:</span> <span className="text-foreground font-medium">{selectedAffiliate.phone || "—"}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Endereço:</span> <span className="text-foreground font-medium">{[selectedAffiliate.address, selectedAffiliate.city, selectedAffiliate.state].filter(Boolean).join(", ") || "—"}</span></div>
                <div><span className="text-muted-foreground">Código:</span> <span className="text-foreground font-mono font-bold">{selectedAffiliate.referral_code}</span></div>
                <div><span className="text-muted-foreground">Indicados:</span> <span className="text-foreground font-bold">{referralCount}</span></div>
              </div>

              {/* Bank info */}
              <div className="border-t border-border pt-3">
                <p className="text-sm font-semibold text-muted-foreground mb-2">Dados bancários</p>
                {selectedAffiliate.pix_key ? (
                  <p className="text-sm text-foreground">Pix ({selectedAffiliate.pix_type}): {selectedAffiliate.pix_key}</p>
                ) : selectedAffiliate.bank_name ? (
                  <p className="text-sm text-foreground">
                    {selectedAffiliate.bank_name} · Ag: {selectedAffiliate.bank_agency} · Conta: {selectedAffiliate.bank_account}{selectedAffiliate.bank_digit ? `-${selectedAffiliate.bank_digit}` : ""}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Não informado</p>
                )}
              </div>

              {/* Social links */}
              {socialLinks && socialLinks.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="text-sm font-semibold text-muted-foreground mb-2">Redes sociais</p>
                  <div className="space-y-1">
                    {socialLinks.map((l: any) => (
                      <div key={l.id} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-xs">{l.platform}</Badge>
                        <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{l.url}</a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin actions */}
              {selectedAffiliate.status === "pending" && (
                <div className="border-t border-border pt-4 space-y-3">
                  <div>
                    <Label>Categoria do afiliado</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nível (selo)</Label>
                    <Select value={tier} onValueChange={setTier}>
                      <SelectTrigger><SelectValue placeholder="Selecione o nível" /></SelectTrigger>
                      <SelectContent>
                        {TIERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => updateStatus.mutate({ id: selectedAffiliate.id, status: "approved", cat: category, tierVal: tier })}
                      disabled={!category || !tier}
                    >
                      <Check className="w-4 h-4 mr-1" /> Aprovar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => updateStatus.mutate({ id: selectedAffiliate.id, status: "rejected" })}
                    >
                      <X className="w-4 h-4 mr-1" /> Recusar
                    </Button>
                  </div>
                </div>
              )}

              {selectedAffiliate.status !== "pending" && (
                <div className="border-t border-border pt-3 space-y-3">
                  <div>
                    <Label>Alterar categoria</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Alterar nível (selo)</Label>
                    <Select value={tier} onValueChange={setTier}>
                      <SelectTrigger><SelectValue placeholder="Selecione o nível" /></SelectTrigger>
                      <SelectContent>
                        {TIERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" onClick={() => updateStatus.mutate({ id: selectedAffiliate.id, status: selectedAffiliate.status, cat: category, tierVal: tier })}>
                    Salvar
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminAffiliates;
