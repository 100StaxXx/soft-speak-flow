import { memo, useState, useEffect, useCallback, useMemo, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCompanionDialogue, DialogueMood } from "@/hooks/useCompanionDialogue";
import { useCompanion, type Companion } from "@/hooks/useCompanion";
import { useCompanionHealth } from "@/hooks/useCompanionHealth";
import { useCompanionExpressionState } from "@/hooks/useCompanionExpressionState";
import { useCompanionVisualState } from "@/hooks/useCompanionVisualState";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CompanionImage, CompanionPortraitShell } from "@/components/CompanionImage";
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
import { isNearEvolution } from "@/lib/companionEvolutionSignals";
import {
  getBundledCompanionImageFocalPoint,
  isCompanionPresetImageSource,
} from "@/lib/companionImageFocal";
import {
  resolveCompanionExpressiveAssetUrl,
  resolveCompanionVisualAssetUrl,
} from "@/lib/companionAssetResolver";

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

const NEAR_EVOLUTION_LINES = [
  "Chaos report: a new form is trying to kick the door down because apparently subtlety got murdered here.",
  "We are one good push away from a very dramatic upgrade, assuming you stop fumbling the layup.",
  "Something in me is winding up and it is already more organized than your whole current situation.",
  "One more clean move and I evolve in spectacular fashion while you act like this was your idea.",
  "My next form is pacing backstage waiting for you to quit stalling and touch the gas.",
] as const;

interface CompanionDialogueProps {
  className?: string;
  companionName?: string | null;
  companionOverride?: Companion | null;
  progressToNextOverride?: number;
  canEvolveOverride?: boolean;
}

const normalizeCompanionName = (value: string | null | undefined) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const hashSeed = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
};

