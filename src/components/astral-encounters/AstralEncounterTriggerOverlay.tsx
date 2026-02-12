import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Swords, Zap } from "lucide-react";
import { AdversaryTier } from "@/types/astralEncounters";
import { playEncounterTrigger } from "@/utils/soundEffects";

interface AstralEncounterTriggerOverlayProps {
  isVisible: boolean;
  tier?: AdversaryTier;
  onComplete: () => void;
}

const TIER_COLORS: Record<AdversaryTier, { primary: string; secondary: string; glow: string }> = {
  common: { primary: 'hsl(var(--muted))', secondary: 'hsl(var(--muted-foreground))', glow: 'rgba(156, 163, 175, 0.5)' },
  uncommon: { primary: 'hsl(142, 76%, 46%)', secondary: 'hsl(142, 76%, 60%)', glow: 'rgba(34, 197, 94, 0.5)' },
  rare: { primary: 'hsl(217, 91%, 60%)', secondary: 'hsl(217, 91%, 75%)', glow: 'rgba(59, 130, 246, 0.5)' },
  epic: { primary: 'hsl(271, 91%, 65%)', secondary: 'hsl(271, 91%, 80%)', glow: 'rgba(168, 85, 247, 0.5)' },
  legendary: { primary: 'hsl(38, 92%, 50%)', secondary: 'hsl(38, 92%, 70%)', glow: 'rgba(245, 158, 11, 0.5)' },
};

export const AstralEncounterTriggerOverlay = ({ 
  isVisible, 
  tier = 'common',
  onComplete 
}: AstralEncounterTriggerOverlayProps) => {
  const colors = TIER_COLORS[tier];
  const hasSoundPlayed = useRef(false);
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionScheduledRef = useRef(false);

  // Play trigger sound when encounter starts
  useEffect(() => {
    if (isVisible && !hasSoundPlayed.current) {
      hasSoundPlayed.current = true;
      playEncounterTrigger();
    }
    
    if (!isVisible) {
      hasSoundPlayed.current = false;
      completionScheduledRef.current = false;
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
        completionTimeoutRef.current = null;
      }
    }
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
        completionTimeoutRef.current = null;
      }
    };
  }, []);

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onAnimationComplete={() => {
        // Auto-complete after animation sequence.
        if (completionScheduledRef.current) return;
        completionScheduledRef.current = true;
        completionTimeoutRef.current = setTimeout(() => {
          completionTimeoutRef.current = null;
          onComplete();
        }, 2500);
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{ 
        background: `linear-gradient(135deg, hsl(var(--background)) 0%, ${colors.primary}20 50%, hsl(var(--background)) 100%)`,
        pointerEvents: 'auto', 
        touchAction: 'none' 
      }}
    >
      {/* Animated cosmic background waves */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at center, ${colors.glow} 0%, transparent 70%)`,
        }}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Secondary pulse ring */}
      <motion.div
        className="absolute w-96 h-96 rounded-full border-2"
        style={{ borderColor: colors.primary }}
        initial={{ scale: 0, opacity: 1 }}
        animate={{ 
          scale: [0, 3, 3],
          opacity: [1, 0.5, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeOut"
        }}
      />

      {/* Tertiary pulse ring */}
      <motion.div
        className="absolute w-64 h-64 rounded-full border"
        style={{ borderColor: colors.secondary }}
        initial={{ scale: 0, opacity: 1 }}
        animate={{ 
          scale: [0, 4, 4],
          opacity: [1, 0.3, 0],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          delay: 0.3,
          ease: "easeOut"
        }}
      />

      {/* Rising particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(40)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: i % 2 === 0 ? colors.primary : colors.secondary,
              boxShadow: `0 0 8px ${colors.glow}`
            }}
            initial={{
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 400),
              y: (typeof window !== 'undefined' ? window.innerHeight : 800) + 50,
            }}
            animate={{
              y: -50,
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 400),
              scale: [0, 1.5, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1.2 + Math.random() * 1.3,
              repeat: Infinity,
              delay: Math.random() * 1.5,
            }}
          />
        ))}
      </div>

      {/* Swirling energy particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={`swirl-${i}`}
            className="absolute w-3 h-3 rounded-full"
            style={{
              backgroundColor: colors.secondary,
              boxShadow: `0 0 12px ${colors.glow}`,
              left: '50%',
              top: '50%',
            }}
            animate={{
              x: [0, Math.cos(i * 30 * Math.PI / 180) * 150, 0],
              y: [0, Math.sin(i * 30 * Math.PI / 180) * 150, 0],
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.1,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* Central content */}
      <div className="flex flex-col items-center gap-6 relative z-10">
        {/* Crossed swords icon with dramatic animation */}
        <motion.div
          className="relative"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 200, 
            damping: 15,
            delay: 0.2 
          }}
        >
          {/* Glow behind icon */}
          <motion.div
            className="absolute inset-0 rounded-full blur-xl"
            style={{ backgroundColor: colors.glow }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          
          {/* Icon container */}
          <motion.div
            className="relative p-6 rounded-full"
            style={{ 
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              boxShadow: `0 0 40px ${colors.glow}`
            }}
            animate={{
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Swords 
              className="w-16 h-16 text-white" 
              style={{ filter: "drop-shadow(0 0 10px white)" }}
            />
          </motion.div>

          {/* Lightning bolts */}
          <motion.div
            className="absolute -top-4 -right-4"
            animate={{
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: 0.5,
            }}
          >
            <Zap className="w-8 h-8" style={{ color: colors.secondary, filter: `drop-shadow(0 0 8px ${colors.glow})` }} />
          </motion.div>
          <motion.div
            className="absolute -bottom-4 -left-4"
            animate={{
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: 0.8,
            }}
          >
            <Zap className="w-8 h-8" style={{ color: colors.secondary, filter: `drop-shadow(0 0 8px ${colors.glow})` }} />
          </motion.div>
        </motion.div>

        {/* Text content */}
        <motion.div
          className="text-center space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <motion.h2 
            className="text-3xl md:text-4xl font-black text-foreground"
            style={{
              textShadow: `0 0 30px ${colors.glow}`
            }}
            animate={{
              opacity: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            Astral Entity Detected!
          </motion.h2>
          <motion.p 
            className="text-lg text-muted-foreground"
            animate={{
              opacity: [0.6, 1, 0.6],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            Prepare for battle...
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  );
};
