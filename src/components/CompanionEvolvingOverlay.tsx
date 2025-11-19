import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface CompanionEvolvingOverlayProps {
  isVisible: boolean;
}

export const CompanionEvolvingOverlay = ({ isVisible }: CompanionEvolvingOverlayProps) => {
  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9998] bg-gradient-to-br from-black via-primary/30 to-black flex items-center justify-center"
      style={{ pointerEvents: 'auto', touchAction: 'none' }}
    >
      {/* Animated background glow */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-primary/40 via-accent/40 to-primary/40"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.6, 0.3],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Particle effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-primary/80 rounded-full"
            style={{
              boxShadow: "0 0 8px currentColor"
            }}
            initial={{
              x: Math.random() * window.innerWidth,
              y: window.innerHeight + 50,
            }}
            animate={{
              y: -50,
              x: Math.random() * window.innerWidth,
              scale: [0, 1.2, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1.5 + Math.random() * 1.5,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-col items-center gap-6 relative z-10">
        <motion.div
          animate={{
            rotate: [0, 360],
            scale: [1, 1.1, 1],
          }}
          transition={{
            rotate: { duration: 2, repeat: Infinity, ease: "linear" },
            scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          <Sparkles className="w-20 h-20 text-primary" 
            style={{ filter: "drop-shadow(0 0 20px currentColor)" }} 
          />
        </motion.div>

        <motion.div
          className="text-center space-y-2"
          animate={{
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <h2 className="text-3xl md:text-4xl font-black text-white"
            style={{
              textShadow: "0 0 20px rgba(255, 255, 255, 0.5)"
            }}
          >
            Your companion is evolving...
          </h2>
          <p className="text-lg text-white/80">
            Get ready for something amazing!
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};
