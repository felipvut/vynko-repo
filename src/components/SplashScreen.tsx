import { motion, AnimatePresence } from "framer-motion";
import vynkoLogo from "@/assets/airfit-logo.png";

interface SplashScreenProps {
  visible: boolean;
}

const SplashScreen = ({ visible }: SplashScreenProps) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background px-8"
        >
          {/* Glow background effect */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
          </div>

          <div className="relative z-10 flex flex-col items-center text-center max-w-md space-y-8">
            {/* Logo */}
            <motion.img
              src={vynkoLogo}
              alt="Vynko"
              className="h-20 drop-shadow-[0_0_25px_hsl(var(--primary)/0.5)]"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />

            {/* Divider line */}
            <motion.div
              className="w-16 h-0.5 bg-primary rounded-full"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            />

            {/* Main text */}
            <motion.p
              className="text-foreground/90 text-base font-medium leading-relaxed"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              Sugestão de Treinos e Dietas inteligentes gerados por IA, personalizados para seu corpo, seus objetivos e sua rotina.
            </motion.p>

            {/* Secondary text */}
            <motion.p
              className="text-muted-foreground text-sm leading-relaxed"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              Evolua com desafios reais e faça parte da comunidade fitness que mais cresce no mundo.
            </motion.p>

            {/* Loading dots */}
            <motion.div
              className="flex gap-1.5 pt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
