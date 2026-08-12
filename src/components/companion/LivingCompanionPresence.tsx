import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Heart, Sparkles, X } from "lucide-react";
import type { ReactNode, SyntheticEvent } from "react";

import type {
  LivingCompanionBodyLanguage,
} from "@/config/livingCompanion";
import type { LivingCompanionPrompt } from "@/hooks/useLivingCompanionPresence";
import type {
  LivingCompanionGaze,
  LivingCompanionInteractionPoint,
} from "@/hooks/useLivingCompanionPresence";
import type {
  CompanionLifeAction,
  CompanionLifeStageProfile,
  CompanionSpeciesMotionProfile,
} from "@/config/companionLife";
import { cn } from "@/lib/utils";

interface LivingCompanionPresenceBubbleProps {
  prompt: LivingCompanionPrompt | null;
  companionName: string;
  prefersReducedMotion: boolean;
  onDismiss: () => void;
  onAnswer?: (optionId: string) => void;
}

const stopInteractionPropagation = (event: SyntheticEvent) => {
  event.stopPropagation();
};

export const LivingCompanionPresenceBubble = ({
  prompt,
  companionName,
  prefersReducedMotion,
  onDismiss,
  onAnswer,
}: LivingCompanionPresenceBubbleProps) => (
  <AnimatePresence mode="wait">
    {prompt ? (
      <motion.div
        key={prompt.id}
        data-testid="living-companion-prompt"
        data-prompt-kind={prompt.kind}
        className="absolute inset-x-3 bottom-3 z-40 rounded-[1.15rem] border border-white/55 bg-[#fffaf0]/95 p-3 text-left text-[#173323] shadow-[0_18px_44px_rgba(4,20,11,0.3)] backdrop-blur-xl"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
        transition={{ duration: prefersReducedMotion ? 0.01 : 0.24, ease: [0.22, 1, 0.36, 1] }}
        role="status"
        aria-live="polite"
        onMouseDown={stopInteractionPropagation}
        onTouchStart={stopInteractionPropagation}
        onClick={stopInteractionPropagation}
      >
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e7f0df] text-[#326642]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#54705d]">
              {prompt.kind === "question" ? `${companionName} wonders` : companionName}
            </p>
            <p className="mt-1 text-[13px] font-medium leading-[1.35rem] text-[#173323]">
              {prompt.message}
            </p>
          </div>
          <button
            type="button"
            className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#54705d] transition-colors hover:bg-[#dfe9d8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#326642]"
            aria-label="Dismiss companion message"
            onClick={(event) => {
              event.stopPropagation();
              onDismiss();
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {prompt.kind === "question" && prompt.options?.length ? (
          <div className="mt-2 grid grid-cols-2 gap-2 pl-8 pr-8" role="group" aria-label="Companion response choices">
            {prompt.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="min-h-11 rounded-xl border border-[#326642]/15 bg-[#e7f0df]/75 px-2.5 py-2 text-xs font-semibold text-[#285238] transition-colors hover:bg-[#dce9d4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#326642]"
                onClick={(event) => {
                  event.stopPropagation();
                  onAnswer?.(option.id);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

        <span
          className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-white/55 bg-[#fffaf0]/95"
          aria-hidden="true"
        />
      </motion.div>
    ) : null}
  </AnimatePresence>
);

interface LivingCompanionInteractionAuraProps {
  bodyLanguage: LivingCompanionBodyLanguage;
  interactionNonce: number;
  prefersReducedMotion: boolean;
  gaze?: LivingCompanionGaze;
  interactionPoint?: LivingCompanionInteractionPoint;
  activeAction?: CompanionLifeAction;
  stage?: number;
}

const AURA_DOTS = [
  { left: "22%", top: "30%", delay: 0 },
  { left: "74%", top: "28%", delay: 0.04 },
  { left: "18%", top: "70%", delay: 0.08 },
  { left: "78%", top: "67%", delay: 0.12 },
] as const;

export const LivingCompanionInteractionAura = ({
  bodyLanguage,
  interactionNonce,
  prefersReducedMotion,
  gaze = { x: 0, y: 0, active: false },
  interactionPoint = { x: 50, y: 50 },
  activeAction = "breathe",
  stage = 1,
}: LivingCompanionInteractionAuraProps) => (
  <div
    className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-2xl"
    data-testid="living-companion-interaction-aura"
    data-body-language={bodyLanguage}
    data-life-action={activeAction}
    aria-hidden="true"
  >
    <div
      className={cn("living-companion-gaze absolute inset-0", `living-companion-gaze--${bodyLanguage}`)}
      style={{
        backgroundPosition: `${50 + gaze.x * 12}% ${42 + gaze.y * 8}%`,
        transform: gaze.active ? `translate3d(${gaze.x * 3}px, ${gaze.y * 2}px, 0)` : undefined,
      }}
    />
    {!prefersReducedMotion ? (
      <span
        className="living-companion-life-signal absolute rounded-full"
        data-testid="living-companion-life-signal"
        style={{ opacity: Math.min(0.14 + stage * 0.025, 0.32) }}
      />
    ) : null}
    {!prefersReducedMotion && activeAction === "signature" ? (
      <div className="living-companion-signature-effect absolute inset-[8%] rounded-full" data-testid="living-companion-signature-effect">
        <span className="living-companion-signature-ring absolute inset-[12%] rounded-full" />
        <span className="living-companion-signature-rays absolute inset-0 rounded-full" />
      </div>
    ) : null}
    {!prefersReducedMotion && (activeAction === "play" || activeAction === "celebrate") ? (
      <div className="absolute inset-0" data-testid="living-companion-play-effect">
        {AURA_DOTS.map((dot, index) => (
          <Sparkles
            key={`play-${dot.left}-${dot.top}`}
            className="living-companion-play-spark absolute h-4 w-4 text-[#fff1a8]"
            style={{ left: dot.left, top: dot.top, animationDelay: `${index * 0.12}s` }}
          />
        ))}
      </div>
    ) : null}
    {!prefersReducedMotion && activeAction === "nuzzle" ? (
      <div className="absolute inset-0" data-testid="living-companion-nuzzle-effect">
        {["38%", "50%", "62%"].map((left, index) => (
          <Heart
            key={left}
            className="living-companion-nuzzle-heart absolute h-3.5 w-3.5 fill-[#fff2bd] text-[#fff2bd]"
            style={{ left, top: "34%", animationDelay: `${index * 0.1}s` }}
          />
        ))}
      </div>
    ) : null}
    {interactionNonce > 0 && !prefersReducedMotion ? (
      <div key={interactionNonce} className="absolute inset-0">
        <span
          className="living-companion-touch-ring absolute"
          style={{ left: `${interactionPoint.x}%`, top: `${interactionPoint.y}%` }}
        />
        {AURA_DOTS.map((dot) => (
          <span
            key={`${dot.left}-${dot.top}`}
            className="living-companion-touch-spark absolute h-1.5 w-1.5 rounded-full bg-[#fff4b6]"
            style={{
              left: dot.left,
              top: dot.top,
              animationDelay: `${dot.delay}s`,
            }}
          />
        ))}
      </div>
    ) : null}
  </div>
);

const getLifeActionMotion = (
  action: CompanionLifeAction,
  strength: number,
): Record<string, number | number[]> => {
  const lift = 4 + strength * 5;
  const turn = 0.8 + strength * 1.2;
  switch (action) {
    case "look-around":
      return { x: [0, -3 - strength * 2, 3 + strength * 2, 0], rotate: [0, -turn, turn, 0], scale: [1, 1.008, 1.008, 1] };
    case "weight-shift":
      return { x: [0, -2, 2, 0], y: [0, 1, 0], rotate: [0, -turn * 0.5, turn * 0.5, 0] };
    case "stretch":
      return { y: [0, -lift * 0.35, 2, 0], scaleX: [1, 1.018, 0.995, 1], scaleY: [1, 1.035, 0.99, 1] };
    case "listen":
      return { y: [0, -2, -2, 0], rotate: [0, -turn * 1.4, -turn * 1.4, 0], scale: [1, 1.01, 1.01, 1] };
    case "greet":
      return { y: [0, -lift, 1, -lift * 0.35, 0], rotate: [0, -turn, turn * 0.5, 0], scale: [1, 1.025, 0.995, 1.01, 1] };
    case "nuzzle":
      return { x: [0, -3, -6, -3, 0], y: [0, -1, 1, 0], rotate: [0, -turn, -turn * 1.4, 0], scale: [1, 1.015, 1.025, 1] };
    case "play":
      return { y: [0, -lift, 0, -lift * 0.65, 0], rotate: [0, -turn, turn, -turn * 0.4, 0], scale: [1, 1.03, 0.99, 1.02, 1] };
    case "celebrate":
      return { y: [0, -lift * 1.15, 0, -lift * 0.8, 0], rotate: [0, -turn * 1.2, turn * 1.2, 0], scale: [1, 1.045, 1, 1.03, 1] };
    case "settle":
      return { y: [0, 2, 1, 2, 0], scale: [1, 0.992, 1.006, 0.996, 1], rotate: [0, -turn * 0.3, 0] };
    case "signature":
      return { y: [0, -lift * 0.7, -lift * 1.25, 0], x: [0, -3, 3, 0], rotate: [0, -turn * 1.6, turn * 1.8, 0], scale: [1, 1.035, 1.065, 1] };
    case "breathe":
    default:
      return { y: [0, -1 - strength, 0], scale: [1, 1.006 + strength * 0.008, 1] };
  }
};

interface LivingCompanionCreatureMotionProps {
  children: ReactNode;
  activeAction: CompanionLifeAction;
  gaze: LivingCompanionGaze;
  lifeStage: CompanionLifeStageProfile;
  speciesMotion: CompanionSpeciesMotionProfile;
  prefersReducedMotion: boolean;
}

export const LivingCompanionCreatureMotion = ({
  children,
  activeAction,
  gaze,
  lifeStage,
  speciesMotion,
  prefersReducedMotion,
}: LivingCompanionCreatureMotionProps) => {
  const duration = activeAction === "breathe" ? 4.8 : activeAction === "signature" ? 2.6 : 1.8;
  return (
    <motion.div
      className="h-full w-full"
      data-testid="living-companion-creature-motion"
      data-life-action={activeAction}
      data-life-stage={lifeStage.visualStage}
      data-species={speciesMotion.speciesId ?? speciesMotion.presetId ?? "custom"}
      animate={prefersReducedMotion ? undefined : getLifeActionMotion(activeAction, lifeStage.motionStrength)}
      transition={{
        duration,
        repeat: activeAction === "breathe" ? Infinity : 0,
        ease: activeAction === "signature" ? [0.16, 1, 0.3, 1] : "easeInOut",
      }}
      style={{ transformOrigin: speciesMotion.motionOrigin }}
    >
      <motion.div
        className="h-full w-full"
        animate={prefersReducedMotion
          ? undefined
          : {
              x: gaze.active ? gaze.x * 4.5 : 0,
              y: gaze.active ? gaze.y * 2.5 : 0,
              rotateY: gaze.active ? gaze.x * 1.4 : 0,
              rotateX: gaze.active ? gaze.y * -0.8 : 0,
            }}
        transition={{ type: "spring", stiffness: 125, damping: 20, mass: 0.7 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

interface LivingCompanionWorldPulseProps {
  lifeStage: CompanionLifeStageProfile;
  speciesMotion: CompanionSpeciesMotionProfile;
  stateLabel: string;
  activeActionLabel: string;
}

export const LivingCompanionWorldPulse = ({
  lifeStage,
  speciesMotion,
  stateLabel,
  activeActionLabel,
}: LivingCompanionWorldPulseProps) => (
  <div
    className="rounded-2xl border border-primary/15 bg-background/35 p-4 backdrop-blur-sm"
    data-testid="companion-world-pulse"
  >
    <div className="flex items-start gap-3">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <BookOpen className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary/80">
          World chapter {lifeStage.visualStage + 1}
        </p>
        <p className="mt-0.5 font-heading text-base font-bold text-foreground">
          {lifeStage.chapterTitle}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {lifeStage.chapterSummary}
        </p>
      </div>
    </div>
    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
      <div className="rounded-xl border border-primary/10 bg-primary/[0.05] px-3 py-2">
        <p className="font-semibold text-foreground">Alive now</p>
        <p className="mt-0.5 text-muted-foreground">{activeActionLabel} • {stateLabel}</p>
      </div>
      <div className="rounded-xl border border-primary/10 bg-primary/[0.05] px-3 py-2">
        <p className="flex items-center gap-1 font-semibold text-foreground">
          <Heart className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Bond awakening
        </p>
        <p className="mt-0.5 text-muted-foreground">
          {lifeStage.visualStage >= 4 ? speciesMotion.signatureDescription : lifeStage.bondPromise}
        </p>
      </div>
    </div>
  </div>
);
