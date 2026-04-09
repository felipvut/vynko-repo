import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, FileText, Image, Video, Trash2, Upload, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const SellerMaterials = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("seller_materials")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setMaterials(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async () => {
    if (!user || !file || !title.trim()) return;
    setUploading(true);

    const ext = file.name.split(".").pop();
    const path = `${user.id}/materials/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("marketplace").upload(path, file);

    if (upErr) {
      toast({ title: "Erro no upload", variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("marketplace").getPublicUrl(path);

    const { error } = await supabase.from("seller_materials").insert({
      user_id: user.id,
      title: title.trim(),
      material_type: type,
      file_url: urlData.publicUrl,
      file_size: file.size,
    } as any);

    if (error) {
      toast({ title: "Erro ao salvar material", variant: "destructive" });
    } else {
      toast({ title: "Material adicionado! 📎" });
      setUploadOpen(false);
      setTitle("");
      setFile(null);
      load();
    }
    setUploading(false);
  };

  const deleteMaterial = async (id: string) => {
    await supabase.from("seller_materials").delete().eq("id", id);
    load();
  };

  const renameMaterial = async () => {
    if (!editingMaterial || !editTitle.trim()) return;
    await supabase.from("seller_materials").update({ title: editTitle.trim() } as any).eq("id", editingMaterial.id);
    setEditingMaterial(null);
    setEditTitle("");
    load();
    toast({ title: "Material renomeado" });
  };

  const typeIcon = (t: string) => {
    if (t === "pdf") return <FileText className="h-5 w-5 text-destructive" />;
    if (t === "photo") return <Image className="h-5 w-5 text-primary" />;
    return <Video className="h-5 w-5 text-info" />;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/seller-dashboard?tab=library")} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-display font-semibold text-foreground">Materiais</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <Button onClick={() => setUploadOpen(true)} className="w-full gradient-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" />
          Novo Material
        </Button>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : materials.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhum material adicionado</p>
        ) : (
          materials.map(m => (
            <div key={m.id} className="glass-card p-4 flex items-center gap-3">
              {typeIcon(m.material_type)}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm text-foreground truncate">{m.title}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {m.material_type.toUpperCase()}
                  </Badge>
                  {m.file_size && (
                    <span className="text-[10px] text-muted-foreground">{formatSize(m.file_size)}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingMaterial(m); setEditTitle(m.title); }}>
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMaterial(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Sheet open={uploadOpen} onOpenChange={setUploadOpen}>
        <SheetContent side="bottom" className="bg-card rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-foreground">Novo Material</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Título</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-secondary/50" placeholder="Ex: Guia de Suplementação" />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="photo">Foto</SelectItem>
                  <SelectItem value="video">Vídeo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Arquivo</Label>
              {file ? (
                <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground truncate flex-1">{file.name}</span>
                  <button onClick={() => setFile(null)} className="text-xs text-destructive">Remover</button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed border-border/50 cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Selecionar arquivo</span>
                  <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                </label>
              )}
            </div>
            <Button onClick={handleUpload} disabled={uploading || !file || !title.trim()} className="w-full gradient-primary text-primary-foreground">
              {uploading ? "Enviando..." : "Salvar Material"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Rename sheet */}
      <Sheet open={!!editingMaterial} onOpenChange={(open) => { if (!open) setEditingMaterial(null); }}>
        <SheetContent side="bottom" className="bg-card rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-foreground">Renomear Material</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="bg-secondary/50" placeholder="Novo título" />
            <Button onClick={renameMaterial} disabled={!editTitle.trim()} className="w-full gradient-primary text-primary-foreground">
              Salvar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default SellerMaterials;
