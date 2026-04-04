import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Sparkles } from "lucide-react";
import { haptics } from "@/utils/haptics";
import { supabase } from "@/integrations/supabase/client";
import { playEvolutionStart, playEvolutionSuccess } from "@/utils/soundEffects";
import { globalAudio } from "@/utils/globalAudio";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EvolutionErrorFallback } from "@/components/ErrorFallback";
import { getEvolutionTheme, type EvoTheme, type ParticleStyle } from "@/config/evolutionThemes";
import { logger } from "@/utils/logger";
import { useMotionProfile } from "@/hooks/useMotionProfile";
import { CompanionMotionLayer } from "@/components/companion/motion/CompanionMotionLayer";
import { useCompanionMotionSafe } from "@/contexts/CompanionMotionContext";
import { getProgressionLevelDisplay } from "@/config/progression";
import type { CompanionMotionEvent } from "@/config/companionMotion";

interface CompanionEvolutionProps {
  isEvolving: boolean;
  previousStage: number;
  newStage: number;
  previousImageUrl: string;
  newImageUrl: string;
  mentorSlug?: string;
  userId?: string;
  element?: string;
  onComplete: () => void;
}

type EvolutionPhase = "hold" | "charge" | "conceal" | "strobe" | "reveal" | "settle";
type PreloadStatus = "idle" | "loading" | "loaded" | "error";

interface ArtReadiness {
  previous: PreloadStatus;
  next: PreloadStatus;
  ready: boolean;
}

const FULL_SEQUENCE_MS = {
  hold: 800,
  charge: 3200,
  conceal: 600,
  strobe: 900,
  reveal: 2400,
  settle: 1600,
  dismissBuffer: 3000,
} as const;

const REDUCED_SEQUENCE_MS = {
  hold: 150,
  charge: 280,
  conceal: 150,
  strobe: 0,
  reveal: 500,
  settle: 480,
  dismissBuffer: 120,
} as const;

const EMERGENCY_EXIT_DELAY_MS = 15_000;
const IMAGE_PRELOAD_TIMEOUT_MS = 2_000;

const log = logger.scope("CompanionEvolution");

const ConvergenceParticles = ({
  phase,
  particleStyle,
  particleCount,
}: {
  phase: EvolutionPhase;
  particleStyle: ParticleStyle;
  particleCount: number;
}) => {
  const particles = useMemo(
    () =>
      Array.from({ length: particleCount }, (_, index) => ({
        id: index,
        angle: (index / particleCount) * Math.PI * 2,
        startRadius: 190,
      })),
    [particleCount],
  );

  if (phase !== "charge" && phase !== "conceal") {
    return null;
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      data-testid="evolution-convergence-particles"
    >
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className={`absolute w-2 h-2 evo-particle evo-particle-${particleStyle}`}
          initial={{
            x: Math.cos(particle.angle) * particle.startRadius,
            y: Math.sin(particle.angle) * particle.startRadius,
            opacity: 0.2,
            scale: 0.65,
          }}
          animate={phase === "charge"
            ? {
              x: Math.cos(particle.angle) * 40,
              y: Math.sin(particle.angle) * 40,
              opacity: 0.74,
              scale: 0.96,
            }
            : {
              x: 0,
              y: 0,
              opacity: 0.15,
              scale: 0.16,
            }}
          transition={{
            duration: phase === "charge" ? 0.82 : 0.22,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      ))}
    </div>
  );
};

