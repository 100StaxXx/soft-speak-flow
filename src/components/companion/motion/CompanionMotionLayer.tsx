import {
  Suspense,
  lazy,
  memo,
  type CSSProperties,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  getCompanionMotionSceneConfig,
  getCompanionMotionSceneForStage,
  getCompanionMotionStagePower,
  shouldAttemptRiveScene,
  type CompanionMotionEvent,
  type CompanionMotionSceneId,
} from "@/config/companionMotion";
import {
  resolveCompanionElementOverlayRecipe,
  type CompanionMotionOverlayVariant,
  type OverlayPlane,
  type ParticleStyleKind,
} from "@/config/companionElementOverlayRecipes";
import { useMotionProfile } from "@/hooks/useMotionProfile";
import { cn } from "@/lib/utils";

const LazyRiveMotionScene = lazy(() =>
  import("./LazyRiveMotionScene").then((module) => ({
    default: module.LazyRiveMotionScene,
  })),
);

const COMPANION_PARTICLE_POSITIONS = [
  { left: "16%", top: "18%" },
  { left: "79%", top: "22%" },
  { left: "26%", top: "76%" },
  { left: "71%", top: "71%" },
  { left: "53%", top: "11%" },
  { left: "13%", top: "58%" },
] as const;

const EVOLUTION_PARTICLE_POSITIONS = [
  { left: "14%", top: "20%" },
  { left: "26%", top: "74%" },
  { left: "43%", top: "12%" },
  { left: "62%", top: "80%" },
  { left: "76%", top: "19%" },
  { left: "86%", top: "56%" },
  { left: "34%", top: "48%" },
  { left: "58%", top: "42%" },
] as const;

const CONSTELLATION_POINTS = [
  { left: "26%", top: "26%" },
  { left: "43%", top: "18%" },
  { left: "58%", top: "31%" },
  { left: "66%", top: "52%" },
  { left: "38%", top: "64%" },
] as const;

const CONSTELLATION_LINES = [
  { left: "31%", top: "23%", width: "15%", rotate: "18deg" },
  { left: "47%", top: "24%", width: "13%", rotate: "34deg" },
  { left: "55%", top: "40%", width: "9%", rotate: "68deg" },
  { left: "42%", top: "54%", width: "18%", rotate: "-18deg" },
] as const;

