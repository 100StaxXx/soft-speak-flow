import { memo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Heart, Sparkles, AlertTriangle, RefreshCw, LucideIcon } from "lucide-react";
import { useCompanionDialogue, DialogueMood } from "@/hooks/useCompanionDialogue";
import { cn } from "@/lib/utils";

interface MoodConfig {
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

const moodConfig: Record<DialogueMood, MoodConfig> = {
  thriving: { icon: Sparkles, color: "text-cosmiq-glow", bgColor: "bg-cosmiq-glow/10" },
  content: { icon: MessageCircle, color: "text-celestial-blue", bgColor: "bg-celestial-blue/10" },
  concerned: { icon: AlertTriangle, color: "text-amber-400", bgColor: "bg-amber-400/10" },
  desperate: { icon: Heart, color: "text-destructive", bgColor: "bg-destructive/10" },
  recovering: { icon: RefreshCw, color: "text-green-400", bgColor: "bg-green-400/10" },
};

interface CompanionDialogueProps {
  className?: string;
  showBondInfo?: boolean;
}

export const CompanionDialogue = memo(({ className, showBondInfo = false }: CompanionDialogueProps) => {
  const { 
    greeting, 
    bondDialogue, 
    dialogueMood, 
    isLoading 
  } = useCompanionDialogue();
  
  const [displayText, setDisplayText] = useState(greeting);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Animate text change
  useEffect(() => {
    if (greeting !== displayText && !isAnimating) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayText(greeting);
        setIsAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [greeting, displayText, isAnimating]);
  
  if (isLoading) {
    return (
      <div className={cn("h-16 bg-card/30 rounded-xl animate-pulse", className)} />
    );
  }

  const config = moodConfig[dialogueMood];
  const IconComponent = config.icon;
  
  // Decide what secondary text to show
  const secondaryText = showBondInfo ? bondDialogue : null;

  return (
    <motion.div 
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/30",
        config.bgColor,
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
      
      <div className="relative p-4">
        <div className="flex items-start gap-3">
          {/* Mood icon */}
          <div className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            config.bgColor
          )}>
            <IconComponent className={cn("w-4 h-4", config.color)} />
          </div>
          
          {/* Dialogue text */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.p
                key={displayText}
                className="text-sm text-foreground/90 leading-relaxed"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
              >
                "{displayText}"
              </motion.p>
            </AnimatePresence>
            
            {/* Secondary text (bond dialogue) */}
            {secondaryText && (
              <motion.p
                className="text-xs text-muted-foreground mt-2 italic"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                "{secondaryText}"
              </motion.p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

CompanionDialogue.displayName = "CompanionDialogue";