const HatchingOverlay = ({
  phase,
  show,
  flashGlow,
}: {
  phase: EvolutionPhase;
  show: boolean;
  flashGlow: string;
}) => {
  if (!show) return null;

  const isDrawing = phase === "charge" || phase === "conceal";
  const isBursting = phase === "conceal";

  return (
    <div
      className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center"
      data-testid="evolution-hatching-overlay"
    >
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{
          opacity: phase === "hold" ? 0.38 : phase === "charge" ? 0.56 : phase === "conceal" ? 0.22 : 0,
        }}
        transition={{ duration: 0.28 }}
        style={{
          background:
            "radial-gradient(ellipse 60% 72% at 50% 50%, transparent 38%, hsl(40 52% 18% / 0.94) 100%)",
        }}
      />

      <svg className="absolute w-full h-full" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
        <motion.path
          d="M200 100 L210 150 L195 180 L205 220 L190 280"
          fill="none"
          stroke="hsl(50 100% 82%)"
          strokeWidth="3"
          className={isDrawing ? "evo-crack-path drawing" : "evo-crack-path"}
          initial={{ opacity: 0 }}
          animate={{ opacity: isDrawing ? 1 : 0 }}
          style={{ filter: `drop-shadow(0 0 8px ${flashGlow})` }}
        />
        <motion.path
          d="M200 100 L185 155 L200 190 L180 240 L195 300"
          fill="none"
          stroke="hsl(50 100% 82%)"
          strokeWidth="2"
          className={isDrawing ? "evo-crack-path drawing delay-100" : "evo-crack-path"}
          initial={{ opacity: 0 }}
          animate={{ opacity: isDrawing ? 1 : 0 }}
          style={{ filter: `drop-shadow(0 0 6px ${flashGlow})` }}
        />
        <motion.path
          d="M200 100 L220 140 L210 200 L230 260"
          fill="none"
          stroke="hsl(50 100% 82%)"
          strokeWidth="2"
          className={isDrawing ? "evo-crack-path drawing delay-150" : "evo-crack-path"}
          initial={{ opacity: 0 }}
          animate={{ opacity: isDrawing ? 1 : 0 }}
          style={{ filter: `drop-shadow(0 0 6px ${flashGlow})` }}
        />
      </svg>

      {isBursting && (
        <>
          <motion.div
            className="absolute left-1/2 top-1/2 h-56 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
            initial={{ opacity: 0, scaleY: 0.2 }}
            animate={{ opacity: [0, 1, 0], scaleY: [0.2, 1, 1.25] }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            style={{
              background: `linear-gradient(180deg, transparent 0%, ${flashGlow} 45%, transparent 100%)`,
              filter: "blur(6px)",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            {Array.from({ length: 8 }).map((_, index) => (
              <motion.div
                key={index}
                className="absolute h-4 w-3 rounded-sm bg-gradient-to-br from-amber-50 to-amber-200"
                initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos((index / 8) * Math.PI * 2) * 145,
                  y: Math.sin((index / 8) * Math.PI * 2) * 118 + 26,
                  rotate: (index % 2 === 0 ? 1 : -1) * 110,
                  opacity: 0,
                  scale: 0.34,
                }}
                transition={{
                  duration: 0.9,
                  ease: "easeOut",
                  delay: index * 0.015,
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const CompanionEvolutionContent = ({
  isEvolving,
  previousStage,
  newStage,
  previousImageUrl,
  newImageUrl,
  mentorSlug,
  userId,
  element,
  onComplete,
}: CompanionEvolutionProps) => {
  const [phase, setPhase] = useState<EvolutionPhase>("hold");
  const [voiceLine, setVoiceLine] = useState("");
  const [isLoadingVoice, setIsLoadingVoice] = useState(false);
  const [canDismiss, setCanDismiss] = useState(false);
  const [showEmergencyExit, setShowEmergencyExit] = useState(false);
  const [artReadiness, setArtReadiness] = useState<ArtReadiness>({
    previous: "idle",
    next: "idle",
    ready: false,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const emergencyTimeoutRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const animationKeyRef = useRef<string | null>(null);
  const voiceRequestKeyRef = useRef<string | null>(null);
  const voicePlayedRef = useRef(false);
  const dismissHandledRef = useRef(false);

  const isFirstEvolution = newStage === 1;
  const theme: EvoTheme = useMemo(
    () => getEvolutionTheme(element, isFirstEvolution),
    [element, isFirstEvolution],
  );
  const levelDisplay = useMemo(() => getProgressionLevelDisplay(newStage), [newStage]);
  const { profile, capabilities, signals } = useMotionProfile();
  const { triggerEvent } = useCompanionMotionSafe();
  const prefersReducedMotion = profile === "reduced" || signals.prefersReducedMotion;
  const sequence = prefersReducedMotion ? REDUCED_SEQUENCE_MS : FULL_SEQUENCE_MS;
  const convergenceParticleCount = Math.max(4, Math.min(12, Math.round(capabilities.maxParticles * 0.5)));
  const confettiParticleCount = profile === "enhanced"
    ? theme.confettiParticleCount
    : Math.min(theme.confettiParticleCount, 88);
  const evolutionMotionEvent = useMemo<CompanionMotionEvent>(
    () => ({
      id: `evolution-${phase}-${newStage}`,
      type: phase === "reveal" || phase === "settle" ? "evolution_reveal" : "evolution_start",
      intensity: isFirstEvolution || newStage >= 56 ? "heroic" : "medium",
      durationMs: 0,
      createdAt: 0,
      element: element ?? null,
      stage: newStage,
      reason: null,
    }),
    [element, isFirstEvolution, newStage, phase],
  );

  const previousDisplayImageUrl = artReadiness.previous === "loaded" ? previousImageUrl : null;
  const revealDisplayImageUrl = artReadiness.next === "loaded"
    ? newImageUrl
    : artReadiness.previous === "loaded"
      ? previousImageUrl
      : newImageUrl || previousImageUrl;
  const hasDualArt = Boolean(
    previousDisplayImageUrl
      && revealDisplayImageUrl
      && previousDisplayImageUrl !== revealDisplayImageUrl
      && artReadiness.next === "loaded",
  );
  const silhouetteStrobeEnabled = hasDualArt && !prefersReducedMotion;
  const revealDelayMs =
    sequence.hold
    + sequence.charge
    + sequence.conceal
    + (silhouetteStrobeEnabled ? sequence.strobe : 0);

  const anticipationTitle = isFirstEvolution ? "Something Stirs Within..." : "The Light Gathers...";
  const celebrationTitle = isFirstEvolution ? "Hatched!" : "Evolved!";
  const celebrationDescription = isFirstEvolution
    ? "Your companion has emerged."
    : `Your companion reached ${levelDisplay}.`;

  const cleanupAudio = useCallback(() => {
    if (!audioRef.current) return;

    try {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = "";
    } catch (error) {
      log.error("Error cleaning up audio", { error });
    } finally {
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isEvolving) {
      animationKeyRef.current = null;
      voiceRequestKeyRef.current = null;
      return;
    }

    let active = true;
    let previousSettled = !previousImageUrl;
    let nextSettled = !newImageUrl;

    setArtReadiness({
      previous: previousImageUrl ? "loading" : "error",
      next: newImageUrl ? "loading" : "error",
      ready: false,
    });

    const maybeComplete = () => {
      if (!active || (!previousSettled || !nextSettled)) return;

      setArtReadiness((current) => ({
        ...current,
        ready: true,
      }));
    };

    const markSettled = (kind: "previous" | "next", status: Exclude<PreloadStatus, "idle" | "loading">) => {
      if (!active) return;

      setArtReadiness((current) => ({
        ...current,
        [kind]: status,
      }));

      if (kind === "previous") {
        previousSettled = true;
      } else {
        nextSettled = true;
      }

      maybeComplete();
    };

    const preload = (url: string | null | undefined, kind: "previous" | "next") => {
      if (!url) {
        markSettled(kind, "error");
        return;
      }

      const image = new Image();
      image.onload = () => markSettled(kind, "loaded");
      image.onerror = () => markSettled(kind, "error");
      image.src = url;
    };

    preload(previousImageUrl, "previous");
    preload(newImageUrl, "next");

    const timeoutId = window.setTimeout(() => {
      if (!active) return;

      setArtReadiness((current) => ({
        previous: current.previous === "loading" ? "error" : current.previous,
        next: current.next === "loading" ? "error" : current.next,
        ready: true,
      }));
      previousSettled = true;
      nextSettled = true;
    }, IMAGE_PRELOAD_TIMEOUT_MS);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [isEvolving, newImageUrl, previousImageUrl]);

  useEffect(() => {
    if (!isEvolving || !artReadiness.ready) return;

    const requestKey = [
      previousStage,
      newStage,
      previousImageUrl,
      newImageUrl,
      mentorSlug ?? "none",
      userId ?? "none",
    ].join("::");

    if (voiceRequestKeyRef.current === requestKey) return;
    voiceRequestKeyRef.current = requestKey;

    setVoiceLine("");
    cleanupAudio();
    voicePlayedRef.current = false;

    if (!mentorSlug || !userId) {
      setIsLoadingVoice(false);
      return;
    }

    let cancelled = false;
    setIsLoadingVoice(true);

    supabase.functions
      .invoke("generate-evolution-voice", {
        body: { mentorSlug, newStage, userId, isFirstEvolution },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) throw error;

        if (data?.voiceLine) {
          setVoiceLine(data.voiceLine);
        } else {
          setVoiceLine(
            isFirstEvolution
              ? "A new companion stands beside you."
              : "A new form answers your companion's growth.",
          );
        }

        if (data?.audioContent) {
          audioRef.current = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        log.error("Failed to generate evolution voice", { error });
        setVoiceLine(
          isFirstEvolution
            ? "A new companion stands beside you."
            : "A new form answers your companion's growth.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingVoice(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    artReadiness.ready,
    cleanupAudio,
    isEvolving,
    isFirstEvolution,
    mentorSlug,
    newImageUrl,
    newStage,
    previousImageUrl,
    previousStage,
    userId,
  ]);

  useEffect(() => {
    if (!isEvolving || !artReadiness.ready) return;

    const animationKey = [
      previousStage,
      newStage,
      previousImageUrl,
      newImageUrl,
      prefersReducedMotion ? "reduced" : "full",
    ].join("::");

    if (animationKeyRef.current === animationKey) return;
    animationKeyRef.current = animationKey;
    dismissHandledRef.current = false;

    const queueTimeout = (callback: () => void, delay: number) => {
      const timeoutId = window.setTimeout(callback, delay);
      timersRef.current.push(timeoutId);
      return timeoutId;
    };

    setPhase("hold");
    setCanDismiss(false);
    setShowEmergencyExit(false);

    emergencyTimeoutRef.current = window.setTimeout(() => {
      log.info("Evolution modal timeout reached, showing emergency exit");
      setShowEmergencyExit(true);
    }, EMERGENCY_EXIT_DELAY_MS);

    queueTimeout(() => {
      setPhase("charge");
      playEvolutionStart();
      haptics.light();
    }, sequence.hold);

    queueTimeout(() => {
      setPhase("conceal");
      haptics.heavy();

      if (!prefersReducedMotion) {
        containerRef.current?.classList.add("animate-evolution-pulse-hit");
        queueTimeout(() => {
          containerRef.current?.classList.remove("animate-evolution-pulse-hit");
        }, 600);
      }
    }, sequence.hold + sequence.charge);

    if (silhouetteStrobeEnabled) {
      queueTimeout(() => {
        setPhase("strobe");
      }, sequence.hold + sequence.charge + sequence.conceal);
    }

    queueTimeout(() => {
      setPhase("reveal");
      triggerEvent({
        type: "evolution_reveal",
        intensity: isFirstEvolution || newStage >= 56 ? "heroic" : "medium",
        element: element ?? null,
        stage: newStage,
      });
      playEvolutionSuccess();

      if (!prefersReducedMotion) {
        confetti({
          particleCount: confettiParticleCount,
          spread: theme.confettiSpread,
          origin: { y: 0.52 },
          colors: theme.confettiColors,
          ticks: 340,
          gravity: theme.confettiGravity,
          scalar: isFirstEvolution ? 1.4 : 1.22,
          drift: 0,
        });
        haptics.medium();
      }
    }, revealDelayMs);

    queueTimeout(() => {
      setPhase("settle");
    }, revealDelayMs + sequence.reveal);

    queueTimeout(() => {
      setCanDismiss(true);
    }, revealDelayMs + sequence.reveal + sequence.dismissBuffer);

    return () => {
      timersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timersRef.current = [];
      if (emergencyTimeoutRef.current) {
        window.clearTimeout(emergencyTimeoutRef.current);
        emergencyTimeoutRef.current = null;
      }
      containerRef.current?.classList.remove("animate-evolution-pulse-hit");
    };
  }, [
    artReadiness.ready,
    confettiParticleCount,
    element,
    isEvolving,
    isFirstEvolution,
    newImageUrl,
    newStage,
    prefersReducedMotion,
    previousImageUrl,
    previousStage,
    revealDelayMs,
    sequence,
    silhouetteStrobeEnabled,
    theme,
    triggerEvent,
  ]);

  useEffect(() => {
    if (phase !== "settle" || isLoadingVoice || !audioRef.current || voicePlayedRef.current || globalAudio.getMuted()) {
      return;
    }

    voicePlayedRef.current = true;
    audioRef.current.play().catch((error) => {
      log.error("Audio play failed", { error });
      voicePlayedRef.current = false;
    });
  }, [isLoadingVoice, phase]);

  useEffect(() => () => {
    timersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    if (emergencyTimeoutRef.current) {
      window.clearTimeout(emergencyTimeoutRef.current);
    }
    cleanupAudio();
  }, [cleanupAudio]);

  const finishEvolution = useCallback(() => {
    if (dismissHandledRef.current) return;
    dismissHandledRef.current = true;

    cleanupAudio();
    if (emergencyTimeoutRef.current) {
      window.clearTimeout(emergencyTimeoutRef.current);
      emergencyTimeoutRef.current = null;
    }

    window.dispatchEvent(new CustomEvent("companion-evolved"));
    window.dispatchEvent(new CustomEvent("evolution-complete"));
    window.dispatchEvent(new CustomEvent("evolution-modal-closed"));

    onComplete();
  }, [cleanupAudio, onComplete]);

  const handleDismiss = (event: React.MouseEvent) => {
    if (!canDismiss) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    finishEvolution();
  };

  const handleEmergencyExit = () => {
    log.info("Emergency exit triggered");
    finishEvolution();
  };

  if (!isEvolving) return null;

  if (!artReadiness.ready) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="text-primary text-xl font-medium"
        >
          Preparing evolution...
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {isEvolving && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          role="alertdialog"
          aria-labelledby="evolution-title"
          aria-describedby="evolution-description"
          className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden gpu-layer ${canDismiss ? "cursor-pointer" : ""}`}
          onClick={handleDismiss}
          onTouchStart={(event) => !canDismiss && event.preventDefault()}
          data-phase={phase}
          data-reduced-motion={prefersReducedMotion ? "true" : "false"}
          style={{
            pointerEvents: "auto",
            touchAction: canDismiss ? "auto" : "none",
            background: isFirstEvolution
              ? "radial-gradient(circle at center, rgba(58, 44, 6, 0.82) 0%, rgba(0, 0, 0, 0.96) 66%, black 100%)"
              : "radial-gradient(circle at center, rgba(8, 10, 22, 0.82) 0%, rgba(0, 0, 0, 0.96) 70%, black 100%)",
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
            paddingLeft: "env(safe-area-inset-left)",
            paddingRight: "env(safe-area-inset-right)",
            ["--evo-glow-a" as string]: theme.glowA,
            ["--evo-glow-b" as string]: theme.glowB,
          }}
        >
          <motion.div
            className="absolute inset-[-10%] pointer-events-none"
            initial={false}
            animate={{
              opacity: phase === "hold" ? 0.18 : phase === "charge" ? 0.32 : phase === "conceal" ? 0.68 : 0.46,
              scale: phase === "conceal" ? 1.08 : 1,
            }}
            transition={{ duration: 0.35 }}
            style={{
              background: `radial-gradient(circle at 50% 45%, hsl(${theme.glowA} / ${0.2 * theme.glowStrength}) 0%, hsl(${theme.glowB} / ${0.14 * theme.glowStrength}) 38%, transparent 72%)`,
            }}
          />

          {!prefersReducedMotion && (phase === "reveal" || phase === "settle") && (
            <motion.div
              className="absolute inset-0 pointer-events-none evo-glow"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{
                opacity: [0.25 * theme.glowStrength, 0.42 * theme.glowStrength, 0.25 * theme.glowStrength],
                scale: [1, 1.08, 1],
              }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          <CompanionMotionLayer
            variant="evolution"
            stage={newStage}
            element={element}
            event={evolutionMotionEvent}
            className="absolute inset-0 z-[1]"
          />

          {!prefersReducedMotion && (
            <ConvergenceParticles
              phase={phase}
              particleStyle={theme.particleStyle}
              particleCount={convergenceParticleCount}
            />
          )}

          {isFirstEvolution && (
            <HatchingOverlay
              phase={phase}
              show={phase === "charge" || phase === "conceal"}
              flashGlow={theme.flashGlow}
            />
          )}

          <div className="relative z-10 flex w-full max-w-5xl flex-col items-center justify-center gap-8 px-6">
            <AnimatePresence mode="wait">
              {(phase === "hold" || phase === "charge" || phase === "conceal") && (
                <motion.div
                  key={`anticipation-${phase}`}
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.02, y: -10 }}
                  transition={{ duration: 0.28 }}
                  className="text-center"
                >
                  <h2
                    id="evolution-title"
                    className="text-3xl font-black tracking-[0.18em] text-white sm:text-4xl md:text-5xl"
                    style={{
                      textShadow: `0 0 28px hsl(${theme.glowA}), 0 0 56px hsl(${theme.glowB} / 0.48)`,
                    }}
                  >
                    {anticipationTitle}
                  </h2>
                  <p
                    id="evolution-description"
                    className="mt-3 text-sm font-medium uppercase tracking-[0.28em] text-white/70 sm:text-base"
                  >
                    {phase === "hold" ? "A new form is drawing near" : "The transformation takes shape"}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <div
              className="relative flex w-full items-center justify-center"
              style={{
                minHeight: "min(54vh, 470px)",
              }}
            >
              <div
                className="relative flex w-full max-w-[580px] items-center justify-center"
                data-testid="evolution-art-stage"
                data-art-presentation={hasDualArt ? "swap" : "single"}
                data-strobe-enabled={silhouetteStrobeEnabled ? "true" : "false"}
                style={{
                  height: "min(54vh, 470px)",
                  ["--evo-strobe-duration" as string]: `${sequence.strobe / 1000}s`,
                }}
              >
                <motion.div
                  className="absolute inset-[10%] rounded-full pointer-events-none"
                  initial={false}
                  animate={{
                    opacity: phase === "conceal"
                      ? 0.95
                      : phase === "strobe"
                        ? 0.72
                      : phase === "reveal"
                        ? 0.65
                        : phase === "charge"
                          ? 0.28
                          : 0,
                    scale: phase === "conceal" ? 1.24 : phase === "strobe" ? 1.16 : phase === "reveal" ? 1.4 : 0.72,
                  }}
                  transition={{
                    duration: phase === "conceal" ? sequence.conceal / 1000 : 0.42,
                    ease: "easeOut",
                  }}
                  style={{
                    background: `radial-gradient(circle, ${theme.flashCore} 0%, ${theme.flashGlow} 35%, transparent 72%)`,
                    filter: "blur(18px)",
                    mixBlendMode: "screen",
                  }}
                />

                {silhouetteStrobeEnabled && phase === "strobe" && (
                  <div
                    className="absolute inset-[10%] rounded-full pointer-events-none evo-silhouette-strobe-stage"
                    style={{
                      background: `radial-gradient(circle, ${theme.flashCore} 0%, ${theme.flashGlow} 42%, transparent 74%)`,
                      filter: "blur(20px)",
                      mixBlendMode: "screen",
                    }}
                  />
                )}

                {!prefersReducedMotion && phase === "reveal" && (
                  <motion.div
                    className="absolute inset-[8%] pointer-events-none overflow-hidden rounded-[2rem]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  >
                    <motion.div
                      className="absolute inset-y-0 w-1/2"
                      initial={{ x: "-120%" }}
                      animate={{ x: "240%" }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        background:
                          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.42) 48%, transparent 100%)",
                        filter: "blur(6px)",
                      }}
                    />
                  </motion.div>
                )}

                {hasDualArt && previousDisplayImageUrl && (
                  <motion.img
                    key={`previous-art-${previousDisplayImageUrl}`}
                    src={previousDisplayImageUrl}
                    alt={`Companion before evolving at stage ${previousStage}`}
                    data-testid="evolution-previous-art"
                    className={`absolute inset-0 h-full w-full rounded-[2rem] object-cover shadow-2xl ${
                      phase === "strobe" && silhouetteStrobeEnabled ? "evo-silhouette-strobe-old" : ""
                    }`}
                    initial={false}
                    animate={{
                      opacity: phase === "reveal" || phase === "settle" ? 0 : 1,
                      scale: phase === "hold" ? 1 : phase === "charge" ? 1.04 : phase === "strobe" ? 1.09 : 1.09,
                      filter: phase === "conceal" || phase === "strobe"
                        ? "brightness(0) saturate(0) contrast(1.45) blur(4px)"
                        : phase === "charge"
                          ? "brightness(1.14) saturate(1.12) contrast(1.02) blur(0px)"
                          : "brightness(1) saturate(1) contrast(1) blur(0px)",
                    }}
                    transition={{
                      duration: phase === "conceal" ? sequence.conceal / 1000 : phase === "strobe" ? 0 : 0.34,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    style={{
                      border: `2px solid hsl(${theme.glowA} / 0.34)`,
                      boxShadow: `0 0 28px hsl(${theme.glowA} / 0.24)`,
                    }}
                  />
                )}

                {revealDisplayImageUrl ? (
                  <motion.img
                    key={`reveal-art-${revealDisplayImageUrl}`}
                    src={revealDisplayImageUrl}
                    alt={`Companion after evolving at stage ${newStage}`}
                    data-testid="evolution-reveal-art"
                    className={`absolute inset-0 h-full w-full rounded-[2rem] object-cover shadow-2xl ${
                      phase === "strobe" && silhouetteStrobeEnabled ? "evo-silhouette-strobe-new" : ""
                    }`}
                    initial={false}
                    animate={hasDualArt
                      ? {
                        opacity: phase === "strobe" || phase === "reveal" || phase === "settle" ? 1 : 0,
                        scale: phase === "strobe" ? 1.12 : phase === "reveal" ? 1.07 : phase === "settle" ? 1 : 1.16,
                        filter: phase === "reveal"
                          ? "brightness(1.16) saturate(1.08) contrast(1.05) blur(0px)"
                          : phase === "settle"
                            ? "brightness(1) saturate(1) contrast(1) blur(0px)"
                            : "brightness(0) saturate(0) contrast(1.7) blur(10px)",
                      }
                      : {
                        opacity: 1,
                        scale: phase === "hold"
                          ? 1
                          : phase === "charge"
                            ? 1.03
                            : phase === "conceal"
                              ? 1.08
                              : phase === "reveal"
                                ? 1.05
                                : 1,
                        filter: phase === "conceal"
                          ? "brightness(0) saturate(0) contrast(1.45) blur(5px)"
                          : phase === "reveal"
                            ? "brightness(1.14) saturate(1.1) contrast(1.04) blur(0px)"
                            : phase === "charge"
                              ? "brightness(1.08) saturate(1.05) contrast(1.02) blur(0px)"
                              : "brightness(1) saturate(1) contrast(1) blur(0px)",
                      }}
                    transition={{
                      duration:
                        phase === "reveal"
                          ? sequence.reveal / 1000
                          : phase === "conceal"
                            ? sequence.conceal / 1000
                            : phase === "strobe"
                              ? 0
                            : 0.34,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    style={{
                      border: `3px solid hsl(${theme.glowA} / ${phase === "reveal" || phase === "settle" ? 0.62 : 0.24})`,
                      boxShadow:
                        phase === "reveal" || phase === "settle"
                          ? `0 0 54px ${theme.revealBurstColor}, inset 0 0 26px hsl(${theme.glowB} / 0.18)`
                          : `0 0 24px hsl(${theme.glowA} / 0.18)`,
                    }}
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 text-white/70"
                    data-testid="evolution-art-fallback"
                  >
                    Evolution complete
                  </div>
                )}

                {(phase === "reveal" || phase === "settle") && (
                  <>
                    <Sparkles
                      className="absolute -left-4 -top-4 h-10 w-10 text-white/80"
                      style={{ filter: `drop-shadow(0 0 14px ${theme.revealBurstColor})` }}
                    />
                    <Sparkles
                      className="absolute -right-4 -top-4 h-10 w-10 text-white/80"
                      style={{ filter: `drop-shadow(0 0 14px ${theme.revealBurstColor})` }}
                    />
                    <Sparkles
                      className="absolute -bottom-4 -left-4 h-10 w-10 text-white/70"
                      style={{ filter: `drop-shadow(0 0 12px ${theme.revealBurstColor})` }}
                    />
                    <Sparkles
                      className="absolute -bottom-4 -right-4 h-10 w-10 text-white/70"
                      style={{ filter: `drop-shadow(0 0 12px ${theme.revealBurstColor})` }}
                    />
                  </>
                )}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {(phase === "reveal" || phase === "settle") && (
                <motion.div
                  key={`celebration-${phase}`}
                  initial={{ opacity: 0, y: 18, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 1.02 }}
                  transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  className="text-center"
                >
                  <motion.h1
                    id="evolution-title"
                    className="text-4xl font-black uppercase tracking-[0.18em] sm:text-5xl md:text-6xl"
                    style={{
                      background: `linear-gradient(135deg, ${theme.flashCore}, hsl(${theme.glowA}), hsl(${theme.glowB}), ${theme.flashCore})`,
                      backgroundSize: "200% 200%",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      filter: `drop-shadow(0 0 20px ${theme.revealBurstColor})`,
                    }}
                    animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                    transition={{ duration: 3.8, repeat: Infinity, ease: "linear" }}
                  >
                    {celebrationTitle}
                  </motion.h1>
                  <p
                    id="evolution-description"
                    className="mt-3 text-lg font-semibold text-white/90 sm:text-xl md:text-2xl"
                    style={{ textShadow: "0 0 16px rgba(255,255,255,0.34)" }}
                  >
                    {celebrationDescription}
                  </p>
                  <p className="mt-2 text-sm font-medium uppercase tracking-[0.28em] text-white/60 sm:text-base">
                    {levelDisplay}
                  </p>

                  {phase === "settle" && voiceLine && (
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.14, duration: 0.32 }}
                      className="mx-auto mt-5 max-w-xl"
                    >
                      <div
                        className="rounded-2xl border border-white/15 bg-white/8 px-5 py-4 text-left backdrop-blur-md"
                        style={{
                          boxShadow: `0 12px 34px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255,255,255,0.08)`,
                        }}
                      >
                        <p className="text-base font-medium italic leading-relaxed text-white/94 sm:text-lg">
                          "{voiceLine}"
                        </p>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {canDismiss && !showEmergencyExit && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
                >
                  <motion.p
                    className="text-base font-medium text-white/90 sm:text-lg"
                    animate={{ opacity: [0.58, 1, 0.58] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                  >
                    Tap anywhere to continue
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            {showEmergencyExit && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute z-[10002]"
                style={{
                  top: "calc(1rem + env(safe-area-inset-top, 0px))",
                  right: "calc(1rem + env(safe-area-inset-right, 0px))",
                }}
              >
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleEmergencyExit();
                  }}
                  className="rounded-lg bg-destructive/90 px-4 py-2 font-bold text-destructive-foreground shadow-lg transition-colors hover:bg-destructive"
                  aria-label="Close evolution modal"
                >
                  Close
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const CompanionEvolution = (props: CompanionEvolutionProps) => (
  <ErrorBoundary fallback={<EvolutionErrorFallback onClose={props.onComplete} />}>
    <CompanionEvolutionContent {...props} />
  </ErrorBoundary>
);
