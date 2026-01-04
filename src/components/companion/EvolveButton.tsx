import { memo } from "react";
import { motion } from "framer-motion";
import { useEvolveLongPress } from "@/hooks/useEvolveLongPress";

interface EvolveButtonProps {
  onEvolve: () => void;
  isEvolving: boolean;
}

export const EvolveButton = memo(({ onEvolve, isEvolving }: EvolveButtonProps) => {
  const { progress, isHolding, handlers } = useEvolveLongPress({
    onComplete: onEvolve,
    duration: 1500,
    disabled: isEvolving,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="container py-4"
    >
      <button
        {...handlers}
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
          touch-none select-none
        "
        style={{
          background: "linear-gradient(135deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0080ff, #8000ff, #ff0080, #ff0000)",
          backgroundSize: "400% 400%",
          animation: "rainbow-shift 3s ease infinite, pulse-glow 2s ease-in-out infinite",
        }}
      >
        {/* Fill overlay - rises from bottom */}
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: "linear-gradient(to top, rgba(255,255,255,0.5), rgba(255,255,255,0.9))",
            clipPath: `inset(${100 - progress}% 0 0 0)`,
          }}
          animate={{
            opacity: isHolding ? 1 : 0,
          }}
          transition={{ duration: 0.1 }}
        />

        {/* Underglow effect - intensifies with progress */}
        <div 
          className="absolute inset-0 -z-10 blur-xl rounded-2xl transition-opacity duration-100"
          style={{
            background: "linear-gradient(135deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0080ff, #8000ff, #ff0080, #ff0000)",
            backgroundSize: "400% 400%",
            animation: "rainbow-shift 3s ease infinite",
            transform: "translateY(8px) scaleX(0.95)",
            opacity: 0.7 + (progress / 100) * 0.3,
          }}
        />
        
        {/* Inner glow overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-white/10 pointer-events-none" />
        
        {/* Content */}
        <span className="relative z-10 flex items-center justify-center gap-3">
          <span className="text-2xl">✨</span>
          <span>{isHolding ? "HOLD TO EVOLVE" : "EVOLVE"}</span>
          <span className="text-2xl">✨</span>
        </span>
      </button>
    </motion.div>
  );
});

EvolveButton.displayName = 'EvolveButton';
