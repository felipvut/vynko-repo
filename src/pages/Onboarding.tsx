import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Activity, Heart, Target, Calendar, X } from "lucide-react";

const STEPS = [
  { title: "Dados Físicos", icon: Activity, description: "Informações básicas do seu corpo" },
  { title: "Saúde", icon: Heart, description: "Histórico e condições de saúde" },
  { title: "Estilo de Vida", icon: Activity, description: "Seus hábitos diários" },
  { title: "Objetivos", icon: Target, description: "O que você quer alcançar" },
  { title: "Disponibilidade", icon: Calendar, description: "Quando você pode treinar" },
];

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as any)?.returnTo || "/";
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    age: "", sex: "", weight: "", height: "",
    injuries: "", physical_limitations: "", chronic_pain: "", relevant_diseases: "", medications: "",
    dietary_restrictions: "", allergies: "",
    activity_level: "", weekly_frequency: "", smoking: false, alcohol: "", sleep_quality: "", other_habits: "",
    goal: "", goal_details: "",
    session_duration: "", split_preference: "",
  });

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  // Load existing anamnesis for editing
  useEffect(() => {
    if (!user) return;
    supabase.from("anamnesis").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setExistingId(data.id);
        setForm({
          age: data.age?.toString() || "",
          sex: data.sex || "",
          weight: data.weight?.toString() || "",
          height: data.height?.toString() || "",
          injuries: data.injuries || "",
          physical_limitations: data.physical_limitations || "",
          chronic_pain: data.chronic_pain || "",
          relevant_diseases: data.relevant_diseases || "",
          medications: data.medications || "",
          dietary_restrictions: (data as any).dietary_restrictions || "",
          allergies: (data as any).allergies || "",
          activity_level: data.activity_level || "",
          weekly_frequency: data.weekly_frequency?.toString() || "",
          smoking: data.smoking || false,
          alcohol: data.alcohol || "",
          sleep_quality: data.sleep_quality || "",
          other_habits: data.other_habits || "",
          goal: data.goal || "",
          goal_details: data.goal_details || "",
          session_duration: data.session_duration?.toString() || "",
          split_preference: data.split_preference || "",
        });
      }
      setLoadingData(false);
    });
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);

    const payload = {
      user_id: user.id,
      age: form.age ? parseInt(form.age) : null,
      sex: form.sex || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      height: form.height ? parseFloat(form.height) : null,
      injuries: form.injuries || null,
      physical_limitations: form.physical_limitations || null,
      chronic_pain: form.chronic_pain || null,
      relevant_diseases: form.relevant_diseases || null,
      medications: form.medications || null,
      dietary_restrictions: form.dietary_restrictions || null,
      allergies: form.allergies || null,
      activity_level: form.activity_level || null,
      weekly_frequency: form.weekly_frequency ? parseInt(form.weekly_frequency) : null,
      smoking: form.smoking,
      alcohol: form.alcohol || null,
      sleep_quality: form.sleep_quality || null,
      other_habits: form.other_habits || null,
      goal: form.goal || null,
      goal_details: form.goal_details || null,
      session_duration: form.session_duration ? parseInt(form.session_duration) : null,
      split_preference: form.split_preference || null,
      completed: true,
    };

    let error;
    if (existingId) {
      ({ error } = await supabase.from("anamnesis").update(payload).eq("id", existingId));
    } else {
      ({ error } = await supabase.from("anamnesis").insert(payload));
    }

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success(existingId ? "Anamnese atualizada!" : "Perfil salvo com sucesso!");
      if (existingId) {
        navigate(returnTo, { state: { anamnesisCompleted: true } });
      } else {
        // First time: go to training and auto-generate workout
        navigate("/training", { state: { autoGenerate: true, anamnesisCompleted: true } });
      }
    }
    setLoading(false);
  };

  const stepContent = [
    // Step 0: Physical data
    <div className="space-y-4" key="physical">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Idade</Label>
          <Input type="number" placeholder="25" value={form.age} onChange={e => update("age", e.target.value)} className="bg-secondary" />
        </div>
        <div className="space-y-2">
          <Label>Sexo</Label>
          <Select value={form.sex} onValueChange={v => update("sex", v)}>
            <SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="masculino">Masculino</SelectItem>
              <SelectItem value="feminino">Feminino</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
              <SelectItem value="prefiro_nao_dizer">Prefiro não dizer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Peso (kg)</Label>
          <Input type="number" placeholder="75" value={form.weight} onChange={e => update("weight", e.target.value)} className="bg-secondary" />
        </div>
        <div className="space-y-2">
          <Label>Altura (cm)</Label>
          <Input type="number" placeholder="175" value={form.height} onChange={e => update("height", e.target.value)} className="bg-secondary" />
        </div>
      </div>
    </div>,

    // Step 1: Health
    <div className="space-y-4" key="health">
      <div className="space-y-2">
        <Label>Lesões anteriores</Label>
        <Textarea placeholder="Descreva lesões anteriores..." value={form.injuries} onChange={e => update("injuries", e.target.value)} className="bg-secondary" />
      </div>
      <div className="space-y-2">
        <Label>Limitações físicas</Label>
        <Textarea placeholder="Alguma limitação?" value={form.physical_limitations} onChange={e => update("physical_limitations", e.target.value)} className="bg-secondary" />
      </div>
      <div className="space-y-2">
        <Label>Dores crônicas</Label>
        <Input placeholder="Ex: lombar, joelho..." value={form.chronic_pain} onChange={e => update("chronic_pain", e.target.value)} className="bg-secondary" />
      </div>
      <div className="space-y-2">
        <Label>Doenças relevantes</Label>
        <Input placeholder="Ex: diabetes, hipertensão..." value={form.relevant_diseases} onChange={e => update("relevant_diseases", e.target.value)} className="bg-secondary" />
      </div>
      <div className="space-y-2">
        <Label>Medicamentos (opcional)</Label>
        <Input placeholder="Medicamentos em uso" value={form.medications} onChange={e => update("medications", e.target.value)} className="bg-secondary" />
      </div>
      <div className="space-y-2">
        <Label>Restrições alimentares</Label>
        <Textarea placeholder="Ex: vegetariano, vegano, sem lactose, sem glúten, low carb..." value={form.dietary_restrictions} onChange={e => update("dietary_restrictions", e.target.value)} className="bg-secondary" />
      </div>
      <div className="space-y-2">
        <Label>Alergias alimentares</Label>
        <Textarea placeholder="Ex: amendoim, frutos do mar, ovo, leite, soja..." value={form.allergies} onChange={e => update("allergies", e.target.value)} className="bg-secondary" />
      </div>
    </div>,

    // Step 2: Lifestyle
    <div className="space-y-4" key="lifestyle">
      <div className="space-y-2">
        <Label>Nível de atividade física</Label>
        <Select value={form.activity_level} onValueChange={v => update("activity_level", v)}>
          <SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sedentario">Sedentário</SelectItem>
            <SelectItem value="iniciante">Iniciante</SelectItem>
            <SelectItem value="intermediario">Intermediário</SelectItem>
            <SelectItem value="avancado">Avançado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Frequência semanal atual</Label>
        <Input type="number" placeholder="3" value={form.weekly_frequency} onChange={e => update("weekly_frequency", e.target.value)} className="bg-secondary" />
      </div>
      <div className="flex items-center justify-between">
        <Label>Tabagismo</Label>
        <Switch checked={form.smoking} onCheckedChange={v => update("smoking", v)} />
      </div>
      <div className="space-y-2">
        <Label>Consumo de álcool</Label>
        <Select value={form.alcohol} onValueChange={v => update("alcohol", v)}>
          <SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="nenhum">Nenhum</SelectItem>
            <SelectItem value="ocasional">Ocasional</SelectItem>
            <SelectItem value="moderado">Moderado</SelectItem>
            <SelectItem value="frequente">Frequente</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Qualidade do sono</Label>
        <Select value={form.sleep_quality} onValueChange={v => update("sleep_quality", v)}>
          <SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ruim">Ruim</SelectItem>
            <SelectItem value="regular">Regular</SelectItem>
            <SelectItem value="boa">Boa</SelectItem>
            <SelectItem value="excelente">Excelente</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>,

    // Step 3: Goals
    <div className="space-y-4" key="goals">
      <div className="space-y-2">
        <Label>Objetivo principal</Label>
        <Textarea
          placeholder="Ex: Quero emagrecer e ganhar massa muscular, melhorar minha performance no MTB, reabilitação do ombro..."
          value={form.goal}
          onChange={e => update("goal", e.target.value)}
          className="bg-secondary min-h-[100px]"
        />
      </div>
      <div className="space-y-2">
        <Label>Detalhes adicionais (opcional)</Label>
        <Textarea
          value={form.goal_details}
          onChange={e => update("goal_details", e.target.value)}
          className="bg-secondary"
          placeholder="Algo mais que o personal IA deva saber sobre seus objetivos?"
        />
      </div>
    </div>,

    // Step 4: Availability
    <div className="space-y-4" key="availability">
      <div className="space-y-2">
        <Label>Tempo por treino (minutos)</Label>
        <Select value={form.session_duration} onValueChange={v => update("session_duration", v)}>
          <SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 min</SelectItem>
            <SelectItem value="45">45 min</SelectItem>
            <SelectItem value="60">60 min</SelectItem>
            <SelectItem value="90">90 min</SelectItem>
            <SelectItem value="120">120 min</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Preferência de divisão (opcional)</Label>
        <Select value={form.split_preference} onValueChange={v => update("split_preference", v)}>
          <SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="abc_tradicional">ABC Tradicional (por grupamento)</SelectItem>
            <SelectItem value="conjugado">Conjugado (Força + Potência)</SelectItem>
            <SelectItem value="especifico_atletas">Específico para Atletas</SelectItem>
            <SelectItem value="full_body">Full Body (Corpo Inteiro)</SelectItem>
            <SelectItem value="periodizacao_ondulatoria">Periodização Ondulatória</SelectItem>
            <SelectItem value="push_pull_legs">Push / Pull / Legs (PPL)</SelectItem>
            <SelectItem value="upper_lower">Upper / Lower (Superior / Inferior)</SelectItem>
            <SelectItem value="sem_preferencia">Sem preferência</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>,
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <div className="glass-card p-8">
          {/* Close button */}
          <div className="flex justify-end -mt-2 -mr-2 mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress */}
          <div className="flex gap-2 mb-8">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "gradient-primary" : "bg-secondary"}`} />
            ))}
          </div>

          {/* Step header */}
          <div className="flex items-center gap-3 mb-6">
            {(() => { const Icon = STEPS[step].icon; return <Icon className="h-6 w-6 text-primary" />; })()}
            <div>
              <h2 className="text-xl font-display font-bold">{STEPS[step].title}</h2>
              <p className="text-sm text-muted-foreground">{STEPS[step].description}</p>
            </div>
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {stepContent[step]}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)} className="gradient-primary text-primary-foreground">
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading} className="gradient-primary text-primary-foreground">
                {loading ? "Salvando..." : "Finalizar"}
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Onboarding;
