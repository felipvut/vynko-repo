import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Copy, Check, Send, AtSign, FileText } from "lucide-react";

interface ShareChallengeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challengeId: string;
  challengeTitle: string;
}

const ShareChallengeSheet = ({ open, onOpenChange, challengeId, challengeTitle }: ShareChallengeSheetProps) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [postContent, setPostContent] = useState(`Participe do desafio "${challengeTitle}"! 💪🔥`);
  const [posting, setPosting] = useState(false);

  const shareUrl = `${window.location.origin}/challenges?id=${challengeId}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const postToTimeline = async () => {
    if (!user) return;
    setPosting(true);
    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      content: `${postContent}\n\n🔗 ${shareUrl}`,
      post_type: "text",
      visibility: "public",
    });
    if (error) {
      toast.error("Erro ao postar");
    } else {
      toast.success("Publicado na timeline!");
      onOpenChange(false);
    }
    setPosting(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-left">Compartilhar Desafio</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Copy link */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Link do desafio</label>
            <div className="flex gap-2">
              <Input value={shareUrl} readOnly className="text-xs" />
              <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0">
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Post to timeline */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" /> Postar na timeline
            </label>
            <Textarea
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              rows={3}
              className="text-sm"
              placeholder="Escreva algo sobre o desafio... Use @username para marcar amigos"
            />
            <p className="text-[10px] text-muted-foreground">Use @username para mencionar amigos</p>
            <Button className="w-full gradient-primary text-primary-foreground" onClick={postToTimeline} disabled={posting || !postContent.trim()}>
              <Send className="h-4 w-4 mr-2" /> Publicar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ShareChallengeSheet;
