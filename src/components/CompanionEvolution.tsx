import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Sparkles } from "lucide-react";
import { haptics } from "@/utils/haptics";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EvolutionErrorFallback } from "@/components/ErrorFallback";
import { getEvolutionTheme, type EvoTheme, type ParticleStyle } from "@/config/evolutionThemes";
import { logger } from "@/utils/logger";
import { useMotionProfile } from "@/hooks/useMotionProfile";
import { CompanionMotionLayer } from "@/components/companion/motion/CompanionMotionLayer";
import { useCompanionMotionSafe } from "@/contexts/CompanionMotionContext";
import { getProgressionLevelDisplay } from "@/config/progression";
import type { CompanionMotionEvent } from "@/config/companionMotion";
import { getCompanionHatchVideoUrl } from "@/config/companionHatchVideos";
import { globalAudio } from "@/utils/globalAudio";
import { CompanionImage } from "@/components/CompanionImage";

interface CompanionEvolutionProps {
  isEvolving: boolean;
  previousStage: number;
  newStage: number;
  previousImageUrl: string;
  newImageUrl: string;
  animationVideoUrl?: string | null;
  presetId?: string;
  element?: string;
  onComplete: () => void;
}

type EvolutionPhase = "hold" | "charge" | "conceal" | "strobe" | "apex" | "reveal" | "settle";
type PreloadStatus = "idle" | "loading" | "loaded" | "error";

interface ArtReadiness {
  previous: PreloadStatus;
  next: PreloadStatus;
  ready: boolean;
}

interface MappedHatchVideoPolicyInput {
  isFirstEvolution: boolean;
  presetId?: string | null;
  hatchVideoUrl: string | null;
  disableHatchVideo: boolean;
}

interface SilhouetteStrobePolicyInput {
  hasDualArt: boolean;
  prefersReducedMotion: boolean;
  useHatchVideo: boolean;
}

const FULL_SEQUENCE_MS = {
  hold: 800,
  charge: 3200,
  conceal: 850,
  strobe: 2920,
  apex: 340,
  reveal: 2400,
  settle: 1600,
  dismissBuffer: 3000,
} as const;

const REDUCED_SEQUENCE_MS = {
  hold: 150,
  charge: 280,
  conceal: 150,
  strobe: 0,
  apex: 0,
  reveal: 500,
  settle: 480,
  dismissBuffer: 120,
} as const;

const EMERGENCY_EXIT_DELAY_MS = 15_000;
const IMAGE_PRELOAD_TIMEOUT_MS = 2_000;
const HATCH_INTRO_MIN_MS = 800;
const HATCH_FOREGROUND_STAGE_MAX_WIDTH_PX = 560;
const HATCH_FOREGROUND_STAGE_MAX_HEIGHT_PX = 700;
const STROBE_BEAT_OFFSETS_MS = [
  0,
  350,
  685,
  1005,
  1305,
  1585,
  1845,
  2085,
  2305,
  2495,
  2660,
  2800,
] as const;
const STROBE_PULSE_INTERVAL = 4;
const LAST_STROBE_BEAT_INDEX = STROBE_BEAT_OFFSETS_MS.length - 1;

const shouldUseMappedPresetHatchVideo = ({
  isFirstEvolution,
  presetId,
  hatchVideoUrl,
  disableHatchVideo,
}: MappedHatchVideoPolicyInput): boolean => (
  isFirstEvolution
  && typeof presetId === "string"
  && presetId.trim().length > 0
  && Boolean(hatchVideoUrl)
  && !disableHatchVideo
);

const shouldUseSilhouetteStrobe = ({
  hasDualArt,
  prefersReducedMotion,
  useHatchVideo,
}: SilhouetteStrobePolicyInput): boolean => (
  hasDualArt
  && !prefersReducedMotion
  && !useHatchVideo
);

const log = logger.scope("CompanionEvolution");

