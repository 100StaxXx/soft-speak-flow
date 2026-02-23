import { memo, useState, useEffect, useCallback, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCompanionDialogue, DialogueMood } from "@/hooks/useCompanionDialogue";
import { useCompanion } from "@/hooks/useCompanion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTalkPopupContextSafe } from "@/contexts/TalkPopupContext";
import { cn } from "@/lib/utils";

interface MoodConfig {
  color: string;
  ringColor: string;
  bgColor: string;
}

const moodConfig: Record<DialogueMood, MoodConfig> = {
  thriving: { color: "text-cosmiq-glow", ringColor: "ring-cosmiq-glow/50", bgColor: "bg-cosmiq-glow/10" },
  content: { color: "text-celestial-blue", ringColor: "ring-celestial-blue/50", bgColor: "bg-celestial-blue/10" },
  concerned: { color: "text-amber-400", ringColor: "ring-amber-400/50", bgColor: "bg-amber-400/10" },
  desperate: { color: "text-destructive", ringColor: "ring-destructive/50", bgColor: "bg-destructive/10" },
  recovering: { color: "text-green-400", ringColor: "ring-green-400/50", bgColor: "bg-green-400/10" },
};

interface CompanionDialogueProps {
  className?: string;
}

export const CompanionDialogue = memo(({ className }: CompanionDialogueProps) => {
  const { 
    greeting, 
    bondDialogue,
    dialogueMood, 
    isLoading 
  } = useCompanionDialogue();
  
  const { companion } = useCompanion();
  const { dismiss: dismissTalkPopup } = useTalkPopupContextSafe();
  const companionImageUrl = companion?.current_image_url;
  const companionName = companion?.spirit_animal || "Companion";
  
  const [displayText, setDisplayText] = useState(greeting);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
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
  
  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (open) {
      dismissTalkPopup();
    }
    setIsDialogOpen(open);
  }, [dismissTalkPopup]);

  const openDialogueModal = useCallback(() => {
    handleDialogOpenChange(true);
  }, [handleDialogOpenChange]);

  const handleTriggerKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openDialogueModal();
  }, [openDialogueModal]);

  if (isLoading) {
    return (
      <div className={cn("h-16 bg-card/30 rounded-xl animate-pulse", className)} />
    );
  }

  const config = moodConfig[dialogueMood];

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
      <motion.button
        type="button"
        className={cn(
          "relative w-full overflow-hidden rounded-xl border border-border/30 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          config.bgColor,
          className,
        )}
        aria-label={`Open ${companionName} dialogue`}
        onClick={openDialogueModal}
        onKeyDown={handleTriggerKeyDown}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
        
        <div className="relative p-4">
          <div className="flex items-start gap-3">
            {/* Companion portrait with mood-colored ring */}
            <div className={cn(
              "flex-shrink-0 rounded-lg overflow-hidden",
              "ring-2", config.ringColor
            )}>
              <Avatar className="h-10 w-10 rounded-lg">
                {companionImageUrl ? (
                  <AvatarImage 
                    src={companionImageUrl} 
                    alt={companionName}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="rounded-lg bg-primary/20 text-primary">
                  {companionName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
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
            </div>
          </div>
        </div>
      </motion.button>

      <DialogContent className="max-w-md overflow-hidden border-border/60 p-0">
        <div className={cn("space-y-4 p-5", config.bgColor)}>
          <DialogHeader className="text-left">
            <div className="flex items-center gap-3">
              <Avatar className={cn("h-12 w-12 rounded-lg ring-2", config.ringColor)}>
                {companionImageUrl ? (
                  <AvatarImage
                    src={companionImageUrl}
                    alt={companionName}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="rounded-lg bg-primary/20 text-primary">
                  {companionName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <DialogTitle>{companionName}</DialogTitle>
                <DialogDescription>
                  Companion dialogue
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 rounded-lg border border-border/50 bg-background/20 p-4">
            <p className="text-sm leading-relaxed text-foreground">
              "{displayText}"
            </p>
            {bondDialogue ? (
              <p className="text-sm leading-relaxed text-foreground/80">
                {bondDialogue}
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

CompanionDialogue.displayName = "CompanionDialogue";
