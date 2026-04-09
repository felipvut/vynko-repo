import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, Type, Smile, AtSign, Hash, Link2, Scissors,
  Trash2, Save, Send, Undo2, Image as ImageIcon,
  Bold, Italic, AlignLeft, AlignCenter, RotateCw,
  Search, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MoveEditorProps {
  mediaFile: File;
  mediaType: "photo" | "video";
  onPublish: (editedData: MoveEditData) => void;
  onDiscard: () => void;
  onSaveDraft: (editedData: MoveEditData) => void;
}

export interface MoveEditData {
  file: File;
  type: "photo" | "video";
  overlays: EditorOverlay[];
  hashtags: string[];
  mentions: string[];
  linkUrl: string | null;
  trimStart?: number;
  trimEnd?: number;
}

export interface EditorOverlay {
  id: string;
  type: "text" | "emoji" | "sticker" | "gif";
  content: string;
  x: number; // percentage
  y: number; // percentage
  scale: number;
  rotation: number;
  // Text-specific
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: string;
  textShadow?: boolean;
  textBackground?: string | null;
  // Timeline (video)
  showAt?: number; // seconds
  hideAt?: number; // seconds
  // GIF
  gifUrl?: string;
}

type EditorTool = "text" | "emoji" | "sticker" | "gif" | "mention" | "hashtag" | "link" | "trim" | "timeline" | null;

const EMOJI_LIST = [
  "💪", "🔥", "⭐", "🏆", "❤️", "👏", "😤", "💯", "🎯", "⚡",
  "🥇", "🏋️", "🍎", "💚", "🎉", "😎", "🙌", "💥", "🧠", "🎶",
  "👑", "🦾", "🫡", "😈", "🤩", "✨", "🌟", "💫", "🔱", "⚔️",
  "🛡️", "🏅", "🚀", "💎", "🧡", "💜", "💙", "💛", "🤍", "🖤"
];

const STICKERS = [
  "💪🏋️‍♂️ TREINO!", "🔥 ON FIRE", "⭐ PR!", "🏆 CAMPEÃO",
  "💯 DEDICAÇÃO", "🎯 FOCO", "😤 NO PAIN", "🚀 EVOLUÇÃO",
  "💎 DIAMANTE", "👑 REI DO TREINO", "⚡ ENERGIA", "🥇 TOP 1"
];

const TEXT_COLORS = [
  "#ffffff", "#000000", "#ff3b30", "#ff9500", "#ffcc00",
  "#34c759", "#007aff", "#af52de", "#ff2d55", "#5856d6",
  "#00c7be", "#ff6482"
];

const FONT_FAMILIES = [
  { name: "Sans", value: "system-ui, sans-serif" },
  { name: "Serif", value: "Georgia, serif" },
  { name: "Mono", value: "ui-monospace, monospace" },
  { name: "Cursive", value: "cursive" },
  { name: "Impact", value: "Impact, sans-serif" },
  { name: "Comic", value: "'Comic Sans MS', cursive" },
];

