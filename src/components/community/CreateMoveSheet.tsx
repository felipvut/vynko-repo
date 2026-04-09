import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ImageIcon, Camera, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { compressImage, compressVideo, validateVideo } from "@/lib/mediaUtils";
import MoveEditor, { type MoveEditData } from "./MoveEditor";
import { useBackButton } from "@/hooks/useBackButton";

interface CreateMoveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const CreateMoveSheet = ({ open, onOpenChange, onCreated }: CreateMoveSheetProps) => {
  const { user } = useAuth();
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedType, setCapturedType] = useState<"photo" | "video">("photo");
  const [showEditor, setShowEditor] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);
  useBackButton(open, handleClose);

  // Auto-open gallery when sheet opens
  useEffect(() => {
    if (open && !showEditor && !capturedFile) {
      const timer = setTimeout(() => galleryRef.current?.click(), 100);
      return () => clearTimeout(timer);
    }
  }, [open, showEditor, capturedFile]);

  if (!open) return null;

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    processFile(file, isVideo ? "video" : "photo");
    e.target.value = "";
  };

  const processFile = (file: File, type: "photo" | "video") => {
    if (type === "photo") {
      if (file.size > 10 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 10MB"); return; }
      setCapturedFile(file);
      setCapturedType("photo");
      setShowEditor(true);
    } else {
      const validation = validateVideo(file, 50);
      if (!validation.valid) { toast.error(validation.message); return; }

      const video = document.createElement("video");
      video.preload = "metadata";
      const url = URL.createObjectURL(file);
      video.src = url;
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        if (video.duration > 45) {
          toast.error("Vídeo deve ter no máximo 45 segundos");
          return;
        }
        if (video.duration < 3) {
          toast.error("Vídeo muito curto (mínimo 3 segundos)");
          return;
        }
        setCapturedFile(file);
        setCapturedType("video");
        setShowEditor(true);
      };
    }
  };

  const handlePublish = async (data: MoveEditData) => {
    if (!user) return;
    setPublishing(true);

    try {
      let imageUrl: string | null = null;
      let videoUrl: string | null = null;

      if (data.type === "photo") {
        setUploadProgress("Comprimindo imagem...");
        const compressed = await compressImage(data.file);
        const path = `${user.id}/${Date.now()}.jpeg`;
        setUploadProgress("Enviando imagem...");
        const { error } = await supabase.storage.from("post-images").upload(path, compressed, { contentType: "image/jpeg" });
        if (error) { toast.error("Erro ao enviar imagem"); setPublishing(false); return; }
        const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      } else {
        setUploadProgress("Comprimindo vídeo...");
        const compressed = await compressVideo(data.file, 0.5, setUploadProgress);
        const isWebm = compressed.type === "video/webm";
        const ext = isWebm ? "webm" : (data.file.name.split(".").pop() || "mp4");
        const path = `${user.id}/${Date.now()}.${ext}`;
        setUploadProgress("Enviando vídeo...");
        const { error } = await supabase.storage.from("post-videos").upload(path, compressed, { contentType: isWebm ? "video/webm" : data.file.type });
        if (error) { toast.error("Erro ao enviar vídeo"); setPublishing(false); return; }
        const { data: urlData } = supabase.storage.from("post-videos").getPublicUrl(path);
        videoUrl = urlData.publicUrl;
      }

      setUploadProgress("Publicando...");

      // Build content from overlays
      const overlayTexts = data.overlays.filter(o => o.type === "text").map(o => o.content);
      const mentionTexts = data.mentions.map(m => `@${m}`);
      const hashtagTexts = data.hashtags.map(h => `#${h}`);
      const contentParts = [...overlayTexts, ...mentionTexts, ...hashtagTexts];
      if (data.linkUrl) contentParts.push(data.linkUrl);
      const content = contentParts.length > 0 ? contentParts.join(" ") : null;

      // Serialize overlays for rendering in feed
      const overlaysJson = data.overlays.map(o => ({
        type: o.type,
        content: o.content,
        x: o.x,
        y: o.y,
        scale: o.scale,
        rotation: o.rotation,
        color: o.color,
        fontSize: o.fontSize,
        fontFamily: o.fontFamily,
        fontWeight: o.fontWeight,
        fontStyle: o.fontStyle,
        textAlign: o.textAlign,
        textShadow: o.textShadow,
        textBackground: o.textBackground,
        showAt: o.showAt,
        hideAt: o.hideAt,
        gifUrl: o.gifUrl,
      }));

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content,
        image_url: imageUrl,
        video_url: videoUrl,
        visibility: "public",
        post_type: "move",
        hashtags: data.hashtags.length > 0 ? data.hashtags : [],
        duration_seconds: data.trimEnd ? Math.round((data.trimEnd || 0) - (data.trimStart || 0)) : null,
        overlays: overlaysJson,
      } as any);

      if (error) {
        toast.error("Erro ao publicar");
      } else {
        toast.success("Move publicado! 🔥");
        setCapturedFile(null);
        setShowEditor(false);
        onOpenChange(false);
        onCreated();
      }
    } catch {
      toast.error("Erro inesperado");
    }
    setPublishing(false);
    setUploadProgress("");
  };

  const handleSaveDraft = (data: MoveEditData) => {
    // Save to localStorage
    try {
      const draft = {
        type: data.type,
        hashtags: data.hashtags,
        mentions: data.mentions,
        linkUrl: data.linkUrl,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem("move_draft", JSON.stringify(draft));
      toast.success("Rascunho salvo localmente!");
    } catch {
      toast.error("Erro ao salvar rascunho");
    }
  };

  const handleDiscard = () => {
    setCapturedFile(null);
    setShowEditor(false);
  };

  // If editor is open
  if (showEditor && capturedFile) {
    return (
      <>
        <MoveEditor
          mediaFile={capturedFile}
          mediaType={capturedType}
          onPublish={handlePublish}
          onDiscard={handleDiscard}
          onSaveDraft={handleSaveDraft}
        />
        {publishing && createPortal(
          <div className="fixed inset-0 z-[200] bg-black/80 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-white text-sm">{uploadProgress}</p>
          </div>,
          document.body
        )}
      </>
    );
  }

  // Gallery/Camera picker screen
  return createPortal(
    <div className="fixed inset-0 z-[90] bg-black flex flex-col items-center justify-center">
      {/* Close */}
      <button
        onClick={() => onOpenChange(false)}
        className="absolute top-4 right-4 z-10 p-2"
      >
        <X className="h-6 w-6 text-white" />
      </button>

      <div className="text-center space-y-6 px-6">
        <div>
          <h2 className="text-white text-2xl font-bold mb-2">Criar Move</h2>
          <p className="text-white/60 text-sm">Escolha uma foto ou vídeo</p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
          <Button
            onClick={() => galleryRef.current?.click()}
            className="h-14 gradient-primary text-primary-foreground text-base w-full"
          >
            <ImageIcon className="h-5 w-5 mr-2" />
            Galeria
          </Button>

          <Button
            onClick={() => cameraRef.current?.click()}
            variant="outline"
            className="h-14 text-base w-full border-white/20 text-white hover:bg-white/10"
          >
            <Camera className="h-5 w-5 mr-2" />
            Câmera
          </Button>
        </div>

        <p className="text-white/40 text-xs">
          Vídeos de até 45 segundos • Proporção 9:16
        </p>
      </div>

      {/* Gallery input (no capture attr = opens gallery) */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Camera input (capture attr = opens camera directly) */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />
    </div>,
    document.body
  );
};

export default CreateMoveSheet;