interface CompanionMotionLayerProps {
  variant: CompanionMotionOverlayVariant;
  plane?: OverlayPlane;
  stage: number;
  element?: string | null;
  event?: CompanionMotionEvent | null;
  className?: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

const getSceneId = (
  variant: CompanionMotionOverlayVariant,
  stage: number,
): CompanionMotionSceneId => (variant === "evolution" ? "evolution_hero" : getCompanionMotionSceneForStage(stage));

const getEventStrength = (event: CompanionMotionEvent | null | undefined) => {
  if (!event) return 0.45;
  if (event.intensity === "heroic") return 1;
  if (event.intensity === "medium") return 0.76;
  return 0.58;
};

const getParticleStyle = (
  particleStyle: ParticleStyleKind,
  index: number,
  variant: CompanionMotionOverlayVariant,
  primaryColor: string,
  accentColor: string,
): CSSProperties => {
  const isEvolution = variant === "evolution";
  const baseStyle: CSSProperties = {
    background: index % 2 === 0 ? primaryColor : accentColor,
    boxShadow: `0 0 ${isEvolution ? 18 : 14}px ${index % 2 === 0 ? primaryColor : accentColor}`,
    filter: "blur(0px)",
  };

  switch (particleStyle) {
    case "ember":
      return {
        ...baseStyle,
        width: isEvolution ? 8 : 6,
        height: isEvolution ? 12 : 9,
        borderRadius: "60% 60% 70% 70%",
      };
    case "crystal":
      return {
        ...baseStyle,
        width: isEvolution ? 8 : 6,
        height: isEvolution ? 8 : 6,
        borderRadius: "2px",
        transform: "rotate(45deg)",
      };
    case "spark":
      return {
        ...baseStyle,
        width: isEvolution ? 3 : 2,
        height: isEvolution ? 16 : 12,
        borderRadius: "999px",
      };
    case "leaf":
      return {
        ...baseStyle,
        width: isEvolution ? 11 : 8,
        height: isEvolution ? 7 : 5,
        borderRadius: "100% 0 100% 0",
        transform: "rotate(-28deg)",
      };
    case "halo":
      return {
        ...baseStyle,
        width: isEvolution ? 10 : 8,
        height: isEvolution ? 10 : 8,
        borderRadius: "999px",
        boxShadow: `0 0 ${isEvolution ? 24 : 18}px ${accentColor}`,
      };
    case "star":
    default:
      return {
        ...baseStyle,
        width: isEvolution ? 6 : 4,
        height: isEvolution ? 6 : 4,
        borderRadius: "999px",
      };
  }
};

const getParticleAnimation = (
  particleStyle: ParticleStyleKind,
  index: number,
): CSSProperties & Record<string, string[] | number[]> => {
  switch (particleStyle) {
    case "ember":
      return {
        opacity: [0.1, 0.46, 0.08],
        x: [0, index % 2 === 0 ? 8 : -6, 0],
        y: [0, -16, -4],
        scale: [0.84, 1.08, 0.72],
      };
    case "crystal":
      return {
        opacity: [0.18, 0.44, 0.18],
        y: [0, -7, 0],
        rotate: [45, 90, 45],
        scale: [0.72, 1.04, 0.72],
      };
    case "spark":
      return {
        opacity: [0.08, 0.36, 0.14],
        x: [0, index % 2 === 0 ? 10 : -10, 0],
        y: [0, -4, 0],
        scaleY: [0.7, 1.12, 0.7],
      };
    case "leaf":
      return {
        opacity: [0.14, 0.34, 0.14],
        x: [0, index % 2 === 0 ? 8 : -8, 0],
        y: [0, -10, 0],
        rotate: [-18, 10, -12],
        scale: [0.76, 1.02, 0.76],
      };
    case "halo":
      return {
        opacity: [0.18, 0.38, 0.18],
        y: [0, -8, 0],
        scale: [0.88, 1.16, 0.88],
      };
    case "star":
    default:
      return {
        opacity: [0.08, 0.42, 0.12],
        scale: [0.5, 1.18, 0.62],
        rotate: [0, 45, 0],
      };
  }
};

const FallbackMotionScene = memo(({
  variant,
  plane,
  stage,
  element,
  event,
  className,
  primaryColor,
  secondaryColor,
  particleCount,
  animated,
}: {
  variant: CompanionMotionOverlayVariant;
  plane: OverlayPlane;
  stage: number;
  element?: string | null;
  event?: CompanionMotionEvent | null;
  className?: string;
  primaryColor: string;
  secondaryColor: string;
  particleCount: number;
  animated: boolean;
}) => {
  const stagePower = getCompanionMotionStagePower(stage);
  const eventStrength = getEventStrength(event);
  const pulseScale = variant === "evolution" ? 1.16 : 1.06 + stagePower * 0.04;
  const particlePositions = variant === "evolution"
    ? EVOLUTION_PARTICLE_POSITIONS.slice(0, particleCount)
    : COMPANION_PARTICLE_POSITIONS.slice(0, particleCount);
  const recipe = useMemo(
    () =>
      resolveCompanionElementOverlayRecipe({
        elementId: element,
        plane,
        variant,
        stage,
        event,
        primaryColor,
        secondaryColor,
      }),
    [element, event, plane, primaryColor, secondaryColor, stage, variant],
  );
  const hasEventBurst = Boolean(event) && Object.values(recipe.eventBurst.visuals).some(Boolean);

  return (
    <div
      className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}
      aria-hidden="true"
      data-motion-element={recipe.id}
      data-motion-plane={plane}
      data-motion-animated={animated ? "true" : "false"}
    >
      {recipe.visuals.haze && (
        <motion.div
          className="absolute inset-[-10%]"
          data-overlay-layer="haze"
          animate={animated
            ? {
                opacity: [0.2 + stagePower * 0.08, 0.34 + stagePower * 0.12, 0.2 + stagePower * 0.08],
                scale: [0.98, pulseScale, 0.98],
              }
            : undefined}
          transition={animated
            ? {
                duration: variant === "evolution" ? 5.2 : 6.1,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : undefined}
          style={{
            background: recipe.gradients.haze,
            filter: variant === "evolution" ? "blur(34px)" : "blur(26px)",
            opacity: 0.32,
          }}
        />
      )}

      {recipe.visuals.veil && (
        <motion.div
          className="absolute inset-0"
          data-overlay-layer="veil"
          animate={animated ? { opacity: [0.14, 0.28, 0.14] } : undefined}
          transition={animated
            ? {
                duration: 8.5,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : undefined}
          style={{
            background: recipe.gradients.veil,
            mixBlendMode: "screen",
          }}
        />
      )}

      {recipe.visuals.orbit && (
        <motion.div
          className="absolute inset-[8%]"
          data-overlay-layer="orbit"
          animate={animated
            ? {
                rotate: [0, 360],
                opacity: [0.18 + stagePower * 0.08, 0.28 + stagePower * 0.12, 0.18 + stagePower * 0.08],
                scale: [0.97, 1.01 + stagePower * 0.03, 0.97],
              }
            : undefined}
          transition={animated
            ? {
                duration: variant === "evolution" ? 17 : 20,
                repeat: Infinity,
                ease: "linear",
              }
            : undefined}
          style={{
            background: recipe.gradients.orbit,
            borderRadius: "999px",
            filter: "blur(8px)",
            mixBlendMode: "screen",
          }}
        />
      )}

      {recipe.visuals.core && (
        <motion.div
          className="absolute"
          data-overlay-layer="core"
          animate={animated
            ? {
                rotate: [0, variant === "evolution" ? -360 : -240],
                scale: [0.98, 1.03, 0.98],
              }
            : undefined}
          transition={animated
            ? {
                duration: variant === "evolution" ? 22 : 26,
                repeat: Infinity,
                ease: "linear",
              }
            : undefined}
          style={{
            inset: recipe.safeFrameInset,
            borderRadius: "42% 58% 52% 48% / 46% 42% 58% 54%",
            background: recipe.gradients.core,
            filter: variant === "evolution" ? "blur(18px)" : "blur(12px)",
            mixBlendMode: "screen",
          }}
        />
      )}

      {recipe.visuals.edgeGlow && (
        <motion.div
          className="absolute inset-[12%] rounded-[30%]"
          data-overlay-layer="edge-glow"
          animate={animated
            ? {
                opacity: [0.12, 0.28 + stagePower * 0.08, 0.12],
                scale: [0.98, 1.02, 0.98],
              }
            : undefined}
          transition={animated
            ? {
                duration: 6.4,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : undefined}
          style={{
            background: recipe.gradients.edgeGlow,
            filter: plane === "foreground" ? "blur(6px)" : "blur(10px)",
            mixBlendMode: "screen",
          }}
        />
      )}

      {recipe.visuals.crown && (
        <motion.div
          className="absolute inset-[14%] rounded-full"
          data-overlay-layer="crown"
          animate={animated
            ? {
                rotate: [0, 360],
                opacity: [0.1 + stagePower * 0.06, 0.24 + stagePower * 0.1, 0.1 + stagePower * 0.06],
              }
            : undefined}
          transition={animated
            ? {
                duration: 28,
                repeat: Infinity,
                ease: "linear",
              }
            : undefined}
          style={{
            background: recipe.gradients.crown,
            filter: "blur(4px)",
          }}
        />
      )}

      {recipe.visuals.geometry && (
        <>
          <motion.div
            className="absolute inset-[20%]"
            data-overlay-layer="geometry-outer"
            animate={animated
              ? {
                  rotate: [0, 180],
                  opacity: [0.08, 0.18, 0.08],
                  scale: [0.94, 1, 0.94],
                }
              : undefined}
            transition={animated
              ? {
                  duration: 18,
                  repeat: Infinity,
                  ease: "linear",
                }
              : undefined}
            style={{
              background: `linear-gradient(135deg, transparent 16%, ${recipe.colors.accent}33 50%, transparent 84%)`,
              clipPath: "polygon(50% 0%, 86% 20%, 100% 50%, 86% 80%, 50% 100%, 14% 80%, 0% 50%, 14% 20%)",
              filter: "blur(1px)",
            }}
          />
          <motion.div
            className="absolute inset-[24%]"
            data-overlay-layer="geometry-inner"
            animate={animated
              ? {
                  rotate: [180, 0],
                  opacity: [0.06, 0.14, 0.06],
                }
              : undefined}
            transition={animated
              ? {
                  duration: 24,
                  repeat: Infinity,
                  ease: "linear",
                }
              : undefined}
            style={{
              background: `linear-gradient(45deg, transparent 12%, ${recipe.colors.primary}2e 50%, transparent 88%)`,
              clipPath: "polygon(50% 4%, 94% 50%, 50% 96%, 6% 50%)",
            }}
          />
        </>
      )}

      {recipe.visuals.constellation && (
        <>
          {CONSTELLATION_LINES.map((line) => (
            <motion.span
              key={`${plane}-${line.left}-${line.top}-${line.width}`}
              className="absolute h-px"
              data-overlay-layer="constellation-line"
              animate={animated ? { opacity: [0.05, 0.16, 0.05] } : undefined}
              transition={animated
                ? {
                    duration: 6.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
                : undefined}
              style={{
                left: line.left,
                top: line.top,
                width: line.width,
                transform: `rotate(${line.rotate})`,
                transformOrigin: "left center",
                background: `linear-gradient(90deg, transparent 0%, ${recipe.colors.accent}47 50%, transparent 100%)`,
              }}
            />
          ))}
          {CONSTELLATION_POINTS.map((point, index) => (
            <motion.span
              key={`${plane}-${point.left}-${point.top}`}
              className="absolute rounded-full"
              data-overlay-layer="constellation-point"
              animate={animated
                ? {
                    opacity: [0.12, 0.42, 0.12],
                    scale: [0.7, index % 2 === 0 ? 1.18 : 1.02, 0.7],
                  }
                : undefined}
              transition={animated
                ? {
                    duration: 4.4 + index * 0.3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
                : undefined}
              style={{
                left: point.left,
                top: point.top,
                width: 4,
                height: 4,
                background: recipe.colors.accent,
                boxShadow: `0 0 14px ${recipe.colors.accent}`,
              }}
            />
          ))}
        </>
      )}

      {recipe.visuals.eggAura && (
        <>
          <motion.div
            className="absolute inset-[18%] rounded-full"
            data-overlay-layer="egg-aura"
            animate={animated
              ? {
                  opacity: [0.16, 0.34, 0.16],
                  scale: [0.96, 1.04, 0.96],
                }
              : undefined}
            transition={animated ? { duration: 4.8, repeat: Infinity, ease: "easeInOut" } : undefined}
            style={{
              background: `radial-gradient(circle at 50% 48%, ${recipe.colors.primary}38 0%, ${recipe.colors.accent}1f 44%, transparent 74%)`,
              filter: "blur(8px)",
            }}
          />
          <motion.div
            className="absolute inset-[26%] rounded-full"
            data-overlay-layer="egg-orbit"
            animate={animated
              ? {
                  rotate: [0, 360],
                  opacity: [0.08, 0.18, 0.08],
                }
              : undefined}
            transition={animated ? { duration: 16, repeat: Infinity, ease: "linear" } : undefined}
            style={{
              background: `conic-gradient(from 0deg, transparent 0deg, ${recipe.colors.accent}29 88deg, transparent 180deg, ${recipe.colors.primary}1f 272deg, transparent 360deg)`,
              filter: "blur(5px)",
            }}
          />
        </>
      )}

      {animated && recipe.visuals.particles && particlePositions.map((position, index) => (
        <motion.span
          key={`${plane}-${variant}-${position.left}-${position.top}`}
          className="absolute"
          data-overlay-layer="particle"
          style={{
            left: position.left,
            top: position.top,
            ...getParticleStyle(
              recipe.particleStyle,
              index,
              variant,
              recipe.colors.primary,
              recipe.colors.accent,
            ),
          }}
          animate={getParticleAnimation(recipe.particleStyle, index)}
          transition={{
            duration: 3.6 + index * 0.28,
            repeat: Infinity,
            ease: "easeInOut",
            delay: index * 0.18,
          }}
        />
      ))}

      <AnimatePresence>
        {event && hasEventBurst && (
          <motion.div
            key={`${plane}-${event.id}`}
            className="absolute inset-0"
            data-overlay-layer="event-burst"
            initial={{ opacity: 0.96 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: Math.max(0.55, event.durationMs / 1000), ease: "easeOut" }}
          >
            {recipe.eventBurst.visuals.ring && (
              <motion.div
                className="absolute rounded-full"
                data-overlay-layer="event-ring"
                initial={{ opacity: 0.48, scale: 0.82 }}
                animate={{ opacity: 0, scale: variant === "evolution" ? 1.28 : 1.18 }}
                transition={{ duration: Math.max(0.55, event.durationMs / 1000), ease: "easeOut" }}
                style={{
                  inset: recipe.eventBurst.ringInset,
                  border: `1px solid ${recipe.colors.secondary}75`,
                  boxShadow: `0 0 42px ${recipe.colors.primary}42`,
                  background: recipe.gradients.beam,
                }}
              />
            )}

            {recipe.eventBurst.visuals.secondaryRing && (
              <motion.div
                className="absolute rounded-full"
                data-overlay-layer="event-secondary-ring"
                initial={{ opacity: 0.32, scale: 0.88 }}
                animate={{ opacity: 0, scale: variant === "evolution" ? 1.18 : 1.12 }}
                transition={{
                  duration: Math.max(0.45, event.durationMs / 1200),
                  ease: "easeOut",
                  delay: 0.04,
                }}
                style={{
                  inset: recipe.eventBurst.secondaryInset,
                  border: `1px solid ${recipe.colors.accent}57`,
                }}
              />
            )}

            {recipe.eventBurst.rays && (
              <motion.div
                className="absolute inset-[6%] rounded-full"
                data-overlay-layer="event-rays"
                initial={{ opacity: 0.24, scale: 0.9 }}
                animate={{ opacity: 0, scale: 1.18 }}
                transition={{ duration: Math.max(0.6, event.durationMs / 1000), ease: "easeOut" }}
                style={{
                  background: `repeating-conic-gradient(from 0deg, transparent 0deg 18deg, ${recipe.colors.accent}${Math.round(61 * eventStrength).toString(16).padStart(2, "0")} 18deg 24deg, transparent 24deg 42deg)`,
                  filter: "blur(4px)",
                  maskImage: "radial-gradient(circle at center, transparent 0%, black 42%, transparent 76%)",
                  WebkitMaskImage: "radial-gradient(circle at center, transparent 0%, black 42%, transparent 76%)",
                }}
              />
            )}

            {recipe.eventBurst.swirl && (
              <motion.div
                className="absolute inset-[10%] rounded-full"
                data-overlay-layer="event-swirl"
                initial={{ opacity: 0.2, rotate: 0 }}
                animate={{ opacity: 0, rotate: variant === "evolution" ? 180 : 120 }}
                transition={{ duration: Math.max(0.7, event.durationMs / 1000), ease: "easeOut" }}
                style={{
                  background: recipe.gradients.orbit,
                  filter: "blur(6px)",
                }}
              />
            )}

            {recipe.eventBurst.beam && (
              <motion.div
                className="absolute inset-[16%]"
                data-overlay-layer="event-beam"
                initial={{ opacity: 0.28, scaleY: 0.7 }}
                animate={{ opacity: 0, scaleY: 1.28 }}
                transition={{ duration: Math.max(0.6, event.durationMs / 1000), ease: "easeOut" }}
                style={{
                  background: `linear-gradient(180deg, transparent 0%, ${recipe.colors.accent}4d 50%, transparent 100%)`,
                  filter: "blur(10px)",
                  borderRadius: "999px",
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

FallbackMotionScene.displayName = "FallbackMotionScene";

export const CompanionMotionLayer = memo(({
  variant,
  plane = "backdrop",
  stage,
  element,
  event,
  className,
  primaryColor,
  secondaryColor,
}: CompanionMotionLayerProps) => {
  const [hasRiveLoadError, setHasRiveLoadError] = useState(false);
  const { profile, capabilities, signals } = useMotionProfile();
  const sceneId = getSceneId(variant, stage);
  const sceneConfig = getCompanionMotionSceneConfig(sceneId);
  const resolvedRecipe = useMemo(
    () =>
      resolveCompanionElementOverlayRecipe({
        elementId: element,
        plane,
        variant,
        stage,
        event,
        primaryColor,
        secondaryColor,
      }),
    [element, event, plane, primaryColor, secondaryColor, stage, variant],
  );

  const particleCount = useMemo(() => {
    const budgetScale = variant === "evolution" ? 0.4 : 0.24;
    const count = Math.max(2, Math.round(capabilities.maxParticles * budgetScale));
    return Math.min(variant === "evolution" ? 8 : 6, count);
  }, [capabilities.maxParticles, variant]);

  const fallback = (
    <FallbackMotionScene
      variant={variant}
      plane={plane}
      stage={stage}
      element={element}
      event={event}
      className={className}
      primaryColor={resolvedRecipe.colors.primary}
      secondaryColor={resolvedRecipe.colors.secondary}
      particleCount={profile === "reduced" ? 0 : particleCount}
      animated={profile !== "reduced"}
    />
  );

  const shouldUseRive = !hasRiveLoadError
    && !signals.prefersReducedMotion
    && profile !== "reduced"
    && shouldAttemptRiveScene(sceneId)
    && Boolean(sceneConfig.src)
    && plane === "backdrop";

  if (!shouldUseRive) {
    return fallback;
  }

  return (
    <ErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LazyRiveMotionScene
          src={sceneConfig.src!}
          artboard={sceneConfig.artboard}
          stateMachines={sceneConfig.stateMachines}
          inputBindings={sceneConfig.inputBindings}
          className={className}
          stage={stage}
          event={event}
          onLoadError={() => setHasRiveLoadError(true)}
        />
      </Suspense>
    </ErrorBoundary>
  );
});

CompanionMotionLayer.displayName = "CompanionMotionLayer";
