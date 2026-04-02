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
import { getCompanionElement } from "@/config/companionCatalog";
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

type MotionLayerVariant = "companion" | "evolution";
type ParticleStyleKind = "ember" | "crystal" | "spark" | "leaf" | "star" | "halo";

interface CompanionMotionLayerProps {
  variant: MotionLayerVariant;
  stage: number;
  element?: string | null;
  event?: CompanionMotionEvent | null;
  className?: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

interface AuraTheme {
  id: string;
  primary: string;
  secondary: string;
  accent: string;
  particleStyle: ParticleStyleKind;
  hazeGradient: string;
  veilGradient: string;
  orbitGradient: string;
  crownGradient: string;
  beamGradient: string;
}

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(255,255,255,${alpha})`;

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getSceneId = (variant: MotionLayerVariant, stage: number): CompanionMotionSceneId =>
  variant === "evolution" ? "evolution_hero" : getCompanionMotionSceneForStage(stage);

const getEventStrength = (event: CompanionMotionEvent | null | undefined) => {
  if (!event) return 0.45;
  if (event.intensity === "heroic") return 1;
  if (event.intensity === "medium") return 0.76;
  return 0.58;
};

const resolveAuraTheme = (
  elementId: string | null | undefined,
  primaryColor: string,
  secondaryColor: string,
): AuraTheme => {
  const element = getCompanionElement(elementId);
  const accent = element.accentColor;

  switch (element.id) {
    case "fire":
      return {
        id: "fire",
        primary: primaryColor,
        secondary: secondaryColor,
        accent,
        particleStyle: "ember",
        hazeGradient: `radial-gradient(circle at 50% 55%, ${hexToRgba(primaryColor, 0.42)} 0%, ${hexToRgba(accent, 0.22)} 36%, transparent 74%)`,
        veilGradient: `linear-gradient(180deg, ${hexToRgba(accent, 0.12)} 0%, transparent 40%, ${hexToRgba(primaryColor, 0.18)} 100%)`,
        orbitGradient: `conic-gradient(from 0deg, transparent 0deg, ${hexToRgba(primaryColor, 0.2)} 72deg, transparent 138deg, ${hexToRgba(accent, 0.18)} 216deg, transparent 300deg, ${hexToRgba(primaryColor, 0.16)} 360deg)`,
        crownGradient: `repeating-conic-gradient(from 0deg, transparent 0deg 20deg, ${hexToRgba(accent, 0.22)} 20deg 28deg, transparent 28deg 50deg)`,
        beamGradient: `radial-gradient(circle at 50% 50%, ${hexToRgba(accent, 0.34)} 0%, transparent 60%)`,
      };
    case "ice":
      return {
        id: "ice",
        primary: primaryColor,
        secondary: secondaryColor,
        accent,
        particleStyle: "crystal",
        hazeGradient: `radial-gradient(circle at 50% 48%, ${hexToRgba(primaryColor, 0.3)} 0%, ${hexToRgba(accent, 0.18)} 42%, transparent 72%)`,
        veilGradient: `linear-gradient(180deg, ${hexToRgba(accent, 0.18)} 0%, transparent 36%, ${hexToRgba(primaryColor, 0.12)} 100%)`,
        orbitGradient: `conic-gradient(from 0deg, transparent 0deg, ${hexToRgba(accent, 0.2)} 52deg, transparent 112deg, ${hexToRgba(primaryColor, 0.18)} 200deg, transparent 272deg, ${hexToRgba(accent, 0.14)} 360deg)`,
        crownGradient: `repeating-conic-gradient(from 0deg, transparent 0deg 16deg, ${hexToRgba(secondaryColor, 0.24)} 16deg 20deg, transparent 20deg 42deg)`,
        beamGradient: `radial-gradient(circle at 50% 50%, ${hexToRgba(secondaryColor, 0.3)} 0%, transparent 62%)`,
      };
    case "storm":
      return {
        id: "storm",
        primary: primaryColor,
        secondary: secondaryColor,
        accent,
        particleStyle: "spark",
        hazeGradient: `radial-gradient(circle at 50% 50%, ${hexToRgba(primaryColor, 0.34)} 0%, ${hexToRgba(accent, 0.16)} 40%, transparent 72%)`,
        veilGradient: `linear-gradient(135deg, ${hexToRgba(primaryColor, 0.12)} 0%, transparent 35%, ${hexToRgba(accent, 0.16)} 100%)`,
        orbitGradient: `conic-gradient(from 0deg, transparent 0deg, ${hexToRgba(primaryColor, 0.22)} 34deg, transparent 64deg, ${hexToRgba(accent, 0.2)} 116deg, transparent 168deg, ${hexToRgba(primaryColor, 0.14)} 260deg, transparent 360deg)`,
        crownGradient: `repeating-conic-gradient(from 0deg, transparent 0deg 14deg, ${hexToRgba(primaryColor, 0.22)} 14deg 18deg, transparent 18deg 36deg)`,
        beamGradient: `linear-gradient(135deg, transparent 0%, ${hexToRgba(accent, 0.3)} 50%, transparent 100%)`,
      };
    case "nature":
      return {
        id: "nature",
        primary: primaryColor,
        secondary: secondaryColor,
        accent,
        particleStyle: "leaf",
        hazeGradient: `radial-gradient(circle at 50% 52%, ${hexToRgba(primaryColor, 0.34)} 0%, ${hexToRgba(accent, 0.18)} 38%, transparent 74%)`,
        veilGradient: `linear-gradient(180deg, ${hexToRgba(accent, 0.12)} 0%, transparent 32%, ${hexToRgba(primaryColor, 0.16)} 100%)`,
        orbitGradient: `conic-gradient(from 0deg, transparent 0deg, ${hexToRgba(primaryColor, 0.16)} 68deg, transparent 130deg, ${hexToRgba(accent, 0.2)} 220deg, transparent 288deg, ${hexToRgba(primaryColor, 0.12)} 360deg)`,
        crownGradient: `repeating-conic-gradient(from 0deg, transparent 0deg 24deg, ${hexToRgba(accent, 0.18)} 24deg 28deg, transparent 28deg 50deg)`,
        beamGradient: `radial-gradient(circle at 50% 50%, ${hexToRgba(accent, 0.28)} 0%, transparent 58%)`,
      };
    case "light":
      return {
        id: "light",
        primary: primaryColor,
        secondary: secondaryColor,
        accent,
        particleStyle: "halo",
        hazeGradient: `radial-gradient(circle at 50% 48%, ${hexToRgba(primaryColor, 0.32)} 0%, ${hexToRgba(accent, 0.24)} 34%, transparent 74%)`,
        veilGradient: `linear-gradient(180deg, ${hexToRgba(accent, 0.18)} 0%, transparent 34%, ${hexToRgba(primaryColor, 0.14)} 100%)`,
        orbitGradient: `conic-gradient(from 0deg, transparent 0deg, ${hexToRgba(accent, 0.22)} 88deg, transparent 152deg, ${hexToRgba(primaryColor, 0.16)} 248deg, transparent 320deg, ${hexToRgba(accent, 0.14)} 360deg)`,
        crownGradient: `repeating-conic-gradient(from 0deg, transparent 0deg 18deg, ${hexToRgba(accent, 0.24)} 18deg 24deg, transparent 24deg 48deg)`,
        beamGradient: `radial-gradient(circle at 50% 50%, ${hexToRgba(accent, 0.36)} 0%, transparent 62%)`,
      };
    case "void":
    default:
      return {
        id: "void",
        primary: primaryColor,
        secondary: secondaryColor,
        accent,
        particleStyle: "star",
        hazeGradient: `radial-gradient(circle at 50% 50%, ${hexToRgba(primaryColor, 0.34)} 0%, ${hexToRgba(accent, 0.18)} 38%, transparent 74%)`,
        veilGradient: `linear-gradient(180deg, ${hexToRgba(accent, 0.12)} 0%, transparent 30%, ${hexToRgba(primaryColor, 0.18)} 100%)`,
        orbitGradient: `conic-gradient(from 0deg, transparent 0deg, ${hexToRgba(primaryColor, 0.2)} 72deg, transparent 148deg, ${hexToRgba(accent, 0.22)} 218deg, transparent 298deg, ${hexToRgba(primaryColor, 0.12)} 360deg)`,
        crownGradient: `repeating-conic-gradient(from 0deg, transparent 0deg 22deg, ${hexToRgba(accent, 0.18)} 22deg 26deg, transparent 26deg 46deg)`,
        beamGradient: `radial-gradient(circle at 50% 50%, ${hexToRgba(accent, 0.3)} 0%, transparent 58%)`,
      };
  }
};

const getParticleStyle = (
  theme: AuraTheme,
  index: number,
  variant: MotionLayerVariant,
): CSSProperties => {
  const isEvolution = variant === "evolution";
  const baseStyle: CSSProperties = {
    background: index % 2 === 0 ? theme.primary : theme.accent,
    boxShadow: `0 0 ${isEvolution ? 18 : 14}px ${index % 2 === 0 ? theme.primary : theme.accent}`,
    filter: "blur(0px)",
  };

  switch (theme.particleStyle) {
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
        boxShadow: `0 0 ${isEvolution ? 24 : 18}px ${theme.accent}`,
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
  theme: AuraTheme,
  index: number,
): CSSProperties & Record<string, string[] | number[]> => {
  switch (theme.particleStyle) {
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

const getEventBurstProfile = (event: CompanionMotionEvent | null | undefined) => {
  if (!event) return null;

  switch (event.type) {
    case "xp_gain":
      return { ringInset: "18%", secondaryInset: "26%", rays: false, swirl: false, beam: false };
    case "quest_complete":
      return { ringInset: "16%", secondaryInset: "22%", rays: false, swirl: true, beam: false };
    case "streak":
      return { ringInset: "12%", secondaryInset: "18%", rays: true, swirl: true, beam: false };
    case "wake":
      return { ringInset: "10%", secondaryInset: "16%", rays: true, swirl: false, beam: true };
    case "evolution_start":
      return { ringInset: "8%", secondaryInset: "14%", rays: false, swirl: true, beam: true };
    case "evolution_reveal":
      return { ringInset: "4%", secondaryInset: "10%", rays: true, swirl: true, beam: true };
    case "idle":
    default:
      return { ringInset: "18%", secondaryInset: "24%", rays: false, swirl: false, beam: false };
  }
};

const FallbackMotionScene = memo(({
  variant,
  stage,
  element,
  event,
  className,
  primaryColor,
  secondaryColor,
  particleCount,
  animated,
}: {
  variant: MotionLayerVariant;
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
  const showEggTreatment = variant === "companion" && stage <= 0;
  const showGuardianCrown = stage >= 21;
  const showMythicGeometry = stage >= 56;
  const showAscendedConstellation = stage >= 81 || variant === "evolution";
  const pulseScale = variant === "evolution" ? 1.16 : 1.06 + stagePower * 0.04;
  const particlePositions = variant === "evolution"
    ? EVOLUTION_PARTICLE_POSITIONS.slice(0, particleCount)
    : COMPANION_PARTICLE_POSITIONS.slice(0, particleCount);
  const theme = resolveAuraTheme(element, primaryColor, secondaryColor);
  const eventBurst = getEventBurstProfile(event);
  const centralInset = variant === "evolution" ? "6%" : "10%";

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)} aria-hidden="true">
      <motion.div
        className="absolute inset-[-10%]"
        animate={animated ? {
          opacity: [0.2 + stagePower * 0.08, 0.34 + stagePower * 0.12, 0.2 + stagePower * 0.08],
          scale: [0.98, pulseScale, 0.98],
        } : undefined}
        transition={animated ? {
          duration: variant === "evolution" ? 5.2 : 6.1,
          repeat: Infinity,
          ease: "easeInOut",
        } : undefined}
        style={{
          background: theme.hazeGradient,
          filter: variant === "evolution" ? "blur(34px)" : "blur(26px)",
          opacity: 0.32,
        }}
      />

      <motion.div
        className="absolute inset-0"
        animate={animated ? {
          opacity: [0.14, 0.28, 0.14],
        } : undefined}
        transition={animated ? {
          duration: 8.5,
          repeat: Infinity,
          ease: "easeInOut",
        } : undefined}
        style={{
          background: theme.veilGradient,
          mixBlendMode: "screen",
        }}
      />

      <motion.div
        className="absolute inset-[8%]"
        animate={animated ? {
          rotate: [0, 360],
          opacity: [0.18 + stagePower * 0.08, 0.28 + stagePower * 0.12, 0.18 + stagePower * 0.08],
          scale: [0.97, 1.01 + stagePower * 0.03, 0.97],
        } : undefined}
        transition={animated ? {
          duration: variant === "evolution" ? 17 : 20,
          repeat: Infinity,
          ease: "linear",
        } : undefined}
        style={{
          background: theme.orbitGradient,
          borderRadius: "999px",
          filter: "blur(8px)",
          mixBlendMode: "screen",
        }}
      />

      <motion.div
        className="absolute"
        animate={animated ? {
          rotate: [0, variant === "evolution" ? -360 : -240],
          scale: [0.98, 1.03, 0.98],
        } : undefined}
        transition={animated ? {
          duration: variant === "evolution" ? 22 : 26,
          repeat: Infinity,
          ease: "linear",
        } : undefined}
        style={{
          inset: centralInset,
          borderRadius: "42% 58% 52% 48% / 46% 42% 58% 54%",
          background: `radial-gradient(circle at 50% 50%, ${hexToRgba(theme.secondary, 0.1 + stagePower * 0.08)} 0%, ${hexToRgba(theme.primary, 0.18 + stagePower * 0.12)} 34%, transparent 76%)`,
          filter: variant === "evolution" ? "blur(18px)" : "blur(12px)",
          mixBlendMode: "screen",
        }}
      />

      {showGuardianCrown && (
        <motion.div
          className="absolute inset-[14%] rounded-full"
          animate={animated ? {
            rotate: [0, 360],
            opacity: [0.1 + stagePower * 0.06, 0.24 + stagePower * 0.1, 0.1 + stagePower * 0.06],
          } : undefined}
          transition={animated ? {
            duration: 28,
            repeat: Infinity,
            ease: "linear",
          } : undefined}
          style={{
            background: theme.crownGradient,
            filter: "blur(4px)",
          }}
        />
      )}

      {showMythicGeometry && (
        <>
          <motion.div
            className="absolute inset-[20%]"
            animate={animated ? {
              rotate: [0, 180],
              opacity: [0.08, 0.18, 0.08],
              scale: [0.94, 1, 0.94],
            } : undefined}
            transition={animated ? {
              duration: 18,
              repeat: Infinity,
              ease: "linear",
            } : undefined}
            style={{
              background: `linear-gradient(135deg, transparent 16%, ${hexToRgba(theme.accent, 0.22)} 50%, transparent 84%)`,
              clipPath: "polygon(50% 0%, 86% 20%, 100% 50%, 86% 80%, 50% 100%, 14% 80%, 0% 50%, 14% 20%)",
              filter: "blur(1px)",
            }}
          />
          <motion.div
            className="absolute inset-[24%]"
            animate={animated ? {
              rotate: [180, 0],
              opacity: [0.06, 0.14, 0.06],
            } : undefined}
            transition={animated ? {
              duration: 24,
              repeat: Infinity,
              ease: "linear",
            } : undefined}
            style={{
              background: `linear-gradient(45deg, transparent 12%, ${hexToRgba(theme.primary, 0.18)} 50%, transparent 88%)`,
              clipPath: "polygon(50% 4%, 94% 50%, 50% 96%, 6% 50%)",
            }}
          />
        </>
      )}

      {showAscendedConstellation && (
        <>
          {CONSTELLATION_LINES.map((line) => (
            <motion.span
              key={`${line.left}-${line.top}-${line.width}`}
              className="absolute h-px"
              animate={animated ? {
                opacity: [0.05, 0.16, 0.05],
              } : undefined}
              transition={animated ? {
                duration: 6.8,
                repeat: Infinity,
                ease: "easeInOut",
              } : undefined}
              style={{
                left: line.left,
                top: line.top,
                width: line.width,
                transform: `rotate(${line.rotate})`,
                transformOrigin: "left center",
                background: `linear-gradient(90deg, transparent 0%, ${hexToRgba(theme.accent, 0.28)} 50%, transparent 100%)`,
              }}
            />
          ))}
          {CONSTELLATION_POINTS.map((point, index) => (
            <motion.span
              key={`${point.left}-${point.top}`}
              className="absolute rounded-full"
              animate={animated ? {
                opacity: [0.12, 0.42, 0.12],
                scale: [0.7, index % 2 === 0 ? 1.18 : 1.02, 0.7],
              } : undefined}
              transition={animated ? {
                duration: 4.4 + index * 0.3,
                repeat: Infinity,
                ease: "easeInOut",
              } : undefined}
              style={{
                left: point.left,
                top: point.top,
                width: 4,
                height: 4,
                background: theme.accent,
                boxShadow: `0 0 14px ${theme.accent}`,
              }}
            />
          ))}
        </>
      )}

      {showEggTreatment && (
        <>
          <motion.div
            className="absolute inset-[18%] rounded-full"
            animate={animated ? {
              opacity: [0.16, 0.34, 0.16],
              scale: [0.96, 1.04, 0.96],
            } : undefined}
            transition={animated ? { duration: 4.8, repeat: Infinity, ease: "easeInOut" } : undefined}
            style={{
              background: `radial-gradient(circle at 50% 48%, ${hexToRgba(theme.primary, 0.22)} 0%, ${hexToRgba(theme.accent, 0.12)} 44%, transparent 74%)`,
              filter: "blur(8px)",
            }}
          />
          <motion.div
            className="absolute inset-[26%] rounded-full"
            animate={animated ? {
              rotate: [0, 360],
              opacity: [0.08, 0.18, 0.08],
            } : undefined}
            transition={animated ? { duration: 16, repeat: Infinity, ease: "linear" } : undefined}
            style={{
              background: `conic-gradient(from 0deg, transparent 0deg, ${hexToRgba(theme.accent, 0.16)} 88deg, transparent 180deg, ${hexToRgba(theme.primary, 0.12)} 272deg, transparent 360deg)`,
              filter: "blur(5px)",
            }}
          />
        </>
      )}

      {animated && particlePositions.map((position, index) => (
        <motion.span
          key={`${variant}-${position.left}-${position.top}`}
          className="absolute"
          style={{
            left: position.left,
            top: position.top,
            ...getParticleStyle(theme, index, variant),
          }}
          animate={getParticleAnimation(theme, index)}
          transition={{
            duration: 3.6 + index * 0.28,
            repeat: Infinity,
            ease: "easeInOut",
            delay: index * 0.18,
          }}
        />
      ))}

      <AnimatePresence>
        {event && eventBurst && (
          <motion.div
            key={event.id}
            className="absolute inset-0"
            initial={{ opacity: 0.96 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: Math.max(0.55, event.durationMs / 1000), ease: "easeOut" }}
          >
            <motion.div
              className="absolute rounded-full"
              initial={{ opacity: 0.48, scale: 0.82 }}
              animate={{ opacity: 0, scale: variant === "evolution" ? 1.28 : 1.18 }}
              transition={{ duration: Math.max(0.55, event.durationMs / 1000), ease: "easeOut" }}
              style={{
                inset: eventBurst.ringInset,
                border: `1px solid ${hexToRgba(theme.secondary, 0.46)}`,
                boxShadow: `0 0 42px ${hexToRgba(theme.primary, 0.26)}`,
                background: theme.beamGradient,
              }}
            />
            <motion.div
              className="absolute rounded-full"
              initial={{ opacity: 0.32, scale: 0.88 }}
              animate={{ opacity: 0, scale: variant === "evolution" ? 1.18 : 1.12 }}
              transition={{ duration: Math.max(0.45, event.durationMs / 1200), ease: "easeOut", delay: 0.04 }}
              style={{
                inset: eventBurst.secondaryInset,
                border: `1px solid ${hexToRgba(theme.accent, 0.34)}`,
              }}
            />

            {eventBurst.rays && (
              <motion.div
                className="absolute inset-[6%] rounded-full"
                initial={{ opacity: 0.24, scale: 0.9 }}
                animate={{ opacity: 0, scale: 1.18 }}
                transition={{ duration: Math.max(0.6, event.durationMs / 1000), ease: "easeOut" }}
                style={{
                  background: `repeating-conic-gradient(from 0deg, transparent 0deg 18deg, ${hexToRgba(theme.accent, 0.24 * eventStrength)} 18deg 24deg, transparent 24deg 42deg)`,
                  filter: "blur(4px)",
                  maskImage: "radial-gradient(circle at center, transparent 0%, black 42%, transparent 76%)",
                  WebkitMaskImage: "radial-gradient(circle at center, transparent 0%, black 42%, transparent 76%)",
                }}
              />
            )}

            {eventBurst.swirl && (
              <motion.div
                className="absolute inset-[10%] rounded-full"
                initial={{ opacity: 0.2, rotate: 0 }}
                animate={{ opacity: 0, rotate: variant === "evolution" ? 180 : 120 }}
                transition={{ duration: Math.max(0.7, event.durationMs / 1000), ease: "easeOut" }}
                style={{
                  background: theme.orbitGradient,
                  filter: "blur(6px)",
                }}
              />
            )}

            {eventBurst.beam && (
              <motion.div
                className="absolute inset-[16%]"
                initial={{ opacity: 0.28, scaleY: 0.7 }}
                animate={{ opacity: 0, scaleY: 1.28 }}
                transition={{ duration: Math.max(0.6, event.durationMs / 1000), ease: "easeOut" }}
                style={{
                  background: `linear-gradient(180deg, transparent 0%, ${hexToRgba(theme.accent, 0.3)} 50%, transparent 100%)`,
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
  const elementDefinition = getCompanionElement(element);

  const resolvedPrimaryColor = primaryColor ?? elementDefinition.anchorColor;
  const resolvedSecondaryColor = secondaryColor ?? elementDefinition.accentColor;
  const particleCount = useMemo(() => {
    const budgetScale = variant === "evolution" ? 0.4 : 0.24;
    const count = Math.max(2, Math.round(capabilities.maxParticles * budgetScale));
    return Math.min(variant === "evolution" ? 8 : 6, count);
  }, [capabilities.maxParticles, variant]);

  const fallback = (
    <FallbackMotionScene
      variant={variant}
      stage={stage}
      element={element}
      event={event}
      className={className}
      primaryColor={resolvedPrimaryColor}
      secondaryColor={resolvedSecondaryColor}
      particleCount={profile === "reduced" ? 0 : particleCount}
      animated={profile !== "reduced"}
    />
  );

  const shouldUseRive = !hasRiveLoadError
    && !signals.prefersReducedMotion
    && profile !== "reduced"
    && shouldAttemptRiveScene(sceneId)
    && Boolean(sceneConfig.src);

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
