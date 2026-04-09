import { useState, useRef, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ImagePlus, Video, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import MentionTextarea from "./MentionTextarea";
import { compressImage, compressVideo, validateVideo } from "@/lib/mediaUtils";
import { useBackButton } from "@/hooks/useBackButton";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const CreatePostSheet = ({ open, onOpenChange, onCreated }: Props) => {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);
  useBackButton(open, handleClose);

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 10MB"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setVideoFile(null);
    setVideoPreview(null);
    setVideoDuration(null);
  };

  const pickVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateVideo(file, 50);
    if (!validation.valid) { toast.error(validation.message); return; }

    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      const dur = Math.round(video.duration);
      setVideoDuration(dur);
      setVideoFile(file);
      setVideoPreview(url);
      setImageFile(null);
      setImagePreview(null);
    };
  };

  const removeMedia = () => {
    setImageFile(null);
    setImagePreview(null);
    setVideoFile(null);
    setVideoPreview(null);
    setVideoDuration(null);
  };

  const submit = async () => {
    if (!user || (!content.trim() && !imageFile && !videoFile)) return;
    setSubmitting(true);

    let imageUrl: string | null = null;
    let videoUrl: string | null = null;

    try {
      if (imageFile) {
        setUploadProgress("Comprimindo imagem...");
        const compressed = await compressImage(imageFile);
        const path = `${user.id}/${Date.now()}.jpeg`;
        setUploadProgress("Enviando imagem...");
        const { error } = await supabase.storage.from("post-images").upload(path, compressed, { contentType: "image/jpeg" });
        if (error) { toast.error("Erro ao enviar imagem"); setSubmitting(false); setUploadProgress(""); return; }
        const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      if (videoFile) {
        setUploadProgress("Comprimindo vídeo...");
        const compressed = await compressVideo(videoFile, 0.5, setUploadProgress);
        const isWebm = compressed.type === "video/webm";
        const ext = isWebm ? "webm" : (videoFile.name.split(".").pop() || "mp4");
        const path = `${user.id}/${Date.now()}.${ext}`;
        setUploadProgress("Enviando vídeo...");
        const { error } = await supabase.storage.from("post-videos").upload(path, compressed, { contentType: isWebm ? "video/webm" : videoFile.type });
        if (error) { toast.error("Erro ao enviar vídeo"); setSubmitting(false); setUploadProgress(""); return; }
        const { data: urlData } = supabase.storage.from("post-videos").getPublicUrl(path);
        videoUrl = urlData.publicUrl;
      }

      const postType = videoFile ? "video" : imageFile ? "photo" : "text";
      setUploadProgress("Publicando...");

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: content.trim() || null,
        image_url: imageUrl,
        video_url: videoUrl,
        visibility: "public",
        post_type: postType,
      } as any);

      if (error) {
        toast.error("Erro ao publicar");
      } else {
        toast.success("Publicado!");
        setContent("");
        removeMedia();
        onOpenChange(false);
        onCreated();
      }
    } catch {
      toast.error("Erro inesperado");
    }
    setSubmitting(false);
    setUploadProgress("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Novo Post</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <MentionTextarea
            placeholder="O que você quer compartilhar? Use @ para marcar amigos"
            value={content}
            onChange={setContent}
            rows={3}
          />

          {imagePreview && (
            <div className="relative inline-block">
              <img src={imagePreview} alt="Preview" className="rounded-lg max-h-48 object-cover" />
              <button onClick={removeMedia} className="absolute top-1 right-1 bg-background/80 rounded-full p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {videoPreview && (
            <div className="relative inline-block">
              <video src={videoPreview} className="rounded-lg max-h-48 object-cover" controls muted />
              <button onClick={removeMedia} className="absolute top-1 right-1 bg-background/80 rounded-full p-1 z-10">
                <X className="h-4 w-4" />
              </button>
              {videoDuration && (
                <span className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                  {videoDuration}s
                </span>
              )}
            </div>
          )}

          {uploadProgress && (
            <p className="text-xs text-muted-foreground animate-pulse">{uploadProgress}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => imageRef.current?.click()}>
              <ImagePlus className="h-4 w-4 mr-1" /> Foto
            </Button>
            <Button variant="outline" size="sm" onClick={() => videoRef.current?.click()}>
              <Video className="h-4 w-4 mr-1" /> Vídeo
            </Button>
            <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
            <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" className="hidden" onChange={pickVideo} />
          </div>

          <Button onClick={submit} disabled={submitting || (!content.trim() && !imageFile && !videoFile)} className="w-full gradient-primary text-primary-foreground">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {submitting ? "Enviando..." : "Publicar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CreatePostSheet;
