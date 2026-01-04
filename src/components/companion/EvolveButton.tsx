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
          relative w-full py-5 rounded-xl
          font-heading font-black text-3xl sm:text-4xl tracking-[0.35em]
          uppercase overflow-hidden
          transition-all duration-300
          hover:scale-[1.02] active:scale-[0.98]
          disabled:cursor-not-allowed disabled:opacity-70
          touch-none select-none
          border border-white/20
        "
        style={{
          background: `linear-gradient(90deg, 
            rgba(255,0,0,0.2), 
            rgba(255,64,0,0.2),
            rgba(255,128,0,0.2), 
            rgba(255,192,0,0.2),
            rgba(255,255,0,0.2), 
            rgba(128,255,0,0.2),
            rgba(0,255,0,0.2), 
            rgba(0,255,128,0.2),
            rgba(0,255,255,0.2), 
            rgba(0,128,255,0.2), 
            rgba(0,0,255,0.2),
            rgba(128,0,255,0.2), 
            rgba(255,0,255,0.2),
            rgba(255,0,128,0.2), 
            rgba(255,0,0,0.2)
          )`,
          backgroundSize: "300% 100%",
          animation: "rainbow-slide 3s linear infinite",
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

        {/* Shimmer sweep effect */}
        <div 
          className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
        >
          <div 
            className="absolute inset-0"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
              animation: "shimmer-sweep 2s ease-in-out infinite",
            }}
          />
        </div>

        {/* Star sparkle particles */}
        <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden">
          <div className="absolute w-3 h-3 bg-white star-sparkle-4 animate-sparkle-1" style={{ top: '20%', left: '15%' }} />
          <div className="absolute w-4 h-4 bg-white star-sparkle-4 animate-sparkle-2" style={{ top: '60%', left: '75%' }} />
          <div className="absolute w-3 h-3 bg-white star-sparkle-4 animate-sparkle-3" style={{ top: '40%', left: '45%' }} />
          <div className="absolute w-2 h-2 bg-white star-sparkle-4 animate-sparkle-4" style={{ top: '70%', left: '25%' }} />
          <div className="absolute w-3 h-3 bg-white star-sparkle-4 animate-sparkle-5" style={{ top: '30%', left: '85%' }} />
        </div>

        {/* Rainbow border glow */}
        <div 
          className="absolute inset-0 -z-10 rounded-xl opacity-60"
          style={{
            background: "linear-gradient(90deg, #ff0000, #ff4000, #ff8000, #ffc000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080, #ff0000)",
            backgroundSize: "300% 100%",
            animation: "rainbow-slide 3s linear infinite",
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
        
        {/* Content - use absolute positioning to prevent layout shift */}
        <div className="relative z-10 h-[1.2em]">
          <span 
            className={`absolute inset-0 flex items-center justify-center text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] transition-opacity duration-150 ${isHolding ? 'opacity-0' : 'opacity-100'}`}
            style={{
              textShadow: "0 0 20px rgba(255,255,255,0.5), 0 0 40px rgba(255,255,255,0.3)",
            }}
          >
            EVOLVE
          </span>
          <span 
            className={`absolute inset-0 flex items-center justify-center text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] transition-opacity duration-150 text-xl sm:text-2xl ${isHolding ? 'opacity-100' : 'opacity-0'}`}
            style={{
              textShadow: "0 0 20px rgba(255,255,255,0.5), 0 0 40px rgba(255,255,255,0.3)",
            }}
          >
            HOLD TO EVOLVE
          </span>
        </div>
      </button>
    </motion.div>
  );
});

EvolveButton.displayName = 'EvolveButton';
