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
import type { CompanionShimmerType } from "@/config/companionDialoguePacks";

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

interface ShimmerConfig {
  borderClass: string;
  ringClass: string;
  accentClass: string;
  titleClass: string;
}

const shimmerConfig: Record<CompanionShimmerType, ShimmerConfig> = {
  none: {
    borderClass: "border-border/30",
    ringClass: "",
    accentClass: "",
    titleClass: "text-muted-foreground/80",
  },
  green: {
    borderClass: "border-emerald-300/45",
    ringClass: "ring-emerald-300/65",
    accentClass: "bg-emerald-300/10",
    titleClass: "text-emerald-200",
  },
  blue: {
    borderClass: "border-sky-300/45",
    ringClass: "ring-sky-300/65",
    accentClass: "bg-sky-300/10",
    titleClass: "text-sky-200",
  },
  purple: {
    borderClass: "border-violet-300/45",
    ringClass: "ring-violet-300/65",
    accentClass: "bg-violet-300/10",
    titleClass: "text-violet-200",
  },
  red: {
    borderClass: "border-rose-300/45",
    ringClass: "ring-rose-300/65",
    accentClass: "bg-rose-300/10",
    titleClass: "text-rose-200",
  },
  gold: {
    borderClass: "border-amber-300/50",
    ringClass: "ring-amber-300/70",
    accentClass: "bg-amber-300/10",
    titleClass: "text-amber-200",
  },
};

interface CompanionDialogueProps {
  className?: string;
  companionName?: string | null;
}

const normalizeCompanionName = (value: string | null | undefined) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const CompanionDialogue = memo(({ className, companionName }: CompanionDialogueProps) => {
  const { 
    greeting, 
    bondDialogue,
    microTitle,
    shimmerType,
    dialogueMood, 
    isLoading 
  } = useCompanionDialogue();
  
  const { companion } = useCompanion();
  const { dismiss: dismissTalkPopup } = useTalkPopupContextSafe();
  const companionImageUrl = companion?.current_image_url;
  const resolvedCompanionName =
    normalizeCompanionName(companionName)
    ?? normalizeCompanionName(companion?.cached_creature_name)
    ?? "Companion";
  
  const [displayText, setDisplayText] = useState(greeting);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const prefersReducedMotion =
    typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  
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
  const shimmer = shimmerConfig[shimmerType];
  const animateShimmer = shimmerType !== "none" && !prefersReducedMotion;
  const avatarRingClass = shimmerType === "none" ? config.ringColor : shimmer.ringClass;
  const eventHeader = microTitle?.trim() || "Companion Event";
  const hasMicroTitle = Boolean(microTitle?.trim());

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
      <motion.button
        type="button"
        data-testid="companion-dialogue-trigger"
        data-shimmer-type={shimmerType}
        className={cn(
          "relative w-full overflow-hidden rounded-xl border text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          shimmer.borderClass,
          config.bgColor,
          className,
        )}
        aria-label={`Open ${resolvedCompanionName} dialogue`}
        onClick={openDialogueModal}
        onKeyDown={handleTriggerKeyDown}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div
          data-testid="companion-dialogue-accent"
          className={cn(
            "pointer-events-none absolute inset-0 rounded-xl transition-colors",
            shimmer.accentClass,
            animateShimmer && "animate-pulse",
          )}
          aria-hidden="true"
        />
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
        
        <div className="relative p-4">
          <div className="flex items-start gap-3">
            {/* Companion portrait with mood-colored ring */}
            <div className={cn(
              "flex-shrink-0 rounded-lg overflow-hidden",
              "ring-2", avatarRingClass
            )}>
              <Avatar className="h-10 w-10 rounded-lg">
                {companionImageUrl ? (
                  <AvatarImage 
                    src={companionImageUrl} 
                    alt={resolvedCompanionName}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="rounded-lg bg-primary/20 text-primary">
                  {resolvedCompanionName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            
            {/* Dialogue text */}
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "mb-1 text-[11px] font-semibold uppercase tracking-[0.08em]",
                  hasMicroTitle ? shimmer.titleClass : "text-muted-foreground/80",
                )}
              >
                {eventHeader}
              </p>
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

      <DialogContent className={cn("max-w-md overflow-hidden p-0", shimmer.borderClass)}>
        <div className={cn("relative p-5", config.bgColor)}>
          <div
            data-testid="companion-dialogue-modal-accent"
            className={cn(
              "pointer-events-none absolute inset-0 transition-colors",
              shimmer.accentClass,
              animateShimmer && "animate-pulse",
            )}
            aria-hidden="true"
          />
          <div className="relative space-y-4">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-3">
              <Avatar className={cn("h-12 w-12 rounded-lg ring-2", config.ringColor)}>
                {companionImageUrl ? (
                  <AvatarImage
                    src={companionImageUrl}
                    alt={resolvedCompanionName}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="rounded-lg bg-primary/20 text-primary">
                  {resolvedCompanionName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <DialogTitle>{resolvedCompanionName}</DialogTitle>
                <DialogDescription className={cn("text-[11px] font-semibold uppercase tracking-[0.08em]", hasMicroTitle ? shimmer.titleClass : "text-muted-foreground/80")}>
                  {eventHeader}
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
        </div>
      </DialogContent>
    </Dialog>
  );
});

CompanionDialogue.displayName = "CompanionDialogue";