const HatchIntroSplash = () => (
  <div
    className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black"
    data-testid="evolution-hatch-intro"
    style={{
      paddingTop: "env(safe-area-inset-top)",
      paddingBottom: "env(safe-area-inset-bottom)",
      paddingLeft: "env(safe-area-inset-left)",
      paddingRight: "env(safe-area-inset-right)",
      background:
        "radial-gradient(circle at center, rgba(58, 44, 6, 0.68) 0%, rgba(0, 0, 0, 0.94) 58%, black 100%)",
    }}
  >
    <motion.div
      className="absolute inset-[-15%] pointer-events-none"
      animate={{ opacity: [0.32, 0.58, 0.32], scale: [0.96, 1.04, 0.96] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      style={{
        background:
          "radial-gradient(circle at 50% 40%, rgba(255, 196, 94, 0.28) 0%, rgba(255, 214, 143, 0.12) 28%, transparent 64%)",
      }}
    />

    <div className="relative z-10 flex max-w-md flex-col items-center gap-5 px-6 text-center">
      <motion.div
        className="h-28 w-28 rounded-full border border-amber-200/30"
        animate={{ scale: [0.94, 1.04, 0.94], opacity: [0.46, 0.86, 0.46] }}
        transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(circle at 50% 35%, rgba(255, 229, 169, 0.72) 0%, rgba(245, 158, 11, 0.22) 48%, rgba(0, 0, 0, 0) 75%)",
          boxShadow: "0 0 48px rgba(251, 191, 36, 0.18)",
        }}
      />
      <div className="space-y-3">
        <h2 className="text-3xl font-black uppercase tracking-[0.18em] text-amber-300 sm:text-4xl">
          Opening the hatchery...
        </h2>
        <p className="text-base font-medium text-white/82 sm:text-lg">
          Your companion is getting ready to emerge.
        </p>
      </div>
    </div>
  </div>
);

