import { memo, useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import {
  cinematicPageBackgrounds,
  type CinematicPageBackgroundKey,
} from "@/assets/backgrounds";
import { StaticBackgroundImage } from "@/components/StaticBackgroundImage";
import { useMainTabVisibility } from "@/contexts/MainTabVisibilityContext";
import { useResolvedWallpaper, useWallpaperManifest } from "@/contexts/WallpaperManifestContext";
import { useMotionProfile } from "@/hooks/useMotionProfile";
import { useDeviceOrientation } from "@/hooks/useDeviceOrientation";
import { useTimeColors } from "@/hooks/useTimeColors";

interface CinematicPageBackgroundProps {
  preset: CinematicPageBackgroundKey;
}

interface AmbientStar {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
}

const withAlpha = (color: string, alpha: number): string => (
  color.startsWith("hsl(") ? color.replace(")", ` / ${alpha})`) : color
);

const generateAmbientStars = (count: number): AmbientStar[] => (
  Array.from({ length: count }, (_, index) => ({
    id: index,
    x: Math.random() * 100,
    y: Math.random() * 58,
    size: Math.random() * 2.2 + 0.8,
    opacity: Math.random() * 0.45 + 0.2,
    duration: Math.random() * 5 + 5,
    delay: Math.random() * 6,
  }))
);

export const CinematicPageBackground = memo(({ preset }: CinematicPageBackgroundProps) => {
  const presetConfig = cinematicPageBackgrounds[preset];
  const { isTabActive } = useMainTabVisibility();
  const resolvedWallpaper = useResolvedWallpaper(preset);
  const { currentDateReady, reportWallpaperRenderError } = useWallpaperManifest();
  const { capabilities, signals } = useMotionProfile();
  const { colors } = useTimeColors();
  const rootRef = useRef<HTMLDivElement>(null);
  const parallaxRafRef = useRef<number | null>(null);
  const parallaxTargetRef = useRef({ x: 0, y: 0 });
  const isNativeIOS = useMemo(() => {
    if (typeof window === "undefined") return false;
    const capacitor = (window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    }).Capacitor;
    return Boolean(capacitor?.isNativePlatform?.() && capacitor?.getPlatform?.() === "ios");
  }, []);

  const shouldAnimateOverlay = isTabActive
    && capabilities.allowBackgroundAnimation
    && !signals.isBackgrounded
    && !signals.prefersReducedMotion
    && !isNativeIOS
    && presetConfig.showCosmicOverlay;

  const shouldRunParallax = isTabActive
    && capabilities.allowParallax
    && !signals.isBackgrounded
    && !signals.prefersReducedMotion
    && !isNativeIOS;

  const { gamma, beta, permitted } = useDeviceOrientation({ enabled: shouldRunParallax });
  const stars = useMemo(
    () => generateAmbientStars(presetConfig.showCosmicOverlay ? (shouldAnimateOverlay ? 12 : 8) : 0),
    [presetConfig.showCosmicOverlay, shouldAnimateOverlay],
  );

  const syncParallaxTarget = useCallback((x: number, y: number) => {
    parallaxTargetRef.current = { x, y };
    if (parallaxRafRef.current !== null) return;

    parallaxRafRef.current = requestAnimationFrame(() => {
      parallaxRafRef.current = null;
      if (!rootRef.current) return;
      rootRef.current.style.setProperty("--cinematic-parallax-x", String(parallaxTargetRef.current.x));
      rootRef.current.style.setProperty("--cinematic-parallax-y", String(parallaxTargetRef.current.y));
    });
  }, []);

  useEffect(() => {
    if (!shouldRunParallax) {
      syncParallaxTarget(0, 0);
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      syncParallaxTarget(x, y);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [shouldRunParallax, syncParallaxTarget]);

  useEffect(() => {
    if (!shouldRunParallax || !permitted) return;

    const x = Math.max(-1, Math.min(1, gamma / 32));
    const y = Math.max(-1, Math.min(1, (beta - 45) / 32));
    syncParallaxTarget(x, y);
  }, [beta, gamma, permitted, shouldRunParallax, syncParallaxTarget]);

  useEffect(() => {
    return () => {
      if (parallaxRafRef.current !== null) {
        cancelAnimationFrame(parallaxRafRef.current);
      }
    };
  }, []);

  const imageStyle = useMemo<CSSProperties>(() => ({
    transform: shouldRunParallax
      ? "translate3d(calc(var(--cinematic-parallax-x, 0) * -14px), calc(var(--cinematic-parallax-y, 0) * -12px), 0) scale(1.05)"
      : "scale(1.03)",
    transition: "transform 220ms ease-out",
    willChange: shouldRunParallax ? "transform" : undefined,
  }), [shouldRunParallax]);

  const backgroundSource = resolvedWallpaper?.source ?? (currentDateReady ? "none" : "loading");

  const scrim = presetConfig.scrim;
  const motionMode = shouldAnimateOverlay ? "animated" : "static";

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      data-testid="cinematic-background"
      data-cinematic-background={preset}
      data-cinematic-source={backgroundSource}
      data-cinematic-motion={motionMode}
      data-cinematic-parallax={shouldRunParallax ? "enabled" : "disabled"}
    >
      <div className="absolute inset-0 bg-background" />
      <div
        className="absolute inset-0"
        data-cinematic-loading-gradient="true"
        style={{ background: presetConfig.loadingGradient }}
      />

      {resolvedWallpaper ? (
        <>
          <StaticBackgroundImage
            background={resolvedWallpaper.background}
            className="absolute inset-0 h-full w-full object-cover select-none md:hidden"
            objectPosition={resolvedWallpaper.mobileObjectPosition}
            style={imageStyle}
            onError={() => reportWallpaperRenderError(preset, resolvedWallpaper.imageUrl)}
            testId="cinematic-background-image-mobile"
          />
          <StaticBackgroundImage
            background={resolvedWallpaper.background}
            className="absolute inset-0 hidden h-full w-full object-cover select-none md:block"
            objectPosition={resolvedWallpaper.desktopObjectPosition}
            style={imageStyle}
            onError={() => reportWallpaperRenderError(preset, resolvedWallpaper.imageUrl)}
            testId="cinematic-background-image-desktop"
          />
        </>
      ) : null}

      <div
        className="absolute inset-0"
        data-cinematic-scrim="top"
        style={{
          background: `linear-gradient(180deg, hsl(var(--background) / ${scrim.topGradientTopAlpha}) 0%, hsl(var(--background) / ${scrim.topGradientMiddleAlpha}) 28%, hsl(var(--background) / ${scrim.topGradientBottomAlpha}) 100%)`,
        }}
      />
      <div
        className="absolute inset-0"
        data-cinematic-scrim="center"
        style={{
          background: `radial-gradient(circle at ${scrim.centerAnchor}, transparent 0%, transparent ${scrim.centerClearStop}%, hsl(var(--background) / ${scrim.centerMidAlpha}) ${scrim.centerMidStop}%, hsl(var(--background) / ${scrim.centerEdgeAlpha}) 100%)`,
        }}
      />
      <div
        className="absolute inset-0"
        data-cinematic-scrim="bottom"
        style={{
          background: `linear-gradient(180deg, transparent 0%, transparent ${scrim.bottomFadeStart}%, hsl(var(--background) / ${scrim.bottomFadeEndAlpha}) 100%)`,
        }}
      />

      {presetConfig.showCosmicOverlay ? (
        <div
          className="absolute inset-0"
          data-cinematic-stars="true"
          style={{
            transform: shouldRunParallax
              ? "translate3d(calc(var(--cinematic-parallax-x, 0) * 8px), calc(var(--cinematic-parallax-y, 0) * 6px), 0)"
              : undefined,
            transition: shouldRunParallax ? "transform 220ms ease-out" : undefined,
          }}
        >
          <div
            className="absolute rounded-full blur-[100px]"
            style={{
              top: "10%",
              left: "8%",
              width: "34%",
              height: "18%",
              background: `radial-gradient(circle at center, ${withAlpha(colors.primary, scrim.cosmicGlowOpacity)}, transparent 72%)`,
              opacity: 0.8,
            }}
          />
          <div
            className="absolute rounded-full blur-[110px]"
            style={{
              right: "10%",
              top: "14%",
              width: "28%",
              height: "18%",
              background: `radial-gradient(circle at center, ${withAlpha(colors.accent, scrim.cosmicGlowOpacity * 0.88)}, transparent 72%)`,
              opacity: 0.72,
            }}
          />
          {stars.map((star) => (
            <div
              key={star.id}
              className="absolute rounded-full bg-white"
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                opacity: star.opacity,
                boxShadow: `0 0 10px ${withAlpha(colors.accent, Math.min(0.7, star.opacity))}`,
                animation: shouldAnimateOverlay
                  ? `twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`
                  : "none",
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
});

CinematicPageBackground.displayName = "CinematicPageBackground";