export const CompanionDialogue = memo(({
  className,
  companionName,
  companionOverride,
  progressToNextOverride,
  canEvolveOverride,
}: CompanionDialogueProps) => {
  const {
    greeting,
    bondDialogue,
    microTitle,
    shimmerType,
    dialogueMood,
    isLoading,
    lineId,
    refreshDialogue,
  } = useCompanionDialogue();

  const {
    companion: rawCompanion,
    progressToNext: rawProgressToNext,
    canEvolve: rawCanEvolve,
  } = useCompanion();
  const { health } = useCompanionHealth();
  const expressionState = useCompanionExpressionState();
  const { isDormant } = useCompanionVisualState(
    health.moodState,
    health.hunger,
    health.happiness,
    health.isAlive,
    health.recoveryProgress,
  );
  const companion = companionOverride ?? rawCompanion;
  const progressToNext = progressToNextOverride ?? rawProgressToNext;
  const canEvolve = canEvolveOverride ?? rawCanEvolve;
  const { dismiss: dismissTalkPopup } = useTalkPopupContextSafe();
  const [fallbackToDefaultPortrait, setFallbackToDefaultPortrait] = useState(false);

  const normalCompanionImageUrl = useMemo(() => {
    if (!companion) return null;

    if (isDormant) {
      return resolveCompanionVisualAssetUrl(companion, "dormant");
    }
    if (health.isNeglected && health.neglectedImageUrl) {
      return health.neglectedImageUrl;
    }
    if (health.isNeglected) {
      return resolveCompanionVisualAssetUrl(companion, "neglected");
    }
    return resolveCompanionVisualAssetUrl(companion, "normal")
      ?? companion.current_image_url
      ?? null;
  }, [
    companion,
    health.isNeglected,
    health.neglectedImageUrl,
    isDormant,
  ]);

  const expressiveCompanionImageUrl = useMemo(() => {
    if (!companion || isDormant || health.isNeglected) {
      return null;
    }

    return resolveCompanionExpressiveAssetUrl(companion, {
      mood: expressionState.mood,
      variant: expressionState.variant,
    });
  }, [
    companion,
    expressionState.mood,
    expressionState.variant,
    health.isNeglected,
    isDormant,
  ]);

  const companionImageUrl = fallbackToDefaultPortrait || !expressiveCompanionImageUrl
    ? normalCompanionImageUrl
    : expressiveCompanionImageUrl;
  const bundledCompanionImageFocal = getBundledCompanionImageFocalPoint(companionImageUrl);
  const companionImageFocalX = isDormant
    ? companion?.dormant_image_focal_x ?? companion?.current_image_focal_x ?? null
    : health.isNeglected
      ? health.neglectedImageFocalX ?? companion?.neglected_image_focal_x ?? companion?.current_image_focal_x ?? null
      : bundledCompanionImageFocal?.x ?? companion?.current_image_focal_x ?? null;
  const companionImageFocalY = isDormant
    ? companion?.dormant_image_focal_y ?? companion?.current_image_focal_y ?? null
    : health.isNeglected
      ? health.neglectedImageFocalY ?? companion?.neglected_image_focal_y ?? companion?.current_image_focal_y ?? null
      : bundledCompanionImageFocal?.y ?? companion?.current_image_focal_y ?? null;
  const usesPortraitAvatar = isCompanionPresetImageSource(companionImageUrl);
  const cachedCompanionName =
    companion && companion.current_stage > 0
      ? normalizeCompanionName(companion.cached_creature_name)
      : null;
  const resolvedCompanionName =
    normalizeCompanionName(companionName)
    ?? cachedCompanionName
    ?? "Companion";

  const nearEvolution = isNearEvolution({ progressToNext, canEvolve });
  const nearEvolutionLine = useMemo(() => {
    if (!nearEvolution) return null;
    const seed = `${companion?.id ?? "companion"}:${companion?.current_stage ?? 0}:${lineId}`;
    const index = hashSeed(seed) % NEAR_EVOLUTION_LINES.length;
    return NEAR_EVOLUTION_LINES[index];
  }, [nearEvolution, companion?.id, companion?.current_stage, lineId]);

  const [displayText, setDisplayText] = useState(greeting);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const prefersReducedMotion =
    typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    setFallbackToDefaultPortrait(false);
  }, [expressiveCompanionImageUrl, isDormant, health.isNeglected]);

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
    refreshDialogue?.("idle", true);
    handleDialogOpenChange(true);
  }, [handleDialogOpenChange, refreshDialogue]);

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
        data-companion-expression-mood={expressionState.mood}
        data-companion-expression-variant={expressionState.variant}
        data-companion-expression-reason={expressionState.reason}
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
              <Avatar className={cn("h-10 w-10 rounded-lg", usesPortraitAvatar && "bg-transparent")}>
                {companionImageUrl ? (
                  usesPortraitAvatar ? (
                    <CompanionPortraitShell
                      src={companionImageUrl}
                      element={companion?.core_element}
                      className="h-full w-full rounded-lg"
                    >
                      <CompanionImage
                        variant="avatar"
                        src={companionImageUrl}
                        alt={resolvedCompanionName}
                        fit="portrait"
                        element={companion?.core_element}
                        focalX={companionImageFocalX}
                        focalY={companionImageFocalY}
                        className="rounded-lg"
                        onError={() => {
                          if (!fallbackToDefaultPortrait && expressiveCompanionImageUrl) {
                            setFallbackToDefaultPortrait(true);
                          }
                        }}
                      />
                    </CompanionPortraitShell>
                  ) : (
                    <CompanionImage
                      variant="avatar"
                      src={companionImageUrl}
                      alt={resolvedCompanionName}
                      focalX={companionImageFocalX}
                      focalY={companionImageFocalY}
                      className="object-cover"
                      onError={() => {
                        if (!fallbackToDefaultPortrait && expressiveCompanionImageUrl) {
                          setFallbackToDefaultPortrait(true);
                        }
                      }}
                    />
                  )
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
              {nearEvolutionLine ? (
                <p data-testid="companion-near-evolution-line" className="mt-2 text-xs italic text-primary/90">
                  {nearEvolutionLine}
                </p>
              ) : null}
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
              <Avatar className={cn("h-12 w-12 rounded-lg ring-2", config.ringColor, usesPortraitAvatar && "bg-transparent")}>
                {companionImageUrl ? (
                  usesPortraitAvatar ? (
                    <CompanionPortraitShell
                      src={companionImageUrl}
                      element={companion?.core_element}
                      className="h-full w-full rounded-lg"
                    >
                      <CompanionImage
                        variant="avatar"
                        src={companionImageUrl}
                        alt={resolvedCompanionName}
                        fit="portrait"
                        element={companion?.core_element}
                        focalX={companionImageFocalX}
                        focalY={companionImageFocalY}
                        className="rounded-lg"
                        onError={() => {
                          if (!fallbackToDefaultPortrait && expressiveCompanionImageUrl) {
                            setFallbackToDefaultPortrait(true);
                          }
                        }}
                      />
                    </CompanionPortraitShell>
                  ) : (
                    <CompanionImage
                      variant="avatar"
                      src={companionImageUrl}
                      alt={resolvedCompanionName}
                      focalX={companionImageFocalX}
                      focalY={companionImageFocalY}
                      className="object-cover"
                      onError={() => {
                        if (!fallbackToDefaultPortrait && expressiveCompanionImageUrl) {
                          setFallbackToDefaultPortrait(true);
                        }
                      }}
                    />
                  )
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
            {nearEvolutionLine ? (
              <p data-testid="companion-near-evolution-line-modal" className="text-xs italic text-primary/90">
                {nearEvolutionLine}
              </p>
            ) : null}
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
