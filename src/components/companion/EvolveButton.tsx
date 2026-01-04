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
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pt-4"
    >
      <button
        {...handlers}
        disabled={isEvolving}
        className="
          relative w-full py-4 rounded-xl
          font-heading font-black text-xl sm:text-2xl tracking-[0.2em]
          uppercase overflow-hidden
          transition-all duration-300
          hover:scale-[1.02] active:scale-[0.98]
          disabled:cursor-not-allowed disabled:opacity-70
          touch-none select-none
          border border-white/20
        "
        style={{
          background: `linear-gradient(135deg, 
            rgba(255,0,0,0.15), 
            rgba(255,128,0,0.15), 
            rgba(255,255,0,0.15), 
            rgba(0,255,0,0.15), 
            rgba(0,255,255,0.15), 
            rgba(0,128,255,0.15), 
            rgba(128,0,255,0.15), 
            rgba(255,0,128,0.15), 
            rgba(255,0,0,0.15)
          )`,
          backgroundSize: "400% 400%",
          animation: "rainbow-shift 4s ease infinite",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {/* Metallic sheen overlay */}
        <div 
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.15) 100%)",
          }}
        />

        {/* Rainbow border glow */}
        <div 
          className="absolute inset-0 -z-10 rounded-xl opacity-60"
          style={{
            background: "linear-gradient(135deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0080ff, #8000ff, #ff0080, #ff0000)",
            backgroundSize: "400% 400%",
            animation: "rainbow-shift 4s ease infinite",
            filter: "blur(8px)",
            transform: "scale(1.02)",
          }}
        />

        {/* Fill overlay - rises from bottom */}
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            background: "linear-gradient(to top, rgba(255,255,255,0.6), rgba(255,255,255,0.2))",
            clipPath: `inset(${100 - progress}% 0 0 0)`,
          }}
          animate={{
            opacity: isHolding ? 1 : 0,
          }}
          transition={{ duration: 0.1 }}
        />
        
        {/* Content */}
        <span 
          className="relative z-10 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
          style={{
            textShadow: "0 0 20px rgba(255,255,255,0.5), 0 0 40px rgba(255,255,255,0.3)",
          }}
        >
          {isHolding ? "HOLD TO EVOLVE" : "EVOLVE"}
        </span>
      </button>
    </motion.div>
  );
});

EvolveButton.displayName = 'EvolveButton';
