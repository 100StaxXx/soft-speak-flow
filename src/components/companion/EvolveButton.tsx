import { memo } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface EvolveButtonProps {
  onEvolve: () => void;
  isEvolving: boolean;
}

export const EvolveButton = memo(({ onEvolve, isEvolving }: EvolveButtonProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="container py-4"
    >
      <button
        onClick={onEvolve}
        disabled={isEvolving}
        className="
          relative w-full py-5 rounded-2xl
          font-heading font-black text-3xl sm:text-4xl tracking-widest
          text-white uppercase
          overflow-hidden
          transition-transform duration-200
          hover:scale-[1.02] active:scale-[0.98]
          disabled:cursor-not-allowed disabled:opacity-80
          evolve-button-rainbow
        "
        style={{
          background: "linear-gradient(135deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0080ff, #8000ff, #ff0080, #ff0000)",
          backgroundSize: "400% 400%",
          animation: "rainbow-shift 3s ease infinite, pulse-glow 2s ease-in-out infinite",
        }}
      >
        {/* Underglow effect */}
        <div 
          className="absolute inset-0 -z-10 blur-xl opacity-70 rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0080ff, #8000ff, #ff0080, #ff0000)",
            backgroundSize: "400% 400%",
            animation: "rainbow-shift 3s ease infinite",
            transform: "translateY(8px) scaleX(0.95)",
          }}
        />
        
        {/* Inner glow overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-white/10 pointer-events-none" />
        
        {/* Content */}
        <span className="relative z-10 flex items-center justify-center gap-3">
          {isEvolving ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin" />
              <span>EVOLVING...</span>
            </>
          ) : (
            <>
              <span className="text-2xl">✨</span>
              <span>EVOLVE</span>
              <span className="text-2xl">✨</span>
            </>
          )}
        </span>
      </button>
    </motion.div>
  );
});

EvolveButton.displayName = 'EvolveButton';
