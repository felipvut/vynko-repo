import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useChallenges, CHALLENGE_TYPES, MEASUREMENT_TYPES, PROOF_FREQUENCIES, PENALTY_TYPES, BODY_MEASUREMENT_OPTIONS, type Challenge, type ChallengeProof, type ChallengeMeasurement, type JoinRequest } from "@/hooks/useChallenges";
import { useGamification, xpProgress } from "@/hooks/useGamification";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Trophy, Plus, ArrowLeft, Users, Calendar, Target,
  Medal, Crown, Flame, LogIn, LogOut as LogOutIcon, Loader2,
  Search, Filter, X, Star, Zap, Dumbbell, Lock, Edit3, CheckCircle2,
  Camera, Image, Check, XCircle, Clock, Eye, AlertTriangle, Ruler,
  Layers, Trash2, Globe, DollarSign, UserCheck, UserX, Shield, Share2
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import BottomNav from "@/components/BottomNav";
import NotificationBell from "@/components/NotificationBell";
import ShareChallengeSheet from "@/components/challenge/ShareChallengeSheet";
import { format, isPast, isFuture, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const ICON_MAP: Record<string, any> = {
  dumbbell: Dumbbell, flame: Flame, trophy: Trophy, crown: Crown,
  zap: Zap, target: Target, medal: Medal, star: Star,
};

const Challenges = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { challenges, loading, createChallenge, joinChallenge, leaveChallenge, updateParticipantProgress, closeChallenge, fetchProofs, submitProof, reviewProof, fetchChallengeMeasurements, submitChallengeMeasurement, addStage, deleteStage, requestToJoin, reviewJoinRequest, requestPaidJoin } = useChallenges();
  const { userXp, badges, earnedBadges, leaderboard, loading: gamifLoading } = useGamification();
  const earnedIds = new Set(earnedBadges.map((b) => b.badge_id));
  const progressPct = userXp ? xpProgress(userXp.total_xp, userXp.level) : 0;

  const [myProfile, setMyProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const myRank = useMemo(() => {
    if (!user) return 0;
    const idx = leaderboard.findIndex(e => e.user_id === user.id);
    return idx >= 0 ? idx + 1 : 0;
  }, [leaderboard, user]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, avatar_url").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setMyProfile(data); });
  }, [user]);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    challenge_type: "workout_count",
    goal_value: 10,
    start_date: "",
    end_date: "",
    measurement_type: "automatic",
    proof_frequency: "none",
    penalty_type: "none",
    penalty_points: 0,
    allowed_measurements: [] as string[],
    rules_details: "",
    visibility: "public",
    entry_fee: 0,
  });

  // Stages form
  const [formStages, setFormStages] = useState<{ name: string; description: string; start_date: string; end_date: string; goal_value: number }[]>([]);

  // Admin edit progress
  const [editingProgress, setEditingProgress] = useState<{ participantId: string; userId: string; value: number } | null>(null);

  // Proofs state
  const [proofs, setProofs] = useState<ChallengeProof[]>([]);
  const [proofsLoading, setProofsLoading] = useState(false);
  const [showProofUpload, setShowProofUpload] = useState(false);
  const [proofCaption, setProofCaption] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofFilter, setProofFilter] = useState<string>("all");
  const [rejectingProofId, setRejectingProofId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Measurements state
  const [challengeMeasurements, setChallengeMeasurements] = useState<ChallengeMeasurement[]>([]);
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [measurementForm, setMeasurementForm] = useState({ type: "", value: 0, notes: "", stageId: "" });
  const [measurementFile, setMeasurementFile] = useState<File | null>(null);
  const [measurementPreview, setMeasurementPreview] = useState<string | null>(null);
  const [submittingMeasurement, setSubmittingMeasurement] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Deep link: open challenge from URL ?id=xxx
  useEffect(() => {
    if (!loading && challenges.length > 0) {
      const linkId = searchParams.get("id");
      if (linkId && !selectedChallenge) {
        const found = challenges.find(c => c.id === linkId);
        if (found) setSelectedChallenge(found);
      }
    }
  }, [loading, challenges, searchParams]);
  const handleCreate = async () => {
    if (!form.title || !form.end_date) {
      toast.error("Título e data de término são obrigatórios");
      return;
    }
    await createChallenge({
      ...form,
      start_date: form.start_date || undefined,
      rules_details: form.rules_details || undefined,
      stages: formStages.length > 0 ? formStages : undefined,
    });
    setShowCreate(false);
    setFormStages([]);
    setForm({ title: "", description: "", challenge_type: "workout_count", goal_value: 10, start_date: "", end_date: "", measurement_type: "automatic", proof_frequency: "none", penalty_type: "none", penalty_points: 0, allowed_measurements: [], rules_details: "", visibility: "public", entry_fee: 0 });
  };

  const isParticipant = (c: Challenge) => c.participants?.some((p) => p.user_id === user?.id);
  const isCreator = (c: Challenge) => c.created_by === user?.id;

  const getStatus = (c: Challenge) => {
    if (c.status === "closed") return "closed";
    if (isFuture(parseISO(c.start_date))) return "upcoming";
    if (isPast(parseISO(c.end_date))) return "expired";
    return "active";
  };

  const statusLabel: Record<string, string> = { upcoming: "Em breve", active: "Ativo", expired: "Expirado", closed: "Encerrado" };
  const statusColor: Record<string, string> = {
    upcoming: "bg-info/20 text-info",
    active: "bg-primary/20 text-primary",
    expired: "bg-warning/20 text-warning",
    closed: "bg-muted text-muted-foreground",
  };

  const myCreated = useMemo(() => challenges.filter(c => isCreator(c)), [challenges, user]);
  const myParticipating = useMemo(() => challenges.filter(c => !isCreator(c) && isParticipant(c)), [challenges, user]);

  const filteredChallenges = useMemo(() => {
    let result = challenges;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.creator_name?.toLowerCase().includes(q)
      );
    }
    if (filterType !== "all") {
      result = result.filter(c => c.challenge_type === filterType);
    }
    if (filterStatus !== "all") {
      result = result.filter(c => getStatus(c) === filterStatus);
    }
    return result;
  }, [challenges, searchQuery, filterType, filterStatus]);

  const ChallengeCard = ({ c, i }: { c: Challenge; i: number }) => {
    const status = getStatus(c);
    const participating = isParticipant(c);
    return (
      <motion.button
        key={c.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.04 }}
        onClick={() => setSelectedChallenge(c)}
        className="glass-card p-4 w-full text-left space-y-2 hover:border-primary/50 transition-colors"
      >
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-sm">{c.title}</h3>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 ${statusColor[status]}`}>
            {statusLabel[status]}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(parseISO(c.start_date), "dd/MM/yy")} — {format(parseISO(c.end_date), "dd/MM/yy")}</span>
          <span className="flex items-center gap-1"><Target className="h-3 w-3" /> {c.goal_value}</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.participants?.length || 0}</span>
          {c.visibility === "private" && (
            <span className="flex items-center gap-1 text-warning"><Lock className="h-3 w-3" /> Privado</span>
          )}
          {c.entry_fee > 0 && (
            <span className="flex items-center gap-1 text-primary"><DollarSign className="h-3 w-3" /> R${c.entry_fee}</span>
          )}
          {participating && <span className="text-primary font-semibold">Participando</span>}
        </div>
      </motion.button>
    );
  };

  const EmptyState = ({ message }: { message: string }) => (
    <div className="text-center py-12 space-y-2">
      <Flame className="h-8 w-8 text-muted-foreground mx-auto" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );

  const UserStatusBar = () => (
    <div className="fixed top-14 left-0 right-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur-xl">
      <div className="container max-w-lg mx-auto flex items-center gap-3 py-2.5 px-4">
        <Avatar className="h-9 w-9 ring-2 ring-primary/30">
          <AvatarImage src={myProfile?.avatar_url || ""} />
          <AvatarFallback className="text-xs bg-primary/20 text-primary">
            {(myProfile?.full_name || "?")[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{myProfile?.full_name || "Você"}</p>
          <div className="flex items-center gap-1">
            <Progress value={progressPct} className="h-1.5 flex-1 max-w-[80px]" />
            <span className="text-[10px] text-muted-foreground">Nv {userXp?.level || 1}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-center">
          <div>
            <p className="text-sm font-bold text-primary">{userXp?.total_xp || 0}</p>
            <p className="text-[9px] text-muted-foreground">XP</p>
          </div>
          <div>
            <p className="text-sm font-bold">{myRank > 0 ? `${myRank}º` : "—"}</p>
            <p className="text-[9px] text-muted-foreground">Posição</p>
          </div>
          <div>
            <p className="text-sm font-bold flex items-center gap-0.5"><Flame className="h-3 w-3 text-destructive" />{userXp?.current_streak || 0}</p>
            <p className="text-[9px] text-muted-foreground">Streak</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Load proofs and measurements when selecting a challenge
  const loadProofs = useCallback(async (challengeId: string) => {
    setProofsLoading(true);
    const data = await fetchProofs(challengeId);
    setProofs(data);
    setProofsLoading(false);
  }, [fetchProofs]);

  const loadMeasurements = useCallback(async (challengeId: string) => {
    const data = await fetchChallengeMeasurements(challengeId);
    setChallengeMeasurements(data);
  }, [fetchChallengeMeasurements]);

  useEffect(() => {
    if (selectedChallenge) {
      loadProofs(selectedChallenge.id);
      if (selectedChallenge.allowed_measurements?.length > 0) {
        loadMeasurements(selectedChallenge.id);
      }
    }
  }, [selectedChallenge?.id]);

  const handleSubmitProof = async () => {
    if (!selectedChallenge || !proofFile) return;
    setSubmittingProof(true);
    await submitProof(selectedChallenge.id, proofFile, proofCaption);
    setProofFile(null);
    setProofPreview(null);
    setProofCaption("");
    setShowProofUpload(false);
    setSubmittingProof(false);
    loadProofs(selectedChallenge.id);
  };

  const handleReviewProof = async (proofId: string, approved: boolean) => {
    if (!selectedChallenge) return;
    await reviewProof(proofId, approved, approved ? undefined : rejectionReason);
    setRejectingProofId(null);
    setRejectionReason("");
    loadProofs(selectedChallenge.id);
  };

  const handleSubmitMeasurement = async () => {
    if (!selectedChallenge || !measurementForm.type || !measurementForm.value) return;
    setSubmittingMeasurement(true);
    await submitChallengeMeasurement(
      selectedChallenge.id, measurementForm.type, measurementForm.value,
      measurementFile || undefined, measurementForm.stageId || undefined, measurementForm.notes || undefined
    );
    setMeasurementForm({ type: "", value: 0, notes: "", stageId: "" });
    setMeasurementFile(null);
    setMeasurementPreview(null);
    setShowMeasurementForm(false);
    setSubmittingMeasurement(false);
    loadMeasurements(selectedChallenge.id);
  };

  const filteredProofs = proofFilter === "all" ? proofs : proofs.filter(p => p.status === proofFilter);

  // Detail view
  if (selectedChallenge) {
    const c = challenges.find((ch) => ch.id === selectedChallenge.id) || selectedChallenge;
    const status = getStatus(c);
    const myParticipation = c.participants?.find((p) => p.user_id === user?.id);
    const progressPct = myParticipation ? Math.min((myParticipation.progress / c.goal_value) * 100, 100) : 0;
    const isAdmin = isCreator(c);
    const canEditProgress = isAdmin && (c.measurement_type === "manual" || c.measurement_type === "mixed");
    const hasProofRequirement = c.proof_frequency && c.proof_frequency !== "none";

    return (
      <div className="min-h-screen pb-8">
         <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="container flex items-center h-14 gap-3">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedChallenge(null); setEditingProgress(null); setProofs([]); setShowProofUpload(false); setProofFile(null); setProofPreview(null); }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-display font-bold text-lg truncate flex-1">{c.title}</span>
            <Button variant="ghost" size="icon" onClick={() => setShowShare(true)}>
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <ShareChallengeSheet open={showShare} onOpenChange={setShowShare} challengeId={c.id} challengeTitle={c.title} />

        <UserStatusBar />

        <div className="container max-w-lg mx-auto mt-4 pt-16 space-y-6 px-4">
          {/* Info card */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[status]}`}>
                {statusLabel[status]}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(parseISO(c.start_date), "dd MMM", { locale: ptBR })} — {format(parseISO(c.end_date), "dd MMM yyyy", { locale: ptBR })}
              </span>
            </div>
            {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <span className="flex items-center gap-1"><Target className="h-4 w-4 text-primary" /> Meta: {c.goal_value} {CHALLENGE_TYPES[c.challenge_type]?.toLowerCase()}</span>
              <span className="flex items-center gap-1"><Users className="h-4 w-4 text-primary" /> {c.participants?.length || 0}</span>
              {c.visibility === "private" && (
                <span className="flex items-center gap-1 text-warning text-xs"><Lock className="h-3 w-3" /> Privado</span>
              )}
              {c.entry_fee > 0 && (
                <span className="flex items-center gap-1 text-primary text-xs"><DollarSign className="h-3 w-3" /> R$ {c.entry_fee.toFixed(2)}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span>Criado por {c.creator_name}</span>
              <span>•</span>
              <span>{MEASUREMENT_TYPES[c.measurement_type] || "Automático"}</span>
              {hasProofRequirement && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Camera className="h-3 w-3" /> {PROOF_FREQUENCIES[c.proof_frequency]}</span>
                </>
              )}
            </div>
          </div>

          {/* Rules & penalty */}
          {(c.penalty_type !== "none" || (c as any).rules_details) && (
            <div className="glass-card p-4 space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> Regras</h3>
              {c.penalty_type !== "none" && (
                <p className="text-xs text-muted-foreground">
                  {c.penalty_type === "elimination"
                    ? "Quem não cumprir as regras será eliminado do desafio."
                    : `Quem não cumprir perde ${c.penalty_points} pontos do progresso.`}
                </p>
              )}
              {(c as any).rules_details && (
                <div className="text-xs text-muted-foreground whitespace-pre-wrap mt-2 p-3 rounded-lg bg-secondary/20 leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: (c as any).rules_details
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>')
                      .replace(/^- (.+)$/gm, '• $1')
                  }}
                />
              )}
            </div>
          )}

          {/* Stages */}
          {c.stages && c.stages.length > 0 && (
            <div className="glass-card p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Etapas</h3>
              <div className="space-y-2">
                {c.stages.map((stage, idx) => {
                  const stageActive = !isPast(parseISO(stage.end_date)) && !isFuture(parseISO(stage.start_date));
                  const stageDone = isPast(parseISO(stage.end_date));
                  return (
                    <div key={stage.id} className={`p-3 rounded-lg border ${stageActive ? "border-primary/40 bg-primary/5" : stageDone ? "border-border/30 bg-muted/30" : "border-border/20 bg-secondary/20"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${stageActive ? "bg-primary text-primary-foreground" : stageDone ? "bg-muted-foreground text-background" : "bg-secondary text-muted-foreground"}`}>
                            {idx + 1}
                          </span>
                          <span className="text-sm font-semibold">{stage.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {stageActive && <span className="text-primary font-semibold">Em andamento</span>}
                          {stageDone && <span>Concluída</span>}
                          {!stageActive && !stageDone && <span>Em breve</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span>{format(parseISO(stage.start_date), "dd/MM")} — {format(parseISO(stage.end_date), "dd/MM")}</span>
                        {stage.goal_value > 0 && <span>Meta: {stage.goal_value}</span>}
                      </div>
                      {stage.description && <p className="text-[10px] text-muted-foreground mt-1">{stage.description}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Body measurements - for participants */}
          {c.allowed_measurements?.length > 0 && myParticipation && status !== "closed" && (
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2"><Ruler className="h-4 w-4 text-primary" /> Medidas Corporais</h3>
                <Button size="sm" variant="outline" onClick={() => setShowMeasurementForm(!showMeasurementForm)}>
                  <Plus className="h-3 w-3 mr-1" /> Registrar
                </Button>
              </div>

              {showMeasurementForm && (
                <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
                  <Select value={measurementForm.type} onValueChange={(v) => setMeasurementForm((f) => ({ ...f, type: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo de medida" /></SelectTrigger>
                    <SelectContent>
                      {c.allowed_measurements.map((k) => (
                        <SelectItem key={k} value={k}>{BODY_MEASUREMENT_OPTIONS[k] || k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" step="0.1" placeholder="Valor" value={measurementForm.value || ""} onChange={(e) => setMeasurementForm((f) => ({ ...f, value: Number(e.target.value) }))} className="h-8 text-xs" />
                  {c.stages && c.stages.length > 0 && (
                    <Select value={measurementForm.stageId} onValueChange={(v) => setMeasurementForm((f) => ({ ...f, stageId: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Etapa (opcional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhuma</SelectItem>
                        {c.stages.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <label className="block cursor-pointer">
                    <div className={`border-2 border-dashed rounded-lg p-3 text-center text-xs ${measurementPreview ? 'border-primary/50' : 'border-border hover:border-primary/30'}`}>
                      {measurementPreview ? (
                        <img src={measurementPreview} alt="" className="w-full max-h-32 object-cover rounded" />
                      ) : (
                        <span className="text-muted-foreground">📸 Foto de comprovação (opcional)</span>
                      )}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setMeasurementFile(file); setMeasurementPreview(URL.createObjectURL(file)); }
                    }} />
                  </label>
                  <Input placeholder="Observações (opcional)" value={measurementForm.notes} onChange={(e) => setMeasurementForm((f) => ({ ...f, notes: e.target.value }))} className="h-8 text-xs" />
                  <Button className="w-full h-8 text-xs" disabled={!measurementForm.type || !measurementForm.value || submittingMeasurement} onClick={handleSubmitMeasurement}>
                    {submittingMeasurement ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Ruler className="h-3 w-3 mr-1" />}
                    Registrar Medida
                  </Button>
                </div>
              )}

              {/* My measurements */}
              {challengeMeasurements.filter(m => m.user_id === user?.id).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Seu histórico:</p>
                  {challengeMeasurements.filter(m => m.user_id === user?.id).map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/20 text-xs">
                      {m.image_url && <img src={m.image_url} alt="" className="h-10 w-10 rounded object-cover" />}
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold">{BODY_MEASUREMENT_OPTIONS[m.measurement_type] || m.measurement_type}</span>
                        <span className="ml-2 text-primary font-mono">{m.value}</span>
                        {m.notes && <p className="text-[10px] text-muted-foreground truncate">{m.notes}</p>}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{format(parseISO(m.recorded_at), "dd/MM HH:mm")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* All measurements - for admin */}
          {c.allowed_measurements?.length > 0 && isAdmin && challengeMeasurements.length > 0 && (
            <div className="glass-card p-4 space-y-3 border-accent/30">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Eye className="h-4 w-4 text-accent" /> Medidas dos Participantes</h3>
              <div className="space-y-2">
                {challengeMeasurements.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/20 text-xs">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={m.avatar_url || ""} />
                      <AvatarFallback className="text-[10px]">{(m.profile_name || "?")[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-semibold">{m.profile_name}</span>
                    {m.image_url && <img src={m.image_url} alt="" className="h-8 w-8 rounded object-cover" />}
                    <span className="text-muted-foreground">{BODY_MEASUREMENT_OPTIONS[m.measurement_type] || m.measurement_type}:</span>
                    <span className="text-primary font-mono font-semibold">{m.value}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{format(parseISO(m.recorded_at), "dd/MM")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results for closed challenges */}
          {status === "closed" && c.results && c.results.length > 0 && (
            <div className="glass-card p-5 space-y-3 border-primary/30">
              <h3 className="font-semibold flex items-center gap-2 text-primary"><Trophy className="h-5 w-5" /> Resultado Final</h3>
              <div className="space-y-2">
                {c.results.map((r) => (
                  <div key={r.id} className={`flex items-center gap-3 p-3 rounded-lg ${r.final_rank <= 3 ? "bg-primary/10 border border-primary/20" : "bg-secondary/30"}`}>
                    <span className="w-7 text-center font-bold text-sm">
                      {r.final_rank === 1 ? <Crown className="h-5 w-5 text-warning mx-auto" /> :
                       r.final_rank === 2 ? <Medal className="h-5 w-5 text-muted-foreground mx-auto" /> :
                       r.final_rank === 3 ? <Medal className="h-5 w-5 text-accent mx-auto" /> :
                       `${r.final_rank}º`}
                    </span>
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={r.avatar_url || ""} />
                      <AvatarFallback className="text-xs">{(r.profile_name || "?")[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{r.profile_name}</p>
                      <p className="text-[10px] text-muted-foreground">Progresso: {r.final_progress}</p>
                    </div>
                    <span className="text-xs font-semibold text-primary">+{r.xp_awarded} XP</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* My progress */}
          {myParticipation && status !== "closed" && (
            <div className="glass-card p-5 space-y-3">
              <h3 className="font-semibold text-sm">Seu progresso</h3>
              <Progress value={progressPct} className="h-3" />
              <div className="flex items-center justify-between text-sm">
                <span>{myParticipation.progress} / {c.goal_value}</span>
                <span className="text-xs text-muted-foreground">
                  {c.measurement_type === "manual" ? "Atualizado pelo admin" : "Atualizado automaticamente"}
                </span>
              </div>
            </div>
          )}

          {/* Proof submission - for participants */}
          {hasProofRequirement && myParticipation && status !== "closed" && (
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> Comprovação por Foto</h3>
                <Button size="sm" variant="outline" onClick={() => setShowProofUpload(!showProofUpload)}>
                  <Plus className="h-3 w-3 mr-1" /> Enviar
                </Button>
              </div>

              {showProofUpload && (
                <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <label className="flex-1 cursor-pointer">
                      <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${proofPreview ? 'border-primary/50' : 'border-border hover:border-primary/30'}`}>
                        {proofPreview ? (
                          <img src={proofPreview} alt="Preview" className="w-full max-h-48 object-cover rounded" />
                        ) : (
                          <div className="space-y-1">
                            <Image className="h-8 w-8 mx-auto text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">Toque para selecionar foto</p>
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setProofFile(file);
                            setProofPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </label>
                  </div>
                  <Input
                    placeholder="Legenda (opcional)"
                    value={proofCaption}
                    onChange={(e) => setProofCaption(e.target.value)}
                  />
                  <Button
                    className="w-full"
                    disabled={!proofFile || submittingProof}
                    onClick={handleSubmitProof}
                  >
                    {submittingProof ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Camera className="h-4 w-4 mr-2" />}
                    Enviar Comprovação
                  </Button>
                </div>
              )}

              {/* My proofs */}
              {proofs.filter(p => p.user_id === user?.id).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Suas comprovações:</p>
                  {proofs.filter(p => p.user_id === user?.id).map(proof => (
                    <div key={proof.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/20">
                      <img src={proof.image_url} alt="" className="h-12 w-12 rounded object-cover" />
                      <div className="flex-1 min-w-0">
                        {proof.caption && <p className="text-xs truncate">{proof.caption}</p>}
                        <p className="text-[10px] text-muted-foreground">{format(parseISO(proof.created_at), "dd/MM HH:mm")}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        proof.status === "approved" ? "bg-primary/20 text-primary" :
                        proof.status === "rejected" ? "bg-destructive/20 text-destructive" :
                        "bg-warning/20 text-warning"
                      }`}>
                        {proof.status === "approved" ? "Aprovada" : proof.status === "rejected" ? "Rejeitada" : "Pendente"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Proof review - for admins */}
          {hasProofRequirement && isAdmin && proofs.length > 0 && (
            <div className="glass-card p-5 space-y-3 border-accent/30">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2"><Eye className="h-4 w-4 text-accent" /> Avaliar Comprovações</h3>
                <span className="text-xs text-muted-foreground">
                  {proofs.filter(p => p.status === "pending").length} pendentes
                </span>
              </div>

              <div className="flex gap-1">
                {["all", "pending", "approved", "rejected"].map(f => (
                  <Button
                    key={f}
                    size="sm"
                    variant={proofFilter === f ? "default" : "outline"}
                    className="text-xs h-7 px-2"
                    onClick={() => setProofFilter(f)}
                  >
                    {f === "all" ? "Todas" : f === "pending" ? "Pendentes" : f === "approved" ? "Aprovadas" : "Rejeitadas"}
                  </Button>
                ))}
              </div>

              {proofsLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <div className="space-y-3">
                  {filteredProofs.map(proof => (
                    <div key={proof.id} className="p-3 rounded-lg bg-secondary/20 space-y-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={proof.avatar_url || ""} />
                          <AvatarFallback className="text-[10px]">{(proof.profile_name || "?")[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-semibold flex-1">{proof.profile_name}</span>
                        <span className="text-[10px] text-muted-foreground">{format(parseISO(proof.created_at), "dd/MM HH:mm")}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          proof.status === "approved" ? "bg-primary/20 text-primary" :
                          proof.status === "rejected" ? "bg-destructive/20 text-destructive" :
                          "bg-warning/20 text-warning"
                        }`}>
                          {proof.status === "approved" ? "Aprovada" : proof.status === "rejected" ? "Rejeitada" : "Pendente"}
                        </span>
                      </div>
                      <img src={proof.image_url} alt="" className="w-full max-h-64 object-cover rounded-lg" />
                      {proof.caption && <p className="text-xs text-muted-foreground">{proof.caption}</p>}
                      {proof.rejection_reason && (
                        <p className="text-xs text-destructive">Motivo: {proof.rejection_reason}</p>
                      )}

                      {proof.status === "pending" && (
                        <>
                          {rejectingProofId === proof.id ? (
                            <div className="space-y-2">
                              <Input
                                placeholder="Motivo da rejeição (opcional)"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="h-8 text-xs"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" variant="destructive" className="flex-1 h-7 text-xs" onClick={() => handleReviewProof(proof.id, false)}>
                                  <XCircle className="h-3 w-3 mr-1" /> Rejeitar
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setRejectingProofId(null); setRejectionReason(""); }}>
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => handleReviewProof(proof.id, true)}>
                                <Check className="h-3 w-3 mr-1" /> Aprovar
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setRejectingProofId(proof.id)}>
                                <XCircle className="h-3 w-3 mr-1" /> Rejeitar
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isAdmin && status !== "closed" && (
            <div className="glass-card p-5 space-y-3 border-accent/30">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Lock className="h-4 w-4 text-accent" /> Administração</h3>
              
              {/* Join requests for private challenges */}
              {c.visibility === "private" && c.join_requests && c.join_requests.filter(jr => jr.status === "pending").length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold flex items-center gap-1">
                    <Users className="h-3 w-3" /> Solicitações pendentes ({c.join_requests.filter(jr => jr.status === "pending").length})
                  </p>
                  {c.join_requests.filter(jr => jr.status === "pending").map(jr => (
                    <div key={jr.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/20">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={jr.avatar_url || ""} />
                        <AvatarFallback className="text-[10px]">{(jr.profile_name || "?")[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1 truncate">{jr.profile_name}</span>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-primary" onClick={() => reviewJoinRequest(jr.id, true)}>
                          <UserCheck className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => reviewJoinRequest(jr.id, false)}>
                          <UserX className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(status === "expired" || status === "active") && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    if (confirm("Encerrar desafio e publicar resultados?")) {
                      closeChallenge(c.id);
                    }
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Encerrar e Publicar Resultados
                </Button>
              )}
            </div>
          )}

          {/* Join/leave */}
          {status !== "closed" && status !== "expired" && (
            <div>
              {isParticipant(c) ? (
                <Button variant="outline" className="w-full" onClick={() => leaveChallenge(c.id)}>
                  <LogOutIcon className="h-4 w-4 mr-2" /> Sair do desafio
                </Button>
              ) : c.visibility === "private" ? (
                (() => {
                  const myRequest = c.join_requests?.find(jr => jr.user_id === user?.id);
                  if (myRequest) {
                    return (
                      <div className="glass-card p-3 text-center space-y-1">
                        <p className="text-sm font-semibold">
                          {myRequest.status === "pending" ? "⏳ Solicitação pendente" :
                           myRequest.status === "rejected" ? "❌ Solicitação rejeitada" :
                           "✅ Aprovado"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {myRequest.status === "pending" ? "Aguardando aprovação do organizador." :
                           myRequest.status === "rejected" ? "O organizador rejeitou sua participação." : ""}
                        </p>
                      </div>
                    );
                  }
                  return c.entry_fee > 0 ? (
                    <Button className="w-full gradient-primary text-primary-foreground" onClick={() => requestPaidJoin(c.id)}>
                      <DollarSign className="h-4 w-4 mr-2" /> Participar (R$ {c.entry_fee.toFixed(2)})
                    </Button>
                  ) : (
                    <Button className="w-full gradient-primary text-primary-foreground" onClick={() => requestToJoin(c.id)}>
                      <Lock className="h-4 w-4 mr-2" /> Solicitar participação
                    </Button>
                  );
                })()
              ) : (
                <Button className="w-full gradient-primary text-primary-foreground" onClick={() => joinChallenge(c.id)}>
                  <LogIn className="h-4 w-4 mr-2" /> Participar
                </Button>
              )}
            </div>
          )}

          {/* Ranking */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Medal className="h-4 w-4 text-primary" /> Ranking</h3>
            {(!c.participants || c.participants.length === 0) ? (
              <p className="text-sm text-muted-foreground">Nenhum participante ainda.</p>
            ) : (
              <div className="space-y-2">
                {c.participants.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
                    <span className="w-6 text-center font-bold text-sm">
                      {i === 0 ? <Crown className="h-4 w-4 text-warning mx-auto" /> : `${i + 1}º`}
                    </span>
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={p.avatar_url || ""} />
                      <AvatarFallback className="text-xs">{(p.profile_name || "?")[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm flex-1 truncate">{p.profile_name}</span>
                    {canEditProgress && editingProgress?.participantId === p.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          className="w-16 h-7 text-xs"
                          value={editingProgress.value}
                          onChange={(e) => setEditingProgress({ ...editingProgress, value: Number(e.target.value) })}
                          min={0}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => {
                            updateParticipantProgress(c.id, editingProgress.userId, editingProgress.value);
                            setEditingProgress(null);
                          }}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingProgress(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-mono font-semibold text-primary">{p.progress}</span>
                        {canEditProgress && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProgress({ participantId: p.id, userId: p.user_id, value: p.progress });
                            }}
                          >
                            <Edit3 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main view
  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-display font-bold text-lg">Desafios</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
              <Plus className="h-4 w-4 mr-1" /> Criar
            </Button>
          </div>
        </div>
      </header>

      <UserStatusBar />

      <div className="container max-w-lg mx-auto mt-4 pt-16 space-y-4 px-4">
        {/* Create form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-card p-5 space-y-3 overflow-hidden"
            >
              <h3 className="font-semibold">Novo Desafio</h3>
              <Input placeholder="Título do desafio *" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              <Textarea placeholder="Descrição (opcional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
              
              {/* Visibility & Payment */}
              <div className="space-y-2 p-3 rounded-lg bg-secondary/20">
                <label className="text-xs font-semibold flex items-center gap-1"><Shield className="h-3 w-3" /> Visibilidade</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={form.visibility === "public" ? "default" : "outline"}
                    className="flex-1 h-8 text-xs"
                    onClick={() => setForm((f) => ({ ...f, visibility: "public", entry_fee: 0 }))}
                  >
                    <Globe className="h-3 w-3 mr-1" /> Público
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={form.visibility === "private" ? "default" : "outline"}
                    className="flex-1 h-8 text-xs"
                    onClick={() => setForm((f) => ({ ...f, visibility: "private" }))}
                  >
                    <Lock className="h-3 w-3 mr-1" /> Privado
                  </Button>
                </div>
                {form.visibility === "private" && (
                  <div className="space-y-2 mt-2">
                    <p className="text-[10px] text-muted-foreground">Desafios privados exigem sua aprovação para participar.</p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={form.entry_fee === 0 ? "default" : "outline"}
                        className="flex-1 h-8 text-xs"
                        onClick={() => setForm((f) => ({ ...f, entry_fee: 0 }))}
                      >
                        Gratuito
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={form.entry_fee > 0 ? "default" : "outline"}
                        className="flex-1 h-8 text-xs"
                        onClick={() => setForm((f) => ({ ...f, entry_fee: f.entry_fee > 0 ? f.entry_fee : 10 }))}
                      >
                        <DollarSign className="h-3 w-3 mr-1" /> Pago
                      </Button>
                    </div>
                    {form.entry_fee > 0 && (
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-1 block">Valor de inscrição (R$)</label>
                        <Input type="number" min={1} step={0.01} value={form.entry_fee} onChange={(e) => setForm((f) => ({ ...f, entry_fee: Number(e.target.value) }))} className="h-8 text-xs" />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Select value={form.challenge_type} onValueChange={(v) => setForm((f) => ({ ...f, challenge_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CHALLENGE_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={form.measurement_type} onValueChange={(v) => setForm((f) => ({ ...f, measurement_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Método de validação" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MEASUREMENT_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={form.proof_frequency} onValueChange={(v) => setForm((f) => ({ ...f, proof_frequency: v }))}>
                <SelectTrigger><SelectValue placeholder="Comprovação por foto" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROOF_FREQUENCIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Meta *</label>
                  <Input type="number" min={1} value={form.goal_value} onChange={(e) => setForm((f) => ({ ...f, goal_value: Number(e.target.value) }))} />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Data início</label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Data fim *</label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>

              {/* Penalty rules */}
              <div className="space-y-2 p-3 rounded-lg bg-secondary/20">
                <label className="text-xs font-semibold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Regras de penalidade</label>
                <Select value={form.penalty_type} onValueChange={(v) => setForm((f) => ({ ...f, penalty_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PENALTY_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.penalty_type === "points" && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Pontos a perder</label>
                    <Input type="number" min={1} value={form.penalty_points} onChange={(e) => setForm((f) => ({ ...f, penalty_points: Number(e.target.value) }))} />
                  </div>
                )}
              </div>

              {/* Rules details - rich text */}
              <div className="space-y-2 p-3 rounded-lg bg-secondary/20">
                <label className="text-xs font-semibold flex items-center gap-1"><Edit3 className="h-3 w-3" /> Detalhamento das regras (opcional)</label>
                <p className="text-[10px] text-muted-foreground">Descreva as regras em detalhes. Use **texto** para negrito, *texto* para itálico, e - para listas.</p>
                <Textarea
                  placeholder="Descreva as regras detalhadas do desafio..."
                  value={form.rules_details}
                  onChange={(e) => setForm((f) => ({ ...f, rules_details: e.target.value }))}
                  rows={5}
                  className="text-sm"
                />
              </div>

              {/* Body measurements */}
              <div className="space-y-2 p-3 rounded-lg bg-secondary/20">
                <label className="text-xs font-semibold flex items-center gap-1"><Ruler className="h-3 w-3" /> Medidas corporais (opcional)</label>
                <p className="text-[10px] text-muted-foreground">Selecione quais medidas os participantes devem registrar</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(BODY_MEASUREMENT_OPTIONS).map(([k, v]) => (
                    <label key={k} className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={form.allowed_measurements.includes(k)}
                        onCheckedChange={(checked) => {
                          setForm((f) => ({
                            ...f,
                            allowed_measurements: checked
                              ? [...f.allowed_measurements, k]
                              : f.allowed_measurements.filter((m) => m !== k),
                          }));
                        }}
                      />
                      {v}
                    </label>
                  ))}
                </div>
              </div>

              {/* Stages */}
              <div className="space-y-2 p-3 rounded-lg bg-secondary/20">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold flex items-center gap-1"><Layers className="h-3 w-3" /> Etapas (opcional)</label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2"
                    onClick={() => setFormStages([...formStages, { name: "", description: "", start_date: "", end_date: "", goal_value: 0 }])}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Etapa
                  </Button>
                </div>
                {formStages.map((stage, idx) => (
                  <div key={idx} className="space-y-2 p-2 rounded bg-background/50 border border-border/30">
                     <div className="flex items-center gap-2">
                      <Input
                        placeholder={`Etapa ${idx + 1}`}
                        value={stage.name}
                        onChange={(e) => {
                          const updated = [...formStages];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          setFormStages(updated);
                        }}
                        className="flex-1 h-8 text-xs"
                      />
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setFormStages(formStages.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Descrição da etapa (opcional)"
                      value={stage.description}
                      onChange={(e) => {
                        const updated = [...formStages];
                        updated[idx] = { ...updated[idx], description: e.target.value };
                        setFormStages(updated);
                      }}
                      rows={2}
                      className="text-xs"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Início</label>
                        <Input type="date" value={stage.start_date} onChange={(e) => {
                          const updated = [...formStages]; updated[idx] = { ...updated[idx], start_date: e.target.value }; setFormStages(updated);
                        }} className="h-7 text-[10px]" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Fim</label>
                        <Input type="date" value={stage.end_date} onChange={(e) => {
                          const updated = [...formStages]; updated[idx] = { ...updated[idx], end_date: e.target.value }; setFormStages(updated);
                        }} className="h-7 text-[10px]" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Meta</label>
                        <Input type="number" min={0} value={stage.goal_value} onChange={(e) => {
                          const updated = [...formStages]; updated[idx] = { ...updated[idx], goal_value: Number(e.target.value) }; setFormStages(updated);
                        }} className="h-7 text-[10px]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button className="w-full gradient-primary text-primary-foreground" onClick={handleCreate} disabled={!form.title || !form.end_date}>
                Criar Desafio
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue="explore">
            <TabsList className="w-full">
              <TabsTrigger value="explore" className="flex-1">Explorar</TabsTrigger>
              <TabsTrigger value="mine" className="flex-1">Meus Desafios</TabsTrigger>
              <TabsTrigger value="xp" className="flex-1">XP & Ranking</TabsTrigger>
            </TabsList>

            <TabsContent value="explore" className="mt-4 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar desafios..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <Button variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="h-4 w-4" />
                </Button>
              </div>

              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex gap-2 overflow-hidden"
                  >
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="flex-1 h-9">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os tipos</SelectItem>
                        {Object.entries(CHALLENGE_TYPES).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="flex-1 h-9">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="active">Ativos</SelectItem>
                        <SelectItem value="upcoming">Em breve</SelectItem>
                        <SelectItem value="expired">Expirados</SelectItem>
                        <SelectItem value="closed">Encerrados</SelectItem>
                      </SelectContent>
                    </Select>
                  </motion.div>
                )}
              </AnimatePresence>

              {filteredChallenges.length === 0 ? (
                <EmptyState message={searchQuery ? "Nenhum desafio encontrado." : "Nenhum desafio disponível."} />
              ) : (
                <div className="space-y-3">
                  {filteredChallenges.map((c, i) => <ChallengeCard key={c.id} c={c} i={i} />)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="mine" className="mt-4 space-y-5">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Crown className="h-4 w-4" /> Criados por mim
                </h3>
                {myCreated.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-6">Você ainda não criou nenhum desafio.</p>
                ) : (
                  myCreated.map((c, i) => <ChallengeCard key={c.id} c={c} i={i} />)
                )}
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" /> Participando
                </h3>
                {myParticipating.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-6">Você não está participando de nenhum desafio.</p>
                ) : (
                  myParticipating.map((c, i) => <ChallengeCard key={c.id} c={c} i={i} />)
                )}
              </div>
            </TabsContent>

            <TabsContent value="xp" className="mt-4 space-y-6">
              {gamifLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Nível</p>
                        <p className="text-4xl font-display font-bold text-primary">{userXp?.level || 1}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">XP Total</p>
                        <p className="text-2xl font-bold">{userXp?.total_xp || 0}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Próximo nível</span>
                        <span>{Math.round(progressPct)}%</span>
                      </div>
                      <Progress value={progressPct} className="h-3" />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <Flame className="h-5 w-5 text-destructive" />
                        <div>
                          <p className="text-lg font-bold">{userXp?.current_streak || 0}</p>
                          <p className="text-[10px] text-muted-foreground">Dias seguidos</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-lg font-bold">{userXp?.longest_streak || 0}</p>
                          <p className="text-[10px] text-muted-foreground">Recorde</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2"><Star className="h-4 w-4" /> Conquistas</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {badges.map((badge, i) => {
                        const earned = earnedIds.has(badge.id);
                        const Icon = ICON_MAP[badge.icon] || Trophy;
                        return (
                          <motion.div
                            key={badge.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.03 }}
                            className={`glass-card p-4 text-center space-y-2 ${earned ? "border-primary/50" : "opacity-40"}`}
                          >
                            <Icon className={`h-8 w-8 mx-auto ${earned ? "text-primary" : "text-muted-foreground"}`} />
                            <p className="text-sm font-semibold">{badge.name}</p>
                            <p className="text-[10px] text-muted-foreground">{badge.description}</p>
                            {badge.xp_reward > 0 && (
                              <p className="text-[10px] text-primary font-semibold">+{badge.xp_reward} XP</p>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2"><Medal className="h-4 w-4" /> Ranking Global</h3>
                    <div className="space-y-2">
                      {leaderboard.map((entry, i) => {
                        const isMe = entry.user_id === user?.id;
                        return (
                          <motion.div
                            key={entry.user_id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className={`flex items-center gap-3 p-3 rounded-lg ${isMe ? "bg-primary/10 border border-primary/30" : "bg-secondary/30"}`}
                          >
                            <span className="w-7 text-center font-bold text-sm">
                              {i === 0 ? <Crown className="h-5 w-5 text-warning mx-auto" /> :
                               i === 1 ? <Medal className="h-5 w-5 text-muted-foreground mx-auto" /> :
                               i === 2 ? <Medal className="h-5 w-5 text-accent mx-auto" /> :
                               `${i + 1}º`}
                            </span>
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={entry.avatar_url || ""} />
                              <AvatarFallback className="text-xs">{(entry.full_name || "?")[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{entry.full_name}{isMe ? " (você)" : ""}</p>
                              <p className="text-[10px] text-muted-foreground">Nível {entry.level} • 🔥 {entry.current_streak}</p>
                            </div>
                            <span className="text-sm font-mono font-bold text-primary">{entry.total_xp} XP</span>
                          </motion.div>
                        );
                      })}
                      {leaderboard.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">Nenhum jogador ainda.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default Challenges;
