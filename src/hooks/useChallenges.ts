import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Challenge {
  id: string;
  title: string;
  description: string | null;
  challenge_type: string;
  goal_value: number;
  start_date: string;
  end_date: string;
  created_by: string;
  image_url: string | null;
  created_at: string;
  status: string;
  measurement_type: string;
  proof_frequency: string;
  penalty_type: string;
  penalty_points: number;
  allowed_measurements: string[];
  closed_at: string | null;
  rules_details?: string | null;
  visibility: string;
  entry_fee: number;
  requires_approval: boolean;
  participants?: Participant[];
  creator_name?: string;
  results?: ChallengeResult[];
  stages?: ChallengeStage[];
  join_requests?: JoinRequest[];
}

export interface JoinRequest {
  id: string;
  challenge_id: string;
  user_id: string;
  status: string;
  stripe_payment_intent_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  profile_name?: string;
  avatar_url?: string;
}

export interface Participant {
  id: string;
  challenge_id: string;
  user_id: string;
  progress: number;
  joined_at: string;
  profile_name?: string;
  avatar_url?: string;
}

export interface ChallengeResult {
  id: string;
  challenge_id: string;
  user_id: string;
  final_rank: number;
  final_progress: number;
  xp_awarded: number;
  profile_name?: string;
  avatar_url?: string;
}

export interface ChallengeProof {
  id: string;
  challenge_id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  profile_name?: string;
  avatar_url?: string;
}

export interface ChallengeStage {
  id: string;
  challenge_id: string;
  name: string;
  description: string | null;
  stage_order: number;
  start_date: string;
  end_date: string;
  goal_value: number;
  created_at: string;
}

export interface ChallengeMeasurement {
  id: string;
  challenge_id: string;
  user_id: string;
  measurement_type: string;
  value: number;
  image_url: string | null;
  stage_id: string | null;
  notes: string | null;
  recorded_at: string;
  created_at: string;
  profile_name?: string;
  avatar_url?: string;
}

export const CHALLENGE_TYPES: Record<string, string> = {
  workout_count: "Total de treinos",
  workout_minutes: "Minutos de treino",
  exercise_sets: "Séries completadas",
  diet_days: "Dias seguindo dieta",
  weight_loss: "Perda de peso (kg)",
  body_fat_loss: "Redução de gordura (%)",
  muscle_gain: "Ganho de massa (kg)",
  measurements: "Redução de medidas (cm)",
};

export const MEASUREMENT_TYPES: Record<string, string> = {
  automatic: "Automático (dados do app)",
  manual: "Manual (admin valida)",
  mixed: "Misto (auto + ajuste manual)",
};

export const PROOF_FREQUENCIES: Record<string, string> = {
  none: "Sem comprovação por foto",
  daily: "Comprovação diária",
  weekly: "Comprovação semanal",
  on_completion: "Comprovação ao concluir",
};

export const PENALTY_TYPES: Record<string, string> = {
  none: "Sem penalidade",
  elimination: "Eliminação do desafio",
  points: "Perda de pontos",
};

export const BODY_MEASUREMENT_OPTIONS: Record<string, string> = {
  weight: "Peso (kg)",
  body_fat: "Gordura corporal (%)",
  chest: "Peitoral (cm)",
  waist: "Cintura (cm)",
  hips: "Quadril (cm)",
  arms: "Braços (cm)",
  thighs: "Coxas (cm)",
};

