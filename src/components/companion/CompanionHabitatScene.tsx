import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CompanionHabitatSceneProps {
  biome: string;
  ambiance: string;
  qualityTier: "high" | "medium" | "low";
  companionImageUrl: string | null;
  companionName: string;
  reducedMotion: boolean;
  maxParticles?: number;
}

interface QualityProfile {
  particleCount: number;
  enableDepthMotion: boolean;
  enableBloom: boolean;
}

const biomeBackgrounds: Record<string, string> = {
  cosmic_nest: "from-slate-950 via-indigo-900 to-cyan-900",
  starlit_valley: "from-indigo-950 via-blue-900 to-emerald-900",
  moonlit_garden: "from-slate-950 via-violet-900 to-rose-900",
  aurora_grove: "from-emerald-950 via-cyan-900 to-indigo-900",
  ashen_hollow: "from-zinc-950 via-slate-900 to-neutral-900",
};

const ambianceGlow: Record<string, string> = {
  serene: "rgba(56, 189, 248, 0.30)",
  hopeful: "rgba(34, 197, 94, 0.28)",
  intense: "rgba(244, 63, 94, 0.30)",
  fragile: "rgba(251, 191, 36, 0.28)",
};

const QUALITY_PROFILES: Record<CompanionHabitatSceneProps["qualityTier"], QualityProfile> = {
  high: {
    particleCount: 22,
    enableDepthMotion: true,
    enableBloom: true,
  },
  medium: {
    particleCount: 12,
    enableDepthMotion: true,
    enableBloom: true,
  },
  low: {
    particleCount: 0,
    enableDepthMotion: false,
    enableBloom: false,
  },
};

const createParticles = (count: number) =>
  Array.from({ length: count }).map((_, index) => ({
    id: `particle-${index}`,
    left: (index * 37) % 100,
    top: (index * 17) % 100,
    size: 2 + (index % 3),
    duration: 7 + (index % 6),
    delay: (index % 5) * 0.35,
    opacity: 0.18 + (index % 5) * 0.08,
  }));

export const CompanionHabitatScene = memo(({
  biome,
  ambiance,
  qualityTier,
  companionImageUrl,
  companionName,
  reducedMotion,
  maxParticles,
}: CompanionHabitatSceneProps) => {
  const backgroundClass = biomeBackgrounds[biome] ?? biomeBackgrounds.cosmic_nest;
  const glowColor = ambianceGlow[ambiance] ?? ambianceGlow.serene;
  const profile = QUALITY_PROFILES[qualityTier];
  const enableDepthMotion = profile.enableDepthMotion && !reducedMotion;
  const particleBudget = typeof maxParticles === "number"
    ? Math.max(0, Math.floor(maxParticles))
    : profile.particleCount;
  const particleCount = Math.min(profile.particleCount, particleBudget);
  const enableParticles = particleCount > 0 && !reducedMotion;
  const enableBloom = profile.enableBloom && !reducedMotion;

  const particles = useMemo(() => createParticles(particleCount), [particleCount]);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border/40 min-h-[340px]"
      data-testid="habitat-scene"
      data-quality-tier={qualityTier}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-particle-count={particleCount}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br", backgroundClass)} />

      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 20% 20%, ${glowColor}, transparent 45%)`,
        }}
        animate={enableDepthMotion ? { x: [0, 6, -4, 0], y: [0, 4, -2, 0] } : undefined}
        transition={enableDepthMotion ? { duration: 16, repeat: Infinity, ease: "easeInOut" } : undefined}
      />

      {enableDepthMotion && (
        <motion.div
          className="absolute -left-16 -top-16 h-48 w-48 rounded-full blur-3xl"
          style={{ backgroundColor: glowColor }}
          animate={{ x: [0, 24, -12, 0], y: [0, 12, -8, 0], opacity: [0.35, 0.55, 0.4, 0.35] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          data-testid="habitat-depth-orb"
        />
      )}

      {enableBloom && (
        <motion.div
          className="absolute right-[-60px] bottom-[-50px] h-52 w-52 rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(250, 204, 21, 0.22)" }}
          animate={{ x: [0, -18, 0], y: [0, -22, 0], opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          data-testid="habitat-bloom-orb"
        />
      )}

      {enableParticles && (
        <div className="pointer-events-none absolute inset-0" data-testid="habitat-particles">
          {particles.map((particle) => (
            <motion.span
              key={particle.id}
              data-testid="habitat-particle"
              className="absolute rounded-full bg-white/80"
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                width: particle.size,
                height: particle.size,
              }}
              initial={{ opacity: particle.opacity * 0.6, scale: 0.75 }}
              animate={{ opacity: [particle.opacity * 0.4, particle.opacity, particle.opacity * 0.4], y: [0, -8, 0] }}
              transition={{
                duration: particle.duration,
                delay: particle.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />

      <div className="relative z-10 flex h-full min-h-[340px] flex-col items-center justify-end p-6">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 14, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.35 }}
          className="relative"
          data-testid="habitat-companion-plane"
        >
          {companionImageUrl ? (
            <img
              src={companionImageUrl}
              alt={companionName}
              className="h-52 w-52 rounded-2xl object-cover ring-2 ring-white/25 shadow-[0_25px_60px_-25px_rgba(0,0,0,0.9)]"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-52 w-52 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white/70">
              Habitat Preview
            </div>
          )}

          {enableBloom && (
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{ boxShadow: "0 0 35px rgba(56, 189, 248, 0.35)" }}
              animate={{ opacity: [0.25, 0.55, 0.25] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
});

CompanionHabitatScene.displayName = "CompanionHabitatScene";
