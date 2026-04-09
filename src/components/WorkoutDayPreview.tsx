import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Youtube, Pencil } from "lucide-react";
import EditExerciseSheet from "@/components/EditExerciseSheet";

interface Props {
  day: any;
  onBack: () => void;
  onStart: () => void;
  onRefresh?: () => void;
}

const WorkoutDayPreview = ({ day, onBack, onStart, onRefresh }: Props) => {
  const [exercises, setExercises] = useState(day.exercises || []);
  const [editingExercise, setEditingExercise] = useState<any>(null);

  const openYoutube = (name: string) => {
    window.open(`https://www.youtube.com/results?search_query=como+fazer+${encodeURIComponent(name)}+exercício`, "_blank");
  };

  const handleSaved = () => {
    onRefresh?.();
  };

  const handleDeleted = () => {
    setExercises((prev: any[]) => prev.filter((e: any) => e.id !== editingExercise?.id));
    onRefresh?.();
  };

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <span className="font-display font-bold text-sm">{day.name}</span>
          <div className="w-16" />
        </div>
      </header>

      <div className="container mt-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-display font-bold">{day.name}</h2>
          <p className="text-muted-foreground mt-1">{day.muscle_groups}</p>
          <p className="text-sm text-muted-foreground mt-1">{exercises.length} exercícios</p>
        </motion.div>

        <div className="space-y-3">
          {exercises.map((ex: any, i: number) => (
            <motion.div
              key={ex.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center text-xs font-mono text-muted-foreground flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-semibold">{ex.name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {ex.sets} séries × {ex.reps} reps • {ex.rest_seconds}s descanso
                    </p>
                    {ex.notes && (
                      <p className="text-xs text-muted-foreground italic mt-1">{ex.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="flex-shrink-0" onClick={() => setEditingExercise(ex)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-shrink-0" onClick={() => openYoutube(ex.name)}>
                    <Youtube className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border/50 z-50">
        <div className="container">
          <Button onClick={onStart} className="w-full gradient-primary text-primary-foreground h-12 text-base font-bold">
            <Play className="h-5 w-5 mr-2" /> Iniciar Treino
          </Button>
        </div>
      </div>

      {editingExercise && (
        <EditExerciseSheet
          open={!!editingExercise}
          onOpenChange={(open) => { if (!open) setEditingExercise(null); }}
          exercise={editingExercise}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
};

export default WorkoutDayPreview;