export function useChallenges() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChallenges = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enriched = await Promise.all(
        (data || []).map(async (c: any) => {
          const [partsRes, creatorRes, resultsRes, stagesRes, joinReqRes] = await Promise.all([
            supabase.from("challenge_participants").select("*").eq("challenge_id", c.id).order("progress", { ascending: false }),
            supabase.from("profiles").select("full_name").eq("user_id", c.created_by).maybeSingle(),
            c.status === "closed"
              ? supabase.from("challenge_results").select("*").eq("challenge_id", c.id).order("final_rank", { ascending: true })
              : Promise.resolve({ data: [] }),
            supabase.from("challenge_stages").select("*").eq("challenge_id", c.id).order("stage_order", { ascending: true }),
            c.visibility === "private"
              ? supabase.from("challenge_join_requests").select("*").eq("challenge_id", c.id).order("created_at", { ascending: false })
              : Promise.resolve({ data: [] }),
          ]);

          const enrichedParts = await Promise.all(
            (partsRes.data || []).map(async (p: any) => {
              const { data: prof } = await supabase
                .from("profiles")
                .select("full_name, avatar_url")
                .eq("user_id", p.user_id)
                .maybeSingle();
              return { ...p, profile_name: prof?.full_name || "Anônimo", avatar_url: prof?.avatar_url };
            })
          );

          const enrichedResults = await Promise.all(
            ((resultsRes as any).data || []).map(async (r: any) => {
              const { data: prof } = await supabase
                .from("profiles")
                .select("full_name, avatar_url")
                .eq("user_id", r.user_id)
                .maybeSingle();
              return { ...r, profile_name: prof?.full_name || "Anônimo", avatar_url: prof?.avatar_url };
            })
          );

          const enrichedJoinReqs = await Promise.all(
            ((joinReqRes as any).data || []).map(async (jr: any) => {
              const { data: prof } = await supabase
                .from("profiles")
                .select("full_name, avatar_url")
                .eq("user_id", jr.user_id)
                .maybeSingle();
              return { ...jr, profile_name: prof?.full_name || "Anônimo", avatar_url: prof?.avatar_url };
            })
          );

          return {
            ...c,
            status: c.status || "active",
            measurement_type: c.measurement_type || "automatic",
            proof_frequency: c.proof_frequency || "none",
            penalty_type: c.penalty_type || "none",
            penalty_points: c.penalty_points || 0,
            allowed_measurements: c.allowed_measurements || [],
            visibility: c.visibility || "public",
            entry_fee: c.entry_fee || 0,
            requires_approval: c.requires_approval || false,
            participants: enrichedParts,
            creator_name: creatorRes.data?.full_name || "Anônimo",
            results: enrichedResults,
            stages: (stagesRes.data || []) as ChallengeStage[],
            join_requests: enrichedJoinReqs,
          } as Challenge;
        })
      );

      setChallenges(enriched);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao carregar desafios");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  const createChallenge = async (data: {
    title: string;
    description?: string;
    challenge_type: string;
    goal_value: number;
    start_date?: string;
    end_date: string;
    measurement_type?: string;
    proof_frequency?: string;
    penalty_type?: string;
    penalty_points?: number;
    allowed_measurements?: string[];
    rules_details?: string;
    visibility?: string;
    entry_fee?: number;
    requires_approval?: boolean;
    stages?: { name: string; description?: string; start_date: string; end_date: string; goal_value: number }[];
  }) => {
    if (!user) return;
    if (!data.end_date) {
      toast.error("Data de término é obrigatória");
      return;
    }
    const { stages, rules_details, start_date, ...challengeData } = data;
    const insertData: any = {
      ...challengeData,
      created_by: user.id,
      measurement_type: challengeData.measurement_type || "automatic",
      proof_frequency: challengeData.proof_frequency || "none",
      penalty_type: challengeData.penalty_type || "none",
      penalty_points: challengeData.penalty_points || 0,
      allowed_measurements: challengeData.allowed_measurements || [],
      visibility: challengeData.visibility || "public",
      entry_fee: challengeData.entry_fee || 0,
      requires_approval: challengeData.visibility === "private" ? true : false,
    };
    if (start_date) insertData.start_date = start_date;
    if (rules_details) insertData.rules_details = rules_details;
    
    const { data: inserted, error } = await supabase.from("challenges").insert(insertData).select("id").single();
    if (error) {
      toast.error("Erro ao criar desafio");
      return;
    }

    // Insert stages if any
    if (stages && stages.length > 0 && inserted) {
      const stageRows = stages.map((s, i) => ({
        challenge_id: inserted.id,
        name: s.name,
        description: s.description || null,
        stage_order: i + 1,
        start_date: s.start_date,
        end_date: s.end_date,
        goal_value: s.goal_value,
      }));
      const { error: stageErr } = await supabase.from("challenge_stages").insert(stageRows);
      if (stageErr) {
        console.error(stageErr);
        toast.error("Desafio criado, mas erro ao salvar etapas");
      }
    }

    toast.success("Desafio criado!");
    fetchChallenges();
  };

  const joinChallenge = async (challengeId: string) => {
    if (!user) return;
    const { error } = await supabase.from("challenge_participants").insert({
      challenge_id: challengeId,
      user_id: user.id,
    });
    if (error) {
      if (error.code === "23505") {
        toast.info("Você já participa deste desafio");
      } else {
        toast.error("Erro ao participar");
      }
      return;
    }
    toast.success("Você entrou no desafio!");
    fetchChallenges();
  };

  const leaveChallenge = async (challengeId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("challenge_participants")
      .delete()
      .eq("challenge_id", challengeId)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao sair do desafio");
      return;
    }
    toast.success("Você saiu do desafio");
    fetchChallenges();
  };

  const updateParticipantProgress = async (challengeId: string, userId: string, progress: number) => {
    if (!user) return;
    const { error } = await supabase
      .from("challenge_participants")
      .update({ progress })
      .eq("challenge_id", challengeId)
      .eq("user_id", userId);
    if (error) {
      toast.error("Erro ao atualizar progresso");
      return;
    }
    toast.success("Progresso atualizado!");
    fetchChallenges();
  };

  const closeChallenge = async (challengeId: string) => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await supabase.functions.invoke("close-challenges", {
        body: { challenge_id: challengeId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.error) throw res.error;
      toast.success("Desafio encerrado! Resultados publicados.");
      fetchChallenges();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao encerrar desafio");
    }
  };

  // Proof functions
  const fetchProofs = async (challengeId: string): Promise<ChallengeProof[]> => {
    const { data, error } = await supabase
      .from("challenge_proofs")
      .select("*")
      .eq("challenge_id", challengeId)
      .order("created_at", { ascending: false });
    if (error) { console.error(error); return []; }
    const enriched = await Promise.all(
      (data || []).map(async (p: any) => {
        const { data: prof } = await supabase.from("profiles").select("full_name, avatar_url").eq("user_id", p.user_id).maybeSingle();
        return { ...p, profile_name: prof?.full_name || "Anônimo", avatar_url: prof?.avatar_url };
      })
    );
    return enriched as ChallengeProof[];
  };

  const submitProof = async (challengeId: string, file: File, caption?: string) => {
    if (!user) return;
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${challengeId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("challenge-proofs").upload(path, file, { contentType: file.type });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("challenge-proofs").getPublicUrl(path);
      const { error: insertErr } = await supabase.from("challenge_proofs").insert({
        challenge_id: challengeId, user_id: user.id, image_url: urlData.publicUrl, caption: caption || null,
      });
      if (insertErr) throw insertErr;
      toast.success("Comprovação enviada!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao enviar comprovação");
    }
  };

  const reviewProof = async (proofId: string, approved: boolean, rejectionReason?: string) => {
    if (!user) return;
    const { error } = await supabase.from("challenge_proofs").update({
      status: approved ? "approved" : "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: approved ? null : (rejectionReason || null),
    }).eq("id", proofId);
    if (error) { toast.error("Erro ao avaliar comprovação"); return; }
    toast.success(approved ? "Comprovação aprovada!" : "Comprovação rejeitada.");
  };

  // Challenge measurements
  const fetchChallengeMeasurements = async (challengeId: string): Promise<ChallengeMeasurement[]> => {
    const { data, error } = await supabase
      .from("challenge_measurements")
      .select("*")
      .eq("challenge_id", challengeId)
      .order("recorded_at", { ascending: true });
    if (error) { console.error(error); return []; }
    const enriched = await Promise.all(
      (data || []).map(async (m: any) => {
        const { data: prof } = await supabase.from("profiles").select("full_name, avatar_url").eq("user_id", m.user_id).maybeSingle();
        return { ...m, profile_name: prof?.full_name || "Anônimo", avatar_url: prof?.avatar_url };
      })
    );
    return enriched as ChallengeMeasurement[];
  };

  const submitChallengeMeasurement = async (
    challengeId: string, measurementType: string, value: number, file?: File, stageId?: string, notes?: string
  ) => {
    if (!user) return;
    try {
      let imageUrl: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${challengeId}/measures/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("challenge-proofs").upload(path, file, { contentType: file.type });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("challenge-proofs").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      // Also sync to main measurements table
      const measurementMap: Record<string, string> = {
        weight: "weight", body_fat: "body_fat_percentage", chest: "chest",
        waist: "waist", hips: "hips", arms: "arms", thighs: "thighs",
      };
      const mainCol = measurementMap[measurementType];
      if (mainCol) {
        await supabase.from("measurements").insert({
          user_id: user.id,
          [mainCol]: value,
        });
      }

      const { error } = await supabase.from("challenge_measurements").insert({
        challenge_id: challengeId,
        user_id: user.id,
        measurement_type: measurementType,
        value,
        image_url: imageUrl,
        stage_id: stageId || null,
        notes: notes || null,
      });
      if (error) throw error;
      toast.success("Medida registrada!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao registrar medida");
    }
  };

  // Stage management
  const addStage = async (challengeId: string, stage: { name: string; description?: string; start_date: string; end_date: string; goal_value: number; stage_order: number }) => {
    if (!user) return;
    const { error } = await supabase.from("challenge_stages").insert({ challenge_id: challengeId, ...stage });
    if (error) { toast.error("Erro ao adicionar etapa"); return; }
    toast.success("Etapa adicionada!");
    fetchChallenges();
  };

  const deleteStage = async (stageId: string) => {
    if (!user) return;
    const { error } = await supabase.from("challenge_stages").delete().eq("id", stageId);
    if (error) { toast.error("Erro ao remover etapa"); return; }
    toast.success("Etapa removida!");
    fetchChallenges();
  };

  // Join request functions (for private challenges)
  const requestToJoin = async (challengeId: string) => {
    if (!user) return;
    const { error } = await supabase.from("challenge_join_requests").insert({
      challenge_id: challengeId,
      user_id: user.id,
    });
    if (error) {
      if (error.code === "23505") {
        toast.info("Você já solicitou participação neste desafio");
      } else {
        toast.error("Erro ao solicitar participação");
      }
      return;
    }
    toast.success("Solicitação enviada! Aguarde aprovação do organizador.");
    fetchChallenges();
  };

  const reviewJoinRequest = async (requestId: string, approved: boolean) => {
    if (!user) return;
    const { data: req, error: fetchErr } = await supabase
      .from("challenge_join_requests")
      .select("*")
      .eq("id", requestId)
      .single();
    if (fetchErr || !req) {
      toast.error("Solicitação não encontrada");
      return;
    }

    const { error: updateErr } = await supabase
      .from("challenge_join_requests")
      .update({
        status: approved ? "approved" : "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq("id", requestId);
    if (updateErr) {
      toast.error("Erro ao processar solicitação");
      return;
    }

    if (approved) {
      // Add participant
      const { error: joinErr } = await supabase.from("challenge_participants").insert({
        challenge_id: req.challenge_id,
        user_id: req.user_id,
      });
      if (joinErr && joinErr.code !== "23505") {
        toast.error("Erro ao adicionar participante");
        return;
      }
      toast.success("Participante aprovado!");
    } else {
      toast.success("Solicitação rejeitada.");
    }
    fetchChallenges();
  };

  // Paid challenge join via Stripe
  const requestPaidJoin = async (challengeId: string) => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await supabase.functions.invoke("challenge-checkout", {
        body: { challenge_id: challengeId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.error) throw res.error;
      const { url } = res.data;
      if (url) {
        window.open(url, "_blank");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao iniciar pagamento");
    }
  };

  return {
    challenges,
    loading,
    createChallenge,
    joinChallenge,
    leaveChallenge,
    updateParticipantProgress,
    closeChallenge,
    fetchProofs,
    submitProof,
    reviewProof,
    fetchChallengeMeasurements,
    submitChallengeMeasurement,
    addStage,
    deleteStage,
    requestToJoin,
    reviewJoinRequest,
    requestPaidJoin,
    refresh: fetchChallenges,
  };
}