const MoveEditor = ({ mediaFile, mediaType, onPublish, onDiscard, onSaveDraft }: MoveEditorProps) => {
  const [overlays, setOverlays] = useState<EditorOverlay[]>([]);
  const [activeTool, setActiveTool] = useState<EditorTool>(null);
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null);

  // Text tool state
  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textSize, setTextSize] = useState(24);
  const [textFont, setTextFont] = useState(FONT_FAMILIES[0].value);
  const [textBold, setTextBold] = useState(true);
  const [textItalic, setTextItalic] = useState(false);
  const [textAlign, setTextAlign] = useState("center");
  const [textShadow, setTextShadow] = useState(true);
  const [textBg, setTextBg] = useState<string | null>(null);

  // Metadata
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [mentionInput, setMentionInput] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  // Trim
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(45);
  const [videoDuration, setVideoDuration] = useState(0);

  // GIF search
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [gifLoading, setGifLoading] = useState(false);

  // Drag state
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Pinch state
  const [pinchData, setPinchData] = useState<{ initialDist: number; initialScale: number; initialAngle: number; initialRot: number } | null>(null);

  const mediaUrl = useRef(URL.createObjectURL(mediaFile)).current;
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => URL.revokeObjectURL(mediaUrl), [mediaUrl]);

  useEffect(() => {
    if (mediaType === "video" && videoRef.current) {
      videoRef.current.onloadedmetadata = () => {
        const dur = videoRef.current!.duration;
        setVideoDuration(dur);
        setTrimEnd(Math.min(dur, 45));
      };
    }
  }, [mediaType]);

  // === GIF Search (via edge function) ===
  const searchGifs = async (query: string) => {
    if (!query.trim()) return;
    setGifLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("tenor-search", {
        body: { q: query },
      });
      if (error) throw error;
      setGifResults(data?.results || []);
    } catch {
      toast.error("Erro ao buscar GIFs");
    }
    setGifLoading(false);
  };

  // === Overlay management ===
  const addOverlay = (overlay: Omit<EditorOverlay, "id">) => {
    const id = crypto.randomUUID();
    setOverlays(prev => [...prev, { ...overlay, id }]);
    setSelectedOverlay(id);
  };

  const updateOverlay = (id: string, updates: Partial<EditorOverlay>) => {
    setOverlays(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const removeOverlay = (id: string) => {
    setOverlays(prev => prev.filter(o => o.id !== id));
    if (selectedOverlay === id) setSelectedOverlay(null);
  };

  const addTextOverlay = () => {
    if (!textInput.trim()) return;
    addOverlay({
      type: "text",
      content: textInput,
      x: 50, y: 50,
      scale: 1, rotation: 0,
      color: textColor,
      fontSize: textSize,
      fontFamily: textFont,
      fontWeight: textBold ? "bold" : "normal",
      fontStyle: textItalic ? "italic" : "normal",
      textAlign,
      textShadow,
      textBackground: textBg,
      showAt: 0,
      hideAt: mediaType === "video" ? videoDuration : undefined,
    });
    setTextInput("");
    setActiveTool(null);
  };

  const addEmojiOverlay = (emoji: string) => {
    addOverlay({
      type: "emoji",
      content: emoji,
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 60,
      scale: 1, rotation: 0,
      fontSize: 48,
    });
  };

  const addStickerOverlay = (sticker: string) => {
    addOverlay({
      type: "sticker",
      content: sticker,
      x: 50, y: 40,
      scale: 1, rotation: 0,
      fontSize: 20,
      color: "#ffffff",
      textBackground: "rgba(0,0,0,0.7)",
      textShadow: false,
    });
  };

  const addGifOverlay = (gif: any) => {
    const gifUrl = gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url;
    if (!gifUrl) return;
    addOverlay({
      type: "gif",
      content: "",
      gifUrl,
      x: 50, y: 50,
      scale: 1, rotation: 0,
    });
    setActiveTool(null);
  };

  // === Touch handlers ===
  const handleOverlayTouchStart = (id: string, e: React.TouchEvent) => {
    e.stopPropagation();
    setSelectedOverlay(id);

    if (e.touches.length === 2) {
      // Pinch start
      const t1 = e.touches[0], t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
      const overlay = overlays.find(o => o.id === id);
      setPinchData({
        initialDist: dist,
        initialScale: overlay?.scale || 1,
        initialAngle: angle,
        initialRot: overlay?.rotation || 0,
      });
    } else {
      // Single touch drag
      const touch = e.touches[0];
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDragging(id);
      const overlay = overlays.find(o => o.id === id);
      if (overlay) {
        setDragOffset({
          x: touch.clientX - (rect.left + (overlay.x / 100) * rect.width),
          y: touch.clientY - (rect.top + (overlay.y / 100) * rect.height),
        });
      }
    }
  };

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const targetId = dragging || selectedOverlay;

    if (e.touches.length === 2 && pinchData && targetId) {
      // Pinch zoom + rotate
      const t1 = e.touches[0], t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
      const newScale = Math.max(0.3, Math.min(5, pinchData.initialScale * (dist / pinchData.initialDist)));
      const newRot = pinchData.initialRot + (angle - pinchData.initialAngle);
      updateOverlay(targetId, { scale: newScale, rotation: newRot });
    } else if (dragging && e.touches.length === 1) {
      // Drag
      const touch = e.touches[0];
      const newX = ((touch.clientX - dragOffset.x - rect.left) / rect.width) * 100;
      const newY = ((touch.clientY - dragOffset.y - rect.top) / rect.height) * 100;
      updateOverlay(dragging, {
        x: Math.max(0, Math.min(100, newX)),
        y: Math.max(0, Math.min(100, newY)),
      });
    }
  }, [dragging, dragOffset, pinchData, selectedOverlay, overlays]);

  const handleTouchEnd = () => {
    setDragging(null);
    setPinchData(null);
  };

  // Mouse drag (desktop)
  const handleOverlayMouseDown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOverlay(id);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging(id);
    const overlay = overlays.find(o => o.id === id);
    if (overlay) {
      setDragOffset({
        x: e.clientX - (rect.left + (overlay.x / 100) * rect.width),
        y: e.clientY - (rect.top + (overlay.y / 100) * rect.height),
      });
    }
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const newX = ((e.clientX - dragOffset.x - rect.left) / rect.width) * 100;
      const newY = ((e.clientY - dragOffset.y - rect.top) / rect.height) * 100;
      updateOverlay(dragging, {
        x: Math.max(0, Math.min(100, newX)),
        y: Math.max(0, Math.min(100, newY)),
      });
    };
    const onUp = () => setDragging(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, dragOffset]);

  // Hashtag / Mention helpers
  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, "").toLowerCase();
    if (tag && !hashtags.includes(tag) && hashtags.length < 10) {
      setHashtags(prev => [...prev, tag]);
      setHashtagInput("");
    }
  };

  const addMention = () => {
    const m = mentionInput.trim().replace(/^@/, "");
    if (m && !mentions.includes(m)) {
      setMentions(prev => [...prev, m]);
      setMentionInput("");
    }
  };

  const handlePublish = () => {
    onPublish({
      file: mediaFile, type: mediaType, overlays, hashtags, mentions,
      linkUrl: linkUrl.trim() || null,
      trimStart: mediaType === "video" ? trimStart : undefined,
      trimEnd: mediaType === "video" ? trimEnd : undefined,
    });
  };

  const handleSaveDraft = () => {
    onSaveDraft({
      file: mediaFile, type: mediaType, overlays, hashtags, mentions,
      linkUrl: linkUrl.trim() || null,
    });
  };

  const selectedOv = overlays.find(o => o.id === selectedOverlay);

  return createPortal(
    <div className="fixed inset-0 z-[90] bg-black flex flex-col">
      {/* Top toolbar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-2 py-2 bg-gradient-to-b from-black/70 to-transparent">
        <button onClick={onDiscard} className="p-2"><X className="h-6 w-6 text-white" /></button>
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
          {([
            { tool: "text" as EditorTool, icon: Type, label: "Texto" },
            { tool: "emoji" as EditorTool, icon: Smile, label: "Emoji" },
            { tool: "sticker" as EditorTool, icon: Sparkles, label: "Sticker" },
            { tool: "gif" as EditorTool, icon: ImageIcon, label: "GIF" },
            { tool: "mention" as EditorTool, icon: AtSign, label: "@" },
            { tool: "hashtag" as EditorTool, icon: Hash, label: "#" },
            { tool: "link" as EditorTool, icon: Link2, label: "Link" },
            ...(mediaType === "video" ? [
              { tool: "trim" as EditorTool, icon: Scissors, label: "Cortar" },
              { tool: "timeline" as EditorTool, icon: RotateCw, label: "Timeline" },
            ] : []),
          ]).map(({ tool, icon: Icon, label }) => (
            <button
              key={tool}
              onClick={() => { setActiveTool(activeTool === tool ? null : tool); setSelectedOverlay(null); }}
              className={`flex flex-col items-center px-2 py-1 rounded-lg ${activeTool === tool ? "bg-white/20" : ""}`}
            >
              <Icon className="h-4 w-4 text-white" />
              <span className="text-white text-[8px] mt-0.5">{label}</span>
            </button>
          ))}
        </div>
        <button onClick={() => { setOverlays([]); setSelectedOverlay(null); }} className="p-2">
          <Undo2 className="h-5 w-5 text-white/70" />
        </button>
      </div>

      {/* Media preview with overlays */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => setSelectedOverlay(null)}
      >
        {mediaType === "video" ? (
          <video ref={videoRef} src={mediaUrl} className="w-full h-full object-contain" autoPlay loop muted playsInline />
        ) : (
          <img src={mediaUrl} alt="" className="w-full h-full object-contain" />
        )}

        {/* Overlays */}
        {overlays.map(o => (
          <div
            key={o.id}
            className={`absolute touch-none select-none cursor-move ${selectedOverlay === o.id ? "ring-2 ring-primary ring-offset-1" : ""}`}
            style={{
              left: `${o.x}%`,
              top: `${o.y}%`,
              transform: `translate(-50%, -50%) scale(${o.scale}) rotate(${o.rotation}deg)`,
              zIndex: selectedOverlay === o.id ? 25 : 20,
            }}
            onTouchStart={(e) => handleOverlayTouchStart(o.id, e)}
            onMouseDown={(e) => handleOverlayMouseDown(o.id, e)}
            onClick={(e) => { e.stopPropagation(); setSelectedOverlay(o.id); }}
          >
            {o.type === "gif" ? (
              <img src={o.gifUrl} alt="GIF" className="max-w-[120px] rounded-lg pointer-events-none" />
            ) : (
              <span
                style={{
                  color: o.color || "#fff",
                  fontSize: `${o.fontSize || 24}px`,
                  fontFamily: o.fontFamily || "system-ui",
                  fontWeight: o.fontWeight || "bold",
                  fontStyle: o.fontStyle || "normal",
                  textAlign: (o.textAlign || "center") as any,
                  textShadow: o.textShadow ? "0 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.4)" : "none",
                  backgroundColor: o.textBackground || "transparent",
                  padding: o.textBackground ? "4px 10px" : "0",
                  borderRadius: o.textBackground ? "6px" : "0",
                  whiteSpace: o.type === "sticker" ? "nowrap" : "pre-wrap",
                  maxWidth: "250px",
                  display: "inline-block",
                }}
                className="pointer-events-none"
              >
                {o.content}
              </span>
            )}

            {/* Delete button when selected */}
            {selectedOverlay === o.id && (
              <button
                onClick={(e) => { e.stopPropagation(); removeOverlay(o.id); }}
                className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-red-500 flex items-center justify-center shadow-lg"
              >
                <X className="h-3.5 w-3.5 text-white" />
              </button>
            )}
          </div>
        ))}

        {/* Tags/Mentions at bottom */}
        {(hashtags.length > 0 || mentions.length > 0) && (
          <div className="absolute bottom-20 left-3 right-3 z-20 flex flex-wrap gap-1">
            {hashtags.map(t => (
              <span key={t} className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium">
                #{t}<button onClick={() => setHashtags(h => h.filter(x => x !== t))} className="ml-1">×</button>
              </span>
            ))}
            {mentions.map(m => (
              <span key={m} className="px-2 py-0.5 rounded-full bg-primary/40 backdrop-blur-sm text-white text-xs font-medium">
                @{m}<button onClick={() => setMentions(p => p.filter(x => x !== m))} className="ml-1">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* === Tool panels === */}

      {/* TEXT TOOL */}
      {activeTool === "text" && (
        <div className="absolute bottom-24 left-0 right-0 z-30 px-4 py-3 bg-black/90 backdrop-blur-md space-y-3 max-h-[50vh] overflow-y-auto">
          <Input
            value={textInput} onChange={e => setTextInput(e.target.value)}
            placeholder="Digite o texto..."
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
            autoFocus
            onKeyDown={e => { if (e.key === "Enter") addTextOverlay(); }}
          />

          {/* Font family */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {FONT_FAMILIES.map(f => (
              <button key={f.name} onClick={() => setTextFont(f.value)}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${textFont === f.value ? "bg-primary text-primary-foreground" : "bg-white/10 text-white"}`}
                style={{ fontFamily: f.value }}
              >{f.name}</button>
            ))}
          </div>

          {/* Style buttons */}
          <div className="flex items-center gap-2">
            <button onClick={() => setTextBold(!textBold)}
              className={`p-2 rounded ${textBold ? "bg-white/20" : ""}`}>
              <Bold className="h-4 w-4 text-white" />
            </button>
            <button onClick={() => setTextItalic(!textItalic)}
              className={`p-2 rounded ${textItalic ? "bg-white/20" : ""}`}>
              <Italic className="h-4 w-4 text-white" />
            </button>
            <button onClick={() => setTextShadow(!textShadow)}
              className={`p-2 rounded text-white text-xs ${textShadow ? "bg-white/20" : ""}`}>
              Sombra
            </button>
            <button onClick={() => setTextBg(textBg ? null : "rgba(0,0,0,0.6)")}
              className={`p-2 rounded text-white text-xs ${textBg ? "bg-white/20" : ""}`}>
              Fundo
            </button>
            <button onClick={() => setTextAlign(textAlign === "center" ? "left" : "center")} className="p-2 rounded">
              {textAlign === "center" ? <AlignCenter className="h-4 w-4 text-white" /> : <AlignLeft className="h-4 w-4 text-white" />}
            </button>
          </div>

          {/* Colors */}
          <div className="flex items-center gap-1.5">
            <span className="text-white/50 text-xs mr-1">Cor:</span>
            {TEXT_COLORS.map(c => (
              <button key={c} onClick={() => setTextColor(c)}
                className={`h-6 w-6 rounded-full border-2 ${textColor === c ? "border-white scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>

          {/* Size */}
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-xs">Tam:</span>
            <input type="range" min={12} max={64} value={textSize} onChange={e => setTextSize(Number(e.target.value))} className="flex-1" />
            <span className="text-white text-xs w-6">{textSize}</span>
          </div>

          <Button onClick={addTextOverlay} size="sm" className="w-full gradient-primary text-primary-foreground">
            Adicionar texto
          </Button>
        </div>
      )}

      {/* EMOJI TOOL */}
      {activeTool === "emoji" && (
        <div className="absolute bottom-24 left-0 right-0 z-30 px-4 py-3 bg-black/90 backdrop-blur-md">
          <p className="text-white/50 text-xs mb-2">Toque para adicionar:</p>
          <div className="grid grid-cols-10 gap-2">
            {EMOJI_LIST.map(e => (
              <button key={e} onClick={() => addEmojiOverlay(e)} className="text-2xl hover:scale-125 active:scale-90 transition-transform">{e}</button>
            ))}
          </div>
        </div>
      )}

      {/* STICKER TOOL */}
      {activeTool === "sticker" && (
        <div className="absolute bottom-24 left-0 right-0 z-30 px-4 py-3 bg-black/90 backdrop-blur-md">
          <p className="text-white/50 text-xs mb-2">Stickers fitness:</p>
          <div className="grid grid-cols-3 gap-2">
            {STICKERS.map(s => (
              <button key={s} onClick={() => addStickerOverlay(s)}
                className="bg-white/10 rounded-lg px-3 py-2 text-white text-xs font-bold hover:bg-white/20 active:scale-95 transition-all">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* GIF TOOL */}
      {activeTool === "gif" && (
        <div className="absolute bottom-24 left-0 right-0 z-30 px-4 py-3 bg-black/90 backdrop-blur-md max-h-[50vh] overflow-y-auto">
          <div className="flex gap-2 mb-3">
            <Input value={gifQuery} onChange={e => setGifQuery(e.target.value)}
              placeholder="Buscar GIFs..."
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              onKeyDown={e => { if (e.key === "Enter") searchGifs(gifQuery); }}
            />
            <Button onClick={() => searchGifs(gifQuery)} size="sm" variant="outline" className="border-white/20 text-white">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {gifLoading ? (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {gifResults.map((gif: any) => {
                const preview = gif.media_formats?.tinygif?.url;
                return preview ? (
                  <button key={gif.id} onClick={() => addGifOverlay(gif)}
                    className="rounded-lg overflow-hidden hover:ring-2 ring-primary active:scale-95 transition-all">
                    <img src={preview} alt="" className="w-full h-20 object-cover" loading="lazy" />
                  </button>
                ) : null;
              })}
            </div>
          )}
          <p className="text-white/30 text-[9px] text-center mt-2">Powered by Tenor</p>
        </div>
      )}

      {/* MENTION */}
      {activeTool === "mention" && (
        <div className="absolute bottom-24 left-0 right-0 z-30 px-4 py-3 bg-black/90 backdrop-blur-md space-y-2">
          <div className="flex gap-2">
            <Input value={mentionInput} onChange={e => setMentionInput(e.target.value.replace(/\s/g, ""))}
              placeholder="@usuario" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" autoFocus
              onKeyDown={e => { if (e.key === "Enter") addMention(); }} />
            <Button onClick={addMention} size="sm" variant="outline" className="border-white/20 text-white">+</Button>
          </div>
        </div>
      )}

      {/* HASHTAG */}
      {activeTool === "hashtag" && (
        <div className="absolute bottom-24 left-0 right-0 z-30 px-4 py-3 bg-black/90 backdrop-blur-md space-y-2">
          <div className="flex gap-2">
            <Input value={hashtagInput} onChange={e => setHashtagInput(e.target.value.replace(/\s/g, ""))}
              placeholder="#hashtag" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" autoFocus
              onKeyDown={e => { if (e.key === "Enter") addHashtag(); }} />
            <Button onClick={addHashtag} size="sm" variant="outline" className="border-white/20 text-white">+</Button>
          </div>
        </div>
      )}

      {/* LINK */}
      {activeTool === "link" && (
        <div className="absolute bottom-24 left-0 right-0 z-30 px-4 py-3 bg-black/90 backdrop-blur-md space-y-2">
          <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
            placeholder="https://..." className="bg-white/10 border-white/20 text-white placeholder:text-white/50" autoFocus />
          <Button onClick={() => setActiveTool(null)} size="sm" className="w-full gradient-primary text-primary-foreground">Confirmar</Button>
        </div>
      )}

      {/* TRIM */}
      {activeTool === "trim" && mediaType === "video" && (
        <div className="absolute bottom-24 left-0 right-0 z-30 px-4 py-3 bg-black/90 backdrop-blur-md space-y-2">
          <p className="text-white/50 text-xs">Cortar vídeo (máx 45s)</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-white/50 text-[10px]">Início: {trimStart.toFixed(1)}s</label>
              <input type="range" min={0} max={Math.max(0, videoDuration - 1)} step={0.1} value={trimStart}
                onChange={e => { const v = Number(e.target.value); setTrimStart(v); if (trimEnd - v > 45) setTrimEnd(v + 45); }} className="w-full" />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-white/50 text-[10px]">Fim: {trimEnd.toFixed(1)}s</label>
              <input type="range" min={trimStart + 1} max={Math.min(videoDuration, trimStart + 45)} step={0.1} value={trimEnd}
                onChange={e => setTrimEnd(Number(e.target.value))} className="w-full" />
            </div>
          </div>
          <p className="text-white text-xs text-center">Duração: {(trimEnd - trimStart).toFixed(1)}s</p>
        </div>
      )}

      {/* TIMELINE */}
      {activeTool === "timeline" && mediaType === "video" && (
        <div className="absolute bottom-24 left-0 right-0 z-30 px-4 py-3 bg-black/90 backdrop-blur-md space-y-3 max-h-[40vh] overflow-y-auto">
          <p className="text-white/50 text-xs">Defina quando cada elemento aparece/desaparece:</p>
          {overlays.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-2">Nenhum elemento adicionado ainda</p>
          ) : (
            overlays.map(o => (
              <div key={o.id} className="bg-white/5 rounded-lg p-2 space-y-1">
                <p className="text-white text-xs font-medium truncate">
                  {o.type === "gif" ? "🖼 GIF" : o.content.slice(0, 30)}
                </p>
                <div className="flex items-center gap-2">
                  <label className="text-white/40 text-[10px] w-12">Início:</label>
                  <input type="range" min={0} max={videoDuration} step={0.1}
                    value={o.showAt || 0}
                    onChange={e => updateOverlay(o.id, { showAt: Number(e.target.value) })}
                    className="flex-1" />
                  <span className="text-white/60 text-[10px] w-8">{(o.showAt || 0).toFixed(1)}s</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-white/40 text-[10px] w-12">Fim:</label>
                  <input type="range" min={0} max={videoDuration} step={0.1}
                    value={o.hideAt || videoDuration}
                    onChange={e => updateOverlay(o.id, { hideAt: Number(e.target.value) })}
                    className="flex-1" />
                  <span className="text-white/60 text-[10px] w-8">{(o.hideAt || videoDuration).toFixed(1)}s</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Selected overlay controls */}
      {selectedOv && activeTool === null && (
        <div className="absolute bottom-24 left-0 right-0 z-30 px-4 py-2 bg-black/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <p className="text-white/60 text-xs">Arraste para mover • Pinch para redimensionar/rotacionar</p>
            <button onClick={() => removeOverlay(selectedOv.id)} className="p-1.5 bg-red-500/80 rounded-full">
              <Trash2 className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom action bar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-gradient-to-t from-black/90 to-transparent">
        <Button onClick={onDiscard} variant="ghost" size="sm" className="text-white/70 hover:text-white">
          <Trash2 className="h-4 w-4 mr-1" /> Descartar
        </Button>
        <Button onClick={handleSaveDraft} variant="ghost" size="sm" className="text-white/70 hover:text-white">
          <Save className="h-4 w-4 mr-1" /> Rascunho
        </Button>
        <Button onClick={handlePublish} size="sm" className="gradient-primary text-primary-foreground px-6">
          <Send className="h-4 w-4 mr-1" /> Publicar
        </Button>
      </div>
    </div>,
    document.body
  );
};

export default MoveEditor;
