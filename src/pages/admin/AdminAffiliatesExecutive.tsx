import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users2, TrendingUp, Award } from "lucide-react";

const AdminAffiliatesExecutive = () => {
  const { data: affiliatesData, isLoading } = useQuery({
    queryKey: ["admin-affiliates-executive"],
    queryFn: async () => {
      // Get all approved affiliates
      const { data: affiliates } = await supabase
        .from("affiliates")
        .select("id, user_id, full_name, email, category, referral_code, status, created_at, approved_at")
        .eq("status", "approved")
        .order("approved_at", { ascending: false });

      if (!affiliates?.length) return [];

      // Get all referrals
      const { data: allReferrals } = await supabase
        .from("affiliate_referrals")
        .select("affiliate_id, referred_user_id, created_at");

      // Build referral map
      const referralMap: Record<string, { total: number; userIds: string[] }> = {};
      allReferrals?.forEach((r) => {
        if (!referralMap[r.affiliate_id]) referralMap[r.affiliate_id] = { total: 0, userIds: [] };
        referralMap[r.affiliate_id].total++;
        referralMap[r.affiliate_id].userIds.push(r.referred_user_id);
      });

      return affiliates.map((a) => ({
        ...a,
        referrals: referralMap[a.id]?.total ?? 0,
        referredUserIds: referralMap[a.id]?.userIds ?? [],
      }));
    },
    staleTime: 30_000,
  });

  const totalReferrals = affiliatesData?.reduce((s, a) => s + a.referrals, 0) ?? 0;
  const topAffiliate = affiliatesData?.reduce((top, a) => (a.referrals > (top?.referrals ?? 0) ? a : top), affiliatesData[0]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Afiliados — Executivo</h2>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Afiliados aprovados</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{affiliatesData?.length ?? 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 text-primary"><Users2 className="w-5 h-5" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de indicações</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{totalReferrals}</p>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10 text-green-400"><TrendingUp className="w-5 h-5" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Melhor afiliado</p>
                  <p className="text-lg font-bold text-foreground mt-1">{topAffiliate?.full_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{topAffiliate?.referrals ?? 0} indicações</p>
                </div>
                <div className="p-3 rounded-xl bg-yellow-500/10 text-yellow-400"><Award className="w-5 h-5" /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-lg">Performance por afiliado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Afiliado</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead className="text-right">Indicados</TableHead>
                    <TableHead>Aprovado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : !affiliatesData?.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum afiliado aprovado
                      </TableCell>
                    </TableRow>
                  ) : (
                    affiliatesData.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-foreground">{a.full_name}</p>
                            <p className="text-xs text-muted-foreground">{a.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{a.category || "—"}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{a.referral_code}</TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-bold ${a.referrals > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                            {a.referrals}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.approved_at ? new Date(a.approved_at).toLocaleDateString("pt-BR") : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminAffiliatesExecutive;
