import { memo, useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCompanionMemories } from "@/hooks/useCompanionMemories";
import { useCompanionPresence } from "@/contexts/CompanionPresenceContext";
import { useCompanionAuraColors } from "@/hooks/useCompanionAuraColors";
import { cn } from "@/lib/utils";

interface MemoryWhisperProps {
  className?: string;
  /** Chance to show a memory reference (0-1) */
  chance?: number;
}

/**
 * Displays occasional memory references from the companion.
 * Shows "Remember when..." style messages referencing past experiences.
 * Meant to be placed in the CompanionDialogue area or companion page.
 */
export const MemoryWhisper = memo(({ className, chance = 0.15 }: MemoryWhisperProps) => {
  const { getRandomMemory, getMemoryDialogue, referenceMemory, memories } = useCompanionMemories();
  const { presence } = useCompanionPresence();
  const { primaryAura } = useCompanionAuraColors();
  
  const [memoryLine, setMemoryLine] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Try to show a memory on mount if conditions are right
  useEffect(() => {
    // Don't show if companion is dormant or not present
    if (!presence.isPresent || presence.mood === 'dormant') return;
    
    // Don't show if no memories
    if (memories.length === 0) return;
    
    // Random chance check
    if (Math.random() > chance) return;

    // Delay slightly for better UX
    const timer = setTimeout(() => {
      const memory = getRandomMemory();
      if (memory) {
        const dialogue = getMemoryDialogue(memory);
        if (dialogue) {
          setMemoryLine(dialogue);
          setIsVisible(true);
          referenceMemory(memory.id);
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [memories.length, presence.isPresent, presence.mood, chance, getRandomMemory, getMemoryDialogue, referenceMemory]);

  if (!memoryLine || !isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "mt-2 p-2 rounded-lg",
          "bg-primary/5 border border-primary/10",
          className
        )}
        style={{
          boxShadow: `inset 0 0 20px ${primaryAura}15`,
        }}
      >
        <p className="text-xs text-muted-foreground italic">
          💭 "{memoryLine}"
        </p>
      </motion.div>
    </AnimatePresence>
  );
});

MemoryWhisper.displayName = 'MemoryWhisper';
