import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Upload, X, Image, Video, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const CreateService = () => {
  const navigate = useNavigate();
  const { serviceId } = useParams();
  const isEditing = !!serviceId;
  const { user } = useAuth();
  const [sellerProfileId, setSellerProfileId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingService, setLoadingService] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("workout");
  const [isFree, setIsFree] = useState(false);
  const [price, setPrice] = useState("");
  const [billingType, setBillingType] = useState<string>("one_time");
  const [billingInterval, setBillingInterval] = useState<string>("monthly");
  const [billingCount, setBillingCount] = useState("1");
  const [deliveryDays, setDeliveryDays] = useState("7");
  const [maxClients, setMaxClients] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [existingMedia, setExistingMedia] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("seller_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSellerProfileId(data.id);
      });

    if (isEditing) {
      loadExistingService();
    }
  }, [user, serviceId]);

  const loadExistingService = async () => {
    if (!serviceId) return;
    setLoadingService(true);

    const [{ data: svc }, { data: media }] = await Promise.all([
      supabase.from("marketplace_services").select("*").eq("id", serviceId).single(),
      supabase.from("service_media").select("*").eq("service_id", serviceId).order("media_order"),
    ]);

    if (svc) {
      setTitle(svc.title);
      setDescription(svc.description);
      setCategory(svc.category);
      setIsFree(svc.is_free);
      setPrice(svc.price > 0 ? String(svc.price) : "");
      setBillingType(svc.billing_type);
      setBillingInterval(svc.billing_interval || "monthly");
      setBillingCount(svc.billing_count ? String(svc.billing_count) : "1");
      setDeliveryDays(svc.delivery_time_days ? String(svc.delivery_time_days) : "7");
      setMaxClients(svc.max_clients ? String(svc.max_clients) : "");
      if (svc.cover_image_url) {
        setExistingCoverUrl(svc.cover_image_url);
        setCoverPreview(svc.cover_image_url);
      }
    }

    setExistingMedia(media || []);
    setLoadingService(false);
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setExistingCoverUrl(null);
  };

  const handleMediaAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const currentPhotos = existingMedia.filter(m => m.media_type === "photo").length + mediaFiles.filter(f => f.type.startsWith("image")).length;
    const currentVideos = existingMedia.filter(m => m.media_type === "video").length + mediaFiles.filter(f => f.type.startsWith("video")).length;
    const newPhotos = files.filter(f => f.type.startsWith("image")).length;
    const newVideos = files.filter(f => f.type.startsWith("video")).length;
    if (currentPhotos + newPhotos > 5) {
      toast({ title: "Máximo 5 fotos", variant: "destructive" });
      return;
    }
    if (currentVideos + newVideos > 3) {
      toast({ title: "Máximo 3 vídeos", variant: "destructive" });
      return;
    }
    setMediaFiles(prev => [...prev, ...files]);
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingMedia = async (mediaId: string) => {
    await supabase.from("service_media").delete().eq("id", mediaId);
    setExistingMedia(prev => prev.filter(m => m.id !== mediaId));
  };

  const handleSubmit = async () => {
    if (!user || !sellerProfileId) return;
    if (!title.trim() || !description.trim()) {
      toast({ title: "Preencha título e descrição", variant: "destructive" });
      return;
    }
    if (!isFree && (!price || Number(price) <= 0)) {
      toast({ title: "Defina um preço válido", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      // Upload cover if new
      let coverUrl: string | null = existingCoverUrl;
      if (coverFile) {
        const ext = coverFile.name.split(".").pop();
        const path = `${user.id}/covers/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("marketplace").upload(path, coverFile);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("marketplace").getPublicUrl(path);
          coverUrl = urlData.publicUrl;
        }
      }

      const serviceData = {
        title: title.trim(),
        description: description.trim(),
        category,
        price: isFree ? 0 : Number(price),
        is_free: isFree,
        billing_type: isFree ? "one_time" : billingType,
        billing_interval: billingType === "recurring" ? billingInterval : null,
        billing_count: billingType === "recurring" ? (Number(billingCount) || 1) : null,
        delivery_time_days: Number(deliveryDays) || 7,
        max_clients: maxClients ? Number(maxClients) : null,
        cover_image_url: coverUrl,
      } as any;

      let svcId: string;

      if (isEditing) {
        const { error: updateErr } = await supabase
          .from("marketplace_services")
          .update(serviceData)
          .eq("id", serviceId)
          .eq("user_id", user.id);
        if (updateErr) throw updateErr;
        svcId = serviceId!;
      } else {
        const { data: svc, error: svcErr } = await supabase
          .from("marketplace_services")
          .insert({
            ...serviceData,
            seller_id: sellerProfileId,
            user_id: user.id,
            status: "active",
          })
          .select()
          .single();
        if (svcErr) throw svcErr;
        svcId = svc.id;
      }

      // Upload new media files
      const mediaOffset = existingMedia.length;
      for (let i = 0; i < mediaFiles.length; i++) {
        const file = mediaFiles[i];
        const ext = file.name.split(".").pop();
        const path = `${user.id}/media/${Date.now()}_${i}.${ext}`;
        const { error: mediaUpErr } = await supabase.storage.from("marketplace").upload(path, file);
        if (!mediaUpErr) {
          const { data: urlData } = supabase.storage.from("marketplace").getPublicUrl(path);
          await supabase.from("service_media").insert({
            service_id: svcId,
            user_id: user.id,
            media_type: file.type.startsWith("video") ? "video" : "photo",
            url: urlData.publicUrl,
            media_order: mediaOffset + i,
          } as any);
        }
      }

      toast({ title: isEditing ? "Serviço atualizado! ✅" : "Serviço criado com sucesso! 🎉" });
      navigate("/seller-dashboard");
    } catch (err: any) {
      toast({ title: "Erro ao salvar serviço", description: err.message, variant: "destructive" });
    }

    setSaving(false);
  };

  if (loadingService) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-display font-semibold text-foreground">
          {isEditing ? "Editar Serviço" : "Novo Serviço"}
        </h1>
      </div>

      <div className="px-4 pt-4 space-y-6">
        {/* Cover */}
        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">Capa do anúncio</Label>
          {coverPreview ? (
            <div className="relative aspect-video rounded-xl overflow-hidden border border-border/50">
              <img src={coverPreview} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => { setCoverFile(null); setCoverPreview(null); setExistingCoverUrl(null); }}
                className="absolute top-2 right-2 p-1 bg-background/80 rounded-full"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-40 rounded-xl border-2 border-dashed border-border/50 cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Adicionar capa</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
            </label>
          )}
        </div>

        {/* Basic info */}
        <div className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground mb-1 block">Título</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Treino HIIT personalizado"
              className="bg-secondary/50"
              maxLength={100}
            />
          </div>

          <div>
            <Label className="text-sm text-muted-foreground mb-1 block">Descrição</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descreva seu serviço em detalhes..."
              className="bg-secondary/50 min-h-[120px]"
              maxLength={2000}
            />
          </div>

          <div>
            <Label className="text-sm text-muted-foreground mb-1 block">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workout">🏋️ Treino</SelectItem>
                <SelectItem value="diet">🥗 Dieta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pricing */}
        <div className="space-y-4">
          {!isFree && (
            <>
              <div>
                <Label className="text-sm text-muted-foreground mb-1 block">Preço (R$)</Label>
                <Input
                  type="number"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="bg-secondary/50"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <Label className="text-sm text-muted-foreground mb-1 block">Tipo de cobrança</Label>
                <Select value={billingType} onValueChange={setBillingType}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">💰 Venda única</SelectItem>
                    <SelectItem value="recurring">🔄 Recorrente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {billingType === "recurring" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm text-muted-foreground mb-1 block">Periodicidade</Label>
                    <Select value={billingInterval} onValueChange={setBillingInterval}>
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground mb-1 block">
                      {billingInterval === "daily" ? "Quantos dias" : billingInterval === "weekly" ? "Quantas semanas" : billingInterval === "monthly" ? "Quantos meses" : "Quantos trimestres"}
                    </Label>
                    <Input
                      type="number"
                      value={billingCount}
                      onChange={e => setBillingCount(e.target.value)}
                      placeholder="1"
                      className="bg-secondary/50"
                      min={1}
                      max={365}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Delivery */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm text-muted-foreground mb-1 block">Prazo de disponibilização (dias)</Label>
            <Input
              type="number"
              value={deliveryDays}
              onChange={e => setDeliveryDays(e.target.value)}
              className="bg-secondary/50"
              min="1"
            />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground mb-1 block">Máx. clientes</Label>
            <Input
              type="number"
              value={maxClients}
              onChange={e => setMaxClients(e.target.value)}
              placeholder="Ilimitado"
              className="bg-secondary/50"
              min="1"
            />
          </div>
        </div>

        {/* Media */}
        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">
            Mídia ({existingMedia.filter(m => m.media_type === "photo").length + mediaFiles.filter(f => f.type.startsWith("image")).length}/5 fotos, {existingMedia.filter(m => m.media_type === "video").length + mediaFiles.filter(f => f.type.startsWith("video")).length}/3 vídeos)
          </Label>
          <div className="flex flex-wrap gap-2">
            {/* Existing media */}
            {existingMedia.map((m) => (
              <div key={m.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border/50">
                {m.media_type === "photo" ? (
                  <img src={m.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-secondary flex items-center justify-center">
                    <Video className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <button
                  onClick={() => removeExistingMedia(m.id)}
                  className="absolute top-0.5 right-0.5 p-0.5 bg-background/80 rounded-full"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {/* New media */}
            {mediaFiles.map((file, i) => (
              <div key={`new-${i}`} className="relative w-20 h-20 rounded-lg overflow-hidden border border-primary/30">
                {file.type.startsWith("image") ? (
                  <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-secondary flex items-center justify-center">
                    <Video className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <button
                  onClick={() => removeMedia(i)}
                  className="absolute top-0.5 right-0.5 p-0.5 bg-background/80 rounded-full"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="w-20 h-20 rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
              <Plus className="h-6 w-6 text-muted-foreground" />
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleMediaAdd}
              />
            </label>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full gradient-primary text-primary-foreground font-semibold py-6"
        >
          {saving ? (
            <div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            isEditing ? "Salvar Alterações" : "Publicar Serviço"
          )}
        </Button>
      </div>
    </div>
  );
};

export default CreateService;
