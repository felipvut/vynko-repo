import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBrazilLocations } from "@/hooks/useBrazilLocations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Loader2, Users2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
];

const BRAZIL_BANKS = [
  "001 - Banco do Brasil", "033 - Santander", "104 - Caixa Econômica",
  "237 - Bradesco", "341 - Itaú Unibanco", "077 - Banco Inter",
  "260 - Nu Pagamentos (Nubank)", "336 - C6 Bank", "212 - Banco Original",
  "756 - Bancoob (Sicoob)", "748 - Sicredi", "422 - Safra",
  "070 - BRB", "085 - Cooperativa Ailos", "136 - Unicred",
  "274 - Money Plus", "290 - PagSeguro", "380 - PicPay",
  "403 - Cora", "637 - Sofisa Direto", "218 - BS2",
];

const PIX_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave aleatória" },
];

const AffiliateRegistration = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [existingAffiliate, setExistingAffiliate] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Form fields
  const [cpf, setCpf] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [city, setCity] = useState("");
  const { states, cities, loadingCities } = useBrazilLocations(selectedState);

  // Bank info
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "pix">("pix");
  const [bankName, setBankName] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankDigit, setBankDigit] = useState("");
  const [pixType, setPixType] = useState("");
  const [pixKey, setPixKey] = useState("");

  // Social links
  const [socialLinks, setSocialLinks] = useState<{ platform: string; url: string }[]>([
    { platform: "instagram", url: "" },
  ]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("affiliates")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setExistingAffiliate(data);
        setCheckingStatus(false);
      });
  }, [user]);

  const formatCPF = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const addSocialLink = () => {
    setSocialLinks([...socialLinks, { platform: "instagram", url: "" }]);
  };

  const removeSocialLink = (idx: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== idx));
  };

  const updateSocialLink = (idx: number, field: "platform" | "url", value: string) => {
    setSocialLinks(socialLinks.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const generateReferralCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!cpf || !fullName || !email) {
      toast.error("Preencha os campos obrigatórios: CPF, nome completo e e-mail.");
      return;
    }
    if (cpf.replace(/\D/g, "").length !== 11) {
      toast.error("CPF inválido.");
      return;
    }

    setLoading(true);
    try {
      const referralCode = generateReferralCode();
      const { data: affiliate, error } = await supabase.from("affiliates").insert({
        user_id: user.id,
        cpf: cpf.replace(/\D/g, ""),
        full_name: fullName,
        email,
        phone,
        address,
        state: selectedState,
        city,
        bank_name: paymentMethod === "bank" ? bankName : null,
        bank_agency: paymentMethod === "bank" ? bankAgency : null,
        bank_account: paymentMethod === "bank" ? bankAccount : null,
        bank_digit: paymentMethod === "bank" ? bankDigit : null,
        pix_key: paymentMethod === "pix" ? pixKey : null,
        pix_type: paymentMethod === "pix" ? pixType : null,
        referral_code: referralCode,
      } as any).select().single();

      if (error) throw error;

      // Insert social links
      const validLinks = socialLinks.filter((l) => l.url.trim());
      if (validLinks.length > 0 && affiliate) {
        await supabase.from("affiliate_social_links").insert(
          validLinks.map((l) => ({
            affiliate_id: (affiliate as any).id,
            platform: l.platform,
            url: l.url.trim(),
          })) as any
        );
      }

      toast.success("Solicitação enviada! Aguarde a aprovação do administrador.");
      navigate("/profile");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar solicitação");
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (existingAffiliate) {
    const statusMap: Record<string, { label: string; color: string }> = {
      pending: { label: "Aguardando aprovação", color: "text-yellow-400" },
      approved: { label: "Aprovado", color: "text-green-400" },
      rejected: { label: "Recusado", color: "text-destructive" },
    };
    const s = statusMap[existingAffiliate.status] || statusMap.pending;

    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="p-4">
          <button onClick={() => navigate("/profile")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 text-sm">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <Card className="border-border">
            <CardContent className="pt-6 text-center space-y-4">
              <Users2 className="w-12 h-12 text-primary mx-auto" />
              <h2 className="text-xl font-bold text-foreground">Programa de Afiliados</h2>
              <p className="text-sm text-muted-foreground">
                Status: <span className={`font-semibold ${s.color}`}>{s.label}</span>
              </p>
              {existingAffiliate.category && (
                <p className="text-sm text-muted-foreground">
                  Categoria: <span className="text-foreground font-medium">{existingAffiliate.category}</span>
                </p>
              )}
              {existingAffiliate.status === "approved" && (
                <Button onClick={() => navigate("/affiliate-dashboard")} className="w-full">
                  Acessar Dashboard
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-4 space-y-4">
        <button onClick={() => navigate("/profile")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div>
          <h1 className="text-2xl font-bold text-foreground font-['Space_Grotesk']">Quero ser Afiliado</h1>
          <p className="text-sm text-muted-foreground mt-1">Preencha seus dados para solicitar aprovação</p>
        </div>

        {/* Personal Info */}
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-base">Dados pessoais</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Nome completo *</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" />
            </div>
            <div>
              <Label>CPF *</Label>
              <Input value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
            </div>
            <div>
              <Label>E-mail *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Estado</Label>
                <Select value={selectedState} onValueChange={(v) => { setSelectedState(v); setCity(""); }}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {states.map((s) => <SelectItem key={s.sigla} value={s.sigla}>{s.sigla}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cidade</Label>
                <Select value={city} onValueChange={setCity} disabled={loadingCities || !selectedState}>
                  <SelectTrigger><SelectValue placeholder={loadingCities ? "..." : "Selecione"} /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {cities.map((c) => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro" />
            </div>
          </CardContent>
        </Card>

        {/* Social Links */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Redes sociais</CardTitle>
              <Button size="sm" variant="outline" onClick={addSocialLink}><Plus className="w-3 h-3 mr-1" /> Adicionar</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {socialLinks.map((link, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                <div className="w-32">
                  <Select value={link.platform} onValueChange={(v) => updateSocialLink(idx, "platform", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  className="flex-1"
                  value={link.url}
                  onChange={(e) => updateSocialLink(idx, "url", e.target.value)}
                  placeholder="https://..."
                />
                {socialLinks.length > 1 && (
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => removeSocialLink(idx)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-base">Dados bancários</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant={paymentMethod === "pix" ? "default" : "outline"}
                size="sm"
                onClick={() => setPaymentMethod("pix")}
              >
                Pix
              </Button>
              <Button
                variant={paymentMethod === "bank" ? "default" : "outline"}
                size="sm"
                onClick={() => setPaymentMethod("bank")}
              >
                Conta bancária
              </Button>
            </div>

            {paymentMethod === "pix" ? (
              <>
                <div>
                  <Label>Tipo de chave</Label>
                  <Select value={pixType} onValueChange={setPixType}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {PIX_TYPES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Chave Pix</Label>
                  <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="Sua chave Pix" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label>Banco</Label>
                  <Select value={bankName} onValueChange={setBankName}>
                    <SelectTrigger><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {BRAZIL_BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>Agência</Label>
                    <Input value={bankAgency} onChange={(e) => setBankAgency(e.target.value)} placeholder="0000" />
                  </div>
                  <div>
                    <Label>Conta</Label>
                    <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="00000" />
                  </div>
                  <div>
                    <Label>Dígito</Label>
                    <Input value={bankDigit} onChange={(e) => setBankDigit(e.target.value)} placeholder="0" maxLength={2} />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Button className="w-full" onClick={handleSubmit} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users2 className="w-4 h-4 mr-2" />}
          Enviar solicitação
        </Button>
      </div>
      <BottomNav />
    </div>
  );
};

export default AffiliateRegistration;