const ConvergenceParticles = ({
  phase,
  particleStyle,
  particleCount,
  strobeBeatIndex,
}: {
  phase: EvolutionPhase;
  particleStyle: ParticleStyle;
  particleCount: number;
  strobeBeatIndex: number | null;
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

  if (phase !== "charge" && phase !== "conceal" && phase !== "strobe" && phase !== "apex") {
    return null;
  }

  const strobeProgress = strobeBeatIndex === null ? 0 : strobeBeatIndex / LAST_STROBE_BEAT_INDEX;
  const targetRadius = phase === "charge"
    ? 40
    : phase === "conceal"
      ? 14
      : phase === "strobe"
        ? Math.max(2, 18 - strobeProgress * 14)
        : 0;
  const targetOpacity = phase === "charge"
    ? 0.74
    : phase === "conceal"
      ? 0.18
      : phase === "strobe"
        ? Math.max(0.08, 0.28 - strobeProgress * 0.14)
        : 0.04;
  const targetScale = phase === "charge"
    ? 0.96
    : phase === "conceal"
      ? 0.18
      : phase === "strobe"
        ? Math.max(0.06, 0.26 - strobeProgress * 0.16)
        : 0.02;

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
              opacity: targetOpacity,
              scale: targetScale,
            }
            : {
              x: Math.cos(particle.angle) * targetRadius,
              y: Math.sin(particle.angle) * targetRadius,
              opacity: targetOpacity,
              scale: targetScale,
            }}
          transition={{
            duration: phase === "charge" ? 0.82 : phase === "strobe" ? 0.16 : 0.22,
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
  animationVideoUrl,
  presetId,
  element,
  onComplete,
}: CompanionEvolutionProps) => {
  const [phase, setPhase] = useState<EvolutionPhase>("hold");
  const [canDismiss, setCanDismiss] = useState(false);
  const [showEmergencyExit, setShowEmergencyExit] = useState(false);
  const [strobeBeatIndex, setStrobeBeatIndex] = useState<number | null>(null);
  const [artReadiness, setArtReadiness] = useState<ArtReadiness>({
    previous: "idle",
    next: "idle",
    ready: false,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const emergencyTimeoutRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const animationKeyRef = useRef<string | null>(null);
  const dismissHandledRef = useRef(false);
  const hatchVideoRef = useRef<HTMLVideoElement | null>(null);
  const hatchVideoBackdropRef = useRef<HTMLVideoElement | null>(null);
  const animationVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isHatchVideoMuted, setIsHatchVideoMuted] = useState(() => globalAudio.getMuted());
  const [disableHatchVideo, setDisableHatchVideo] = useState(false);
  const [hatchIntroComplete, setHatchIntroComplete] = useState(false);
  const [animationVideoReady, setAnimationVideoReady] = useState(false);
  const [animationVideoFailed, setAnimationVideoFailed] = useState(false);

  const isFirstEvolution = newStage === 1;
  const hatchVideoUrl = useMemo(
    () => getCompanionHatchVideoUrl({ presetId, element }),
    [element, presetId],
  );
  const useHatchVideo = shouldUseMappedPresetHatchVideo({
    isFirstEvolution,
    presetId,
    hatchVideoUrl,
    disableHatchVideo,
  });
  const theme: EvoTheme = useMemo(
    () => getEvolutionTheme(element, isFirstEvolution),
    [element, isFirstEvolution],
  );
  const levelDisplay = useMemo(() => getProgressionLevelDisplay(newStage), [newStage]);
  const { profile, capabilities, signals } = useMotionProfile();
  const { triggerEvent } = useCompanionMotionSafe();
  const prefersReducedMotion = profile === "reduced" || signals.prefersReducedMotion;
  const sequence = prefersReducedMotion ? REDUCED_SEQUENCE_MS : FULL_SEQUENCE_MS;
  const shouldRenderAnimationVideo = Boolean(animationVideoUrl) && !useHatchVideo && !prefersReducedMotion;
  const shouldUseAnimationVideo = shouldRenderAnimationVideo && animationVideoReady && !animationVideoFailed;
  const showAnimationVideo = shouldUseAnimationVideo && (phase === "reveal" || phase === "settle");
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
  const silhouetteStrobeEnabled = shouldUseSilhouetteStrobe({
    hasDualArt,
    prefersReducedMotion,
    useHatchVideo,
  });
  const strobeDelayMs = silhouetteStrobeEnabled ? sequence.strobe + sequence.apex : 0;
  const revealDelayMs =
    sequence.hold
    + sequence.charge
    + sequence.conceal
    + strobeDelayMs;
  const strobeTarget = phase === "strobe"
    ? (strobeBeatIndex ?? 0) % 2 === 0
      ? "previous"
      : "next"
    : phase === "apex" || phase === "reveal" || phase === "settle"
      ? "next"
      : "none";
  const strobeProgress = phase === "strobe" && strobeBeatIndex !== null
    ? strobeBeatIndex / LAST_STROBE_BEAT_INDEX
    : phase === "apex"
      ? 1
      : 0;

  const anticipationTitle = isFirstEvolution ? "Something Stirs Within..." : "The Light Gathers...";
  const celebrationTitle = isFirstEvolution ? "Hatched!" : "Evolved!";
  const celebrationDescription = isFirstEvolution
    ? "Your companion has emerged."
    : `Your companion reached ${levelDisplay}.`;

  const showHatchIntro = isFirstEvolution && !hatchIntroComplete;
  const shouldStartCinematic = artReadiness.ready && (!isFirstEvolution || hatchIntroComplete);
  const firstHatchImageFit = isFirstEvolution ? "portrait" : "cover";

  useEffect(() => {
    setDisableHatchVideo(false);
  }, [element, isEvolving, newImageUrl, presetId, previousImageUrl]);

  useEffect(() => {
    setAnimationVideoReady(false);
    setAnimationVideoFailed(false);

    const videoElement = animationVideoRef.current;
    if (videoElement) {
      videoElement.pause();
      videoElement.currentTime = 0;
    }
  }, [animationVideoUrl, isEvolving]);

  useEffect(() => {
    if (!isEvolving) {
      setHatchIntroComplete(false);
      return;
    }

    if (!isFirstEvolution) {
      setHatchIntroComplete(true);
      return;
    }

    setHatchIntroComplete(false);

    const timeoutId = window.setTimeout(() => {
      setHatchIntroComplete(true);
    }, HATCH_INTRO_MIN_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isEvolving, isFirstEvolution, previousImageUrl, newImageUrl, presetId, element]);

  useEffect(() => {
    return globalAudio.subscribe((muted) => {
      setIsHatchVideoMuted(muted);
    });
  }, []);

  useEffect(() => {
    if (!hatchVideoRef.current) return;
    hatchVideoRef.current.muted = isHatchVideoMuted;
  }, [isHatchVideoMuted, useHatchVideo]);

  useEffect(() => {
    if (!hatchVideoBackdropRef.current) return;
    hatchVideoBackdropRef.current.muted = true;
  }, [useHatchVideo]);

  useEffect(() => {
    const videoElement = animationVideoRef.current;
    if (!showAnimationVideo || !videoElement) return;

    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.currentTime = 0;

    void videoElement.play().catch((error) => {
      log.warn("Evolution animation video playback failed, using still reveal", {
        animationVideoUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      setAnimationVideoFailed(true);
    });
  }, [animationVideoUrl, showAnimationVideo]);

  useEffect(() => {
    if (!isEvolving) {
      animationKeyRef.current = null;
      setStrobeBeatIndex(null);
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
    if (!isEvolving || !shouldStartCinematic) return;

    const animationKey = [
      previousStage,
      newStage,
      previousImageUrl,
      newImageUrl,
      animationVideoUrl ?? "none",
      presetId ?? "none",
      useHatchVideo ? "video" : "legacy",
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
    setStrobeBeatIndex(null);

    emergencyTimeoutRef.current = window.setTimeout(() => {
      log.info("Evolution modal timeout reached, showing emergency exit");
      setShowEmergencyExit(true);
    }, EMERGENCY_EXIT_DELAY_MS);

    if (useHatchVideo) {
      const videoElement = hatchVideoRef.current;
      const videoBackdropElement = hatchVideoBackdropRef.current;
      if (!videoElement || !hatchVideoUrl) {
        setDisableHatchVideo(true);
        animationKeyRef.current = null;
        return;
      }

      const handleVideoEnded = () => {
        setPhase("settle");
        setCanDismiss(true);
        haptics.medium();
      };

      const handleVideoError = () => {
        log.warn("Hatch video failed, falling back to legacy hatch visuals", {
          hatchVideoUrl,
        });
        setDisableHatchVideo(true);
        animationKeyRef.current = null;
      };

      videoElement.addEventListener("ended", handleVideoEnded);
      videoElement.addEventListener("error", handleVideoError);

      const playBackdropVideo = () => {
        if (!videoBackdropElement) return;
        videoBackdropElement.currentTime = 0;
        videoBackdropElement.muted = true;
        void videoBackdropElement.play().catch(() => undefined);
      };

      void (async () => {
        try {
          await globalAudio.ensureReady();
          videoElement.currentTime = 0;
          videoElement.muted = isHatchVideoMuted;
          playBackdropVideo();
          await videoElement.play();
          haptics.light();
        } catch (error) {
          log.warn("Unmuted hatch video autoplay failed, retrying muted", {
            hatchVideoUrl,
            error: error instanceof Error ? error.message : String(error),
          });

          try {
            videoElement.currentTime = 0;
            videoElement.muted = true;
            playBackdropVideo();
            await videoElement.play();
            haptics.light();
          } catch (retryError) {
            log.warn("Muted hatch video autoplay failed, falling back to legacy hatch visuals", {
              hatchVideoUrl,
              error: retryError instanceof Error ? retryError.message : String(retryError),
            });
            setDisableHatchVideo(true);
            animationKeyRef.current = null;
          }
        }
      })();

      return () => {
        videoElement.pause();
        videoBackdropElement?.pause();
        videoElement.removeEventListener("ended", handleVideoEnded);
        videoElement.removeEventListener("error", handleVideoError);
        if (emergencyTimeoutRef.current) {
          window.clearTimeout(emergencyTimeoutRef.current);
          emergencyTimeoutRef.current = null;
        }
      };
    }

    queueTimeout(() => {
      setPhase("charge");
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
      const strobeStartMs = sequence.hold + sequence.charge + sequence.conceal;

      queueTimeout(() => {
        setPhase("strobe");
        setStrobeBeatIndex(0);
      }, strobeStartMs);

      STROBE_BEAT_OFFSETS_MS.slice(1).forEach((offset, index) => {
        const nextBeatIndex = index + 1;
        queueTimeout(() => {
          setStrobeBeatIndex(nextBeatIndex);

          if ((nextBeatIndex + 1) % STROBE_PULSE_INTERVAL === 0) {
            haptics.medium();
          }
        }, strobeStartMs + offset);
      });

      queueTimeout(() => {
        setPhase("apex");
        setStrobeBeatIndex(LAST_STROBE_BEAT_INDEX);
        haptics.heavy();
      }, strobeStartMs + sequence.strobe);
    }

    queueTimeout(() => {
      setStrobeBeatIndex(null);
      setPhase("reveal");
      triggerEvent({
        type: "evolution_reveal",
        intensity: isFirstEvolution || newStage >= 56 ? "heroic" : "medium",
        element: element ?? null,
        stage: newStage,
      });

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
    shouldStartCinematic,
    confettiParticleCount,
    element,
    isEvolving,
    isFirstEvolution,
    newImageUrl,
    animationVideoUrl,
    newStage,
    presetId,
    prefersReducedMotion,
    previousImageUrl,
    previousStage,
    revealDelayMs,
    sequence,
    silhouetteStrobeEnabled,
    theme,
    triggerEvent,
    useHatchVideo,
    hatchVideoUrl,
    isHatchVideoMuted,
  ]);

  useEffect(() => () => {
    timersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    if (emergencyTimeoutRef.current) {
      window.clearTimeout(emergencyTimeoutRef.current);
    }
  }, []);

  const finishEvolution = useCallback(() => {
    if (dismissHandledRef.current) return;
    dismissHandledRef.current = true;

    if (emergencyTimeoutRef.current) {
      window.clearTimeout(emergencyTimeoutRef.current);
      emergencyTimeoutRef.current = null;
    }

    window.dispatchEvent(new CustomEvent("companion-evolved"));
    window.dispatchEvent(new CustomEvent("evolution-complete"));
    window.dispatchEvent(new CustomEvent("evolution-modal-closed"));

    onComplete();
  }, [onComplete]);

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

  if (showHatchIntro) {
    return <HatchIntroSplash />;
  }

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
            background: phase === "apex"
              ? "radial-gradient(circle at center, rgba(0, 0, 0, 0.98) 0%, rgba(0, 0, 0, 1) 62%, black 100%)"
              : isFirstEvolution
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
              opacity: phase === "hold"
                ? 0.18
                : phase === "charge"
                  ? 0.32
                  : phase === "conceal"
                    ? 0.68
                    : phase === "strobe"
                      ? 0.62 + strobeProgress * 0.12
                      : phase === "apex"
                        ? 0.94
                        : 0.46,
              scale: phase === "conceal"
                ? 1.08
                : phase === "strobe"
                  ? 1.04 + strobeProgress * 0.08
                  : phase === "apex"
                    ? 1.24
                    : 1,
            }}
            transition={{ duration: phase === "strobe" ? 0.16 : 0.35 }}
            style={{
              background: `radial-gradient(circle at 50% 45%, hsl(${theme.glowA} / ${0.2 * theme.glowStrength}) 0%, hsl(${theme.glowB} / ${0.14 * theme.glowStrength}) 38%, transparent 72%)`,
            }}
          />

          {silhouetteStrobeEnabled && (phase === "strobe" || phase === "apex") && (
            <>
              <motion.div
                className="absolute inset-0 pointer-events-none evo-cinematic-eclipse"
                initial={false}
                animate={{
                  opacity: phase === "apex" ? 1 : 0.54 + strobeProgress * 0.18,
                  scale: phase === "apex" ? 1.16 : 0.98 + strobeProgress * 0.08,
                }}
                transition={{ duration: phase === "strobe" ? 0.18 : 0.16 }}
              />
              {phase === "apex" && (
                <motion.div
                  className="absolute inset-0 pointer-events-none evo-cinematic-apex-blackout"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.14 }}
                />
              )}
            </>
          )}

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

          {!useHatchVideo && (
            <CompanionMotionLayer
              variant="evolution"
              stage={newStage}
              element={element}
              event={evolutionMotionEvent}
              className="absolute inset-0 z-[1]"
            />
          )}

          {!useHatchVideo && !prefersReducedMotion && (
            <ConvergenceParticles
              phase={phase}
              particleStyle={theme.particleStyle}
              particleCount={convergenceParticleCount}
              strobeBeatIndex={strobeBeatIndex}
            />
          )}

          {!useHatchVideo && isFirstEvolution && (
            <HatchingOverlay
              phase={phase}
              show={phase === "charge" || phase === "conceal"}
              flashGlow={theme.flashGlow}
            />
          )}

          {useHatchVideo && hatchVideoUrl && (
            <div className="absolute inset-0 z-[3] overflow-hidden" data-testid="evolution-hatch-video-layer">
              <video
                ref={hatchVideoBackdropRef}
                src={hatchVideoUrl}
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl"
                playsInline
                preload="auto"
                muted
                aria-hidden="true"
                data-testid="evolution-hatch-video-backdrop"
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "radial-gradient(circle at center, rgba(8, 10, 22, 0.12) 0%, rgba(0, 0, 0, 0.48) 68%, rgba(0, 0, 0, 0.78) 100%)",
                }}
              />
              <div className="relative flex h-full w-full items-center justify-center px-4 py-10 sm:px-6">
                <div
                  className="relative w-full overflow-hidden rounded-[2rem] border border-white/12 bg-black/20 shadow-[0_0_48px_rgba(0,0,0,0.45)] backdrop-blur-[2px]"
                  data-testid="evolution-hatch-video-stage"
                  style={{
                    width: `min(92vw, ${HATCH_FOREGROUND_STAGE_MAX_WIDTH_PX}px)`,
                    height: `min(78vh, ${HATCH_FOREGROUND_STAGE_MAX_HEIGHT_PX}px)`,
                  }}
                >
                  <video
                    ref={hatchVideoRef}
                    src={hatchVideoUrl}
                    className="h-full w-full object-contain"
                    playsInline
                    preload="auto"
                    muted={isHatchVideoMuted}
                    data-testid="evolution-hatch-video"
                  />
                </div>
              </div>
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0.24) 100%)",
                }}
              />
            </div>
          )}

          <div className="relative z-10 flex w-full max-w-5xl flex-col items-center justify-center gap-8 px-6">
            <AnimatePresence mode="wait">
              {!useHatchVideo && (phase === "hold" || phase === "charge" || phase === "conceal") && (
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

            {!useHatchVideo && (
              <div
                className="relative flex w-full items-center justify-center"
                style={{
                  minHeight: "min(54vh, 470px)",
                }}
              >
                <motion.div
                  className="relative flex w-full max-w-[580px] items-center justify-center"
                  data-testid="evolution-art-stage"
                  data-art-presentation={hasDualArt ? "swap" : "single"}
                  data-strobe-enabled={silhouetteStrobeEnabled ? "true" : "false"}
                  data-strobe-beat={strobeBeatIndex === null ? "-1" : String(strobeBeatIndex)}
                  data-strobe-target={strobeTarget}
                  style={{
                    height: "min(54vh, 470px)",
                    ["--evo-strobe-duration" as string]: `${sequence.strobe / 1000}s`,
                    ["--evo-strobe-progress" as string]: strobeProgress.toFixed(3),
                  }}
                  initial={false}
                  animate={{
                    scale: phase === "hold"
                      ? 1
                      : phase === "charge"
                        ? 1.03
                        : phase === "conceal"
                          ? 1.07
                          : phase === "strobe"
                            ? 1.07 + strobeProgress * 0.02
                            : phase === "apex"
                              ? 1.12
                              : phase === "reveal"
                                ? 1.03
                                : 1,
                    y: phase === "apex" ? -4 : 0,
                  }}
                  transition={{
                    duration: phase === "strobe" ? 0.16 : phase === "apex" ? 0.22 : 0.32,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                <motion.div
                  className="absolute inset-[10%] rounded-full pointer-events-none"
                  initial={false}
                  animate={{
                    opacity: phase === "conceal"
                      ? 0.95
                      : phase === "strobe"
                        ? 0.46 + strobeProgress * 0.24
                      : phase === "apex"
                        ? 0.14
                      : phase === "reveal"
                        ? 0.78
                        : phase === "charge"
                          ? 0.28
                          : 0,
                    scale: phase === "conceal"
                      ? 1.24
                      : phase === "strobe"
                        ? 1 + strobeProgress * 0.18
                        : phase === "apex"
                          ? 0.86
                          : phase === "reveal"
                            ? 1.48
                            : 0.72,
                  }}
                  transition={{
                    duration: phase === "conceal" ? sequence.conceal / 1000 : phase === "strobe" ? 0.16 : 0.42,
                    ease: "easeOut",
                  }}
                  style={{
                    background: `radial-gradient(circle, ${theme.flashCore} 0%, ${theme.flashGlow} 35%, transparent 72%)`,
                    filter: "blur(18px)",
                    mixBlendMode: "screen",
                  }}
                />

                {silhouetteStrobeEnabled && phase === "strobe" && (
                  <motion.div
                    className="absolute inset-[10%] rounded-full pointer-events-none evo-cinematic-bloom"
                    initial={false}
                    animate={{
                      opacity: 0.26 + strobeProgress * 0.18,
                      scale: 0.94 + strobeProgress * 0.18,
                    }}
                    transition={{ duration: 0.16 }}
                    style={{
                      background: `radial-gradient(circle, ${theme.flashCore} 0%, ${theme.flashGlow} 42%, transparent 74%)`,
                      filter: "blur(22px)",
                      mixBlendMode: "screen",
                    }}
                  />
                )}

                {!prefersReducedMotion && phase === "reveal" && (
                  <motion.div
                    className="absolute inset-[8%] pointer-events-none overflow-hidden rounded-[2rem] evo-cinematic-reveal-sweep"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 1.15, ease: "easeOut" }}
                  >
                    <motion.div
                      className="absolute inset-y-0 w-[70%]"
                      initial={{ x: "-120%" }}
                      animate={{ x: "215%" }}
                      transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        background:
                          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 48%, transparent 100%)",
                        filter: "blur(9px)",
                      }}
                    />
                  </motion.div>
                )}

                {hasDualArt && previousDisplayImageUrl && (
                  <motion.div
                    key={`previous-art-${previousDisplayImageUrl}`}
                    data-testid="evolution-previous-art"
                    className="absolute inset-0"
                    initial={false}
                    animate={{
                      opacity: phase === "reveal" || phase === "settle"
                        ? 0
                        : phase === "apex"
                          ? 0.02
                        : phase === "strobe"
                            ? strobeTarget === "previous"
                              ? 0.92
                              : 0.18
                            : 1,
                      scale: phase === "hold"
                        ? 1
                        : phase === "charge"
                          ? 1.05
                          : phase === "conceal"
                            ? 1.1
                            : phase === "strobe"
                              ? strobeTarget === "previous"
                                ? 1.1 + strobeProgress * 0.02
                                : 1.13 + strobeProgress * 0.02
                              : phase === "apex"
                                ? 1.16
                                : 1.09,
                      filter: phase === "conceal"
                        ? "brightness(0) saturate(0) contrast(1.48) blur(4px)"
                        : phase === "strobe"
                          ? strobeTarget === "previous"
                            ? "brightness(0) saturate(0) contrast(1.62) blur(4px)"
                            : "brightness(0) saturate(0) contrast(1.82) blur(8px)"
                          : phase === "apex"
                            ? "brightness(0) saturate(0) contrast(2) blur(10px)"
                        : phase === "charge"
                          ? "brightness(1.14) saturate(1.12) contrast(1.02) blur(0px)"
                          : "brightness(1) saturate(1) contrast(1) blur(0px)",
                    }}
                    transition={{
                      duration: phase === "conceal" ? sequence.conceal / 1000 : phase === "strobe" ? 0.16 : 0.34,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    style={{
                      border: `2px solid hsl(${theme.glowA} / 0.34)`,
                      boxShadow: `0 0 28px hsl(${theme.glowA} / 0.24)`,
                    }}
                  >
                    <CompanionImage
                      src={previousDisplayImageUrl}
                      alt={`Companion before evolving at stage ${previousStage}`}
                      fit={firstHatchImageFit}
                      containerAspectRatio={580 / 470}
                      className="rounded-[2rem] shadow-2xl"
                    />
                  </motion.div>
                )}

                {revealDisplayImageUrl ? (
                  <motion.div
                    key={`reveal-art-${revealDisplayImageUrl}`}
                    data-testid="evolution-reveal-art"
                    className="absolute inset-0"
                    initial={false}
                    animate={hasDualArt
                      ? {
                        opacity: phase === "reveal" || phase === "settle"
                          ? 1
                          : phase === "apex"
                            ? 0.28
                            : phase === "strobe"
                              ? strobeTarget === "next"
                                ? 0.92
                                : 0.18
                              : 0,
                        scale: phase === "strobe"
                          ? strobeTarget === "next"
                            ? 1.11 + strobeProgress * 0.02
                            : 1.14 + strobeProgress * 0.02
                          : phase === "apex"
                            ? 1.14
                            : phase === "reveal"
                              ? 1.08
                              : phase === "settle"
                                ? 1
                                : 1.16,
                        filter: phase === "reveal"
                          ? "brightness(1.16) saturate(1.08) contrast(1.05) blur(0px)"
                          : phase === "settle"
                            ? "brightness(1) saturate(1) contrast(1) blur(0px)"
                            : phase === "apex"
                              ? "brightness(0) saturate(0) contrast(1.8) blur(6px)"
                              : phase === "strobe"
                                ? strobeTarget === "next"
                                  ? "brightness(0) saturate(0) contrast(1.64) blur(4px)"
                                  : "brightness(0) saturate(0) contrast(1.84) blur(8px)"
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
                            : phase === "apex"
                              ? 0.22
                            : phase === "strobe"
                              ? 0.16
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
                  >
                    <CompanionImage
                      src={revealDisplayImageUrl}
                      alt={`Companion after evolving at stage ${newStage}`}
                      fit={firstHatchImageFit}
                      containerAspectRatio={580 / 470}
                      className="rounded-[2rem] shadow-2xl"
                    />
                  </motion.div>
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 text-white/70"
                    data-testid="evolution-art-fallback"
                  >
                    Evolution complete
                  </div>
                )}

                {shouldRenderAnimationVideo && animationVideoUrl && (
                  <video
                    ref={animationVideoRef}
                    src={animationVideoUrl}
                    className="absolute inset-0 z-[4] h-full w-full rounded-[2rem] object-contain shadow-2xl transition-opacity duration-500"
                    muted
                    playsInline
                    preload="auto"
                    poster={revealDisplayImageUrl ?? undefined}
                    data-testid="evolution-animation-video"
                    data-animation-ready={animationVideoReady ? "true" : "false"}
                    data-animation-failed={animationVideoFailed ? "true" : "false"}
                    onCanPlay={() => setAnimationVideoReady(true)}
                    onLoadedData={() => setAnimationVideoReady(true)}
                    onError={() => {
                      log.warn("Evolution animation video failed to preload, using still reveal", {
                        animationVideoUrl,
                      });
                      setAnimationVideoFailed(true);
                    }}
                    style={{
                      opacity: showAnimationVideo ? 1 : 0,
                      pointerEvents: "none",
                      border: `3px solid hsl(${theme.glowA} / ${phase === "reveal" || phase === "settle" ? 0.62 : 0.24})`,
                      boxShadow:
                        phase === "reveal" || phase === "settle"
                          ? `0 0 54px ${theme.revealBurstColor}, inset 0 0 26px hsl(${theme.glowB} / 0.18)`
                          : "none",
                    }}
                  />
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
                </motion.div>
              </div>
            )}

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
