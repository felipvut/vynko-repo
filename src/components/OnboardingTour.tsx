import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, Rocket, Brain, Users, Trophy, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const TOUR_KEY = "vynko_tour_completed";

interface TourStep {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const steps: TourStep[] = [
  {
    icon: <Rocket className="h-8 w-8 text-primary" />,
    title: "Bem-vindo à Vynko! 🚀",
    description: "Assuma o comando da sua jornada fitness.",
  },
  {
    icon: <Brain className="h-8 w-8 text-primary" />,
    title: "Perfil de IA 🧠",
    description: "Vamos te conhecer para melhorar seus resultados. Preencha sua anamnese e receba treinos e dietas personalizados!",
  },
  {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: "Comunidade 💪",
    description: "Compartilhe sua jornada e veja como seus amigos estão evoluindo. No Move, inspiração em cada swipe!",
  },
  {
    icon: <Trophy className="h-8 w-8 text-primary" />,
    title: "Desafios 🏆",
    description: "Transforme esforço em conquistas. Participe e evolua!",
  },
  {
    icon: <ShoppingBag className="h-8 w-8 text-primary" />,
    title: "Marketplace 🛒",
    description: "Encontre serviços para sua evolução. Ou ganhe dinheiro ajudando outros a evoluir!",
  },
];

const OnboardingTour = () => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!user) return;
    // Check localStorage first (fast), then DB as source of truth
    const localDone = localStorage.getItem(`${TOUR_KEY}_${user.id}`);
    if (localDone) return;

    supabase
      .from("profiles")
      .select("created_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        // Only show tour for accounts created in the last 10 minutes (fresh signup)
        const created = new Date(data.created_at).getTime();
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000;
        if (now - created < tenMinutes) {
          setVisible(true);
        } else {
          // Old account, mark as done so we never check again
          localStorage.setItem(`${TOUR_KEY}_${user.id}`, "true");
        }
      });
  }, [user]);

  const finish = () => {
    if (user) localStorage.setItem(`${TOUR_KEY}_${user.id}`, "true");
    setVisible(false);
  };

  const next = () => {
    if (current < steps.length - 1) {
      setCurrent((p) => p + 1);
    } else {
      finish();
    }
  };

  if (!visible) return null;

  const step = steps[current];
  const progress = ((current + 1) / steps.length) * 100;

  return (
    <AnimatePresence>
      <motion.div
        key="tour-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
        >
          {/* Close */}
          <button
            onClick={finish}
            className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Pular tour"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Progress */}
          <div className="mb-4 flex items-center gap-2">
            <Progress value={progress} className="h-1.5 flex-1" />
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
              {current + 1} de {steps.length}
            </span>
          </div>

          {/* Content */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              {step.icon}
            </div>
            <h2 className="text-lg font-bold text-foreground">{step.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
              {step.description}
            </p>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={finish} className="text-muted-foreground">
              Pular Tour
            </Button>
            <Button size="sm" onClick={next} className="gap-1">
              {current < steps.length - 1 ? (
                <>
                  Próximo <ChevronRight className="h-4 w-4" />
                </>
              ) : (
                "Começar! 🎉"
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingTour;
