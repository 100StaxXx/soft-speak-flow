import type { ButtonHTMLAttributes } from "react";
import { CompanionImage, CompanionPortraitShell } from "@/components/CompanionImage";
import { cn } from "@/lib/utils";
import { useJourneysCompanionVisual } from "@/hooks/useJourneysCompanionVisual";
import { useCompanionImageBackgroundCutout } from "@/hooks/useCompanionImageBackgroundCutout";

type JourneysCompanionLauncherVariant = "floating" | "inline";
type JourneysCompanionLauncherFaceDirection = "front" | "away";

interface JourneysCompanionLauncherProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: JourneysCompanionLauncherVariant;
  compact?: boolean;
  text?: string;
  caption?: string;
  imageUrlOverride?: string | null;
  imageFocalXOverride?: number | null;
  imageFocalYOverride?: number | null;
  usesPortraitShellOverride?: boolean;
  allowImageFallback?: boolean;
  requireHeroCutout?: boolean;
  floatingSize?: "default" | "hero";
  faceDirection?: JourneysCompanionLauncherFaceDirection;
}

export function JourneysCompanionLauncher({
  variant,
  compact = false,
  text,
  caption = "Companion chat",
  imageUrlOverride,
  imageFocalXOverride,
  imageFocalYOverride,
  usesPortraitShellOverride,
  allowImageFallback = true,
  requireHeroCutout = false,
  floatingSize = "default",
  faceDirection = "front",
  className,
  type = "button",
  ...props
}: JourneysCompanionLauncherProps) {
  const {
    companionLabel,
    imageUrl,
    focalX,
    focalY,
    element,
    usesPortraitShell,
  } = useJourneysCompanionVisual();

  const resolvedImageUrl = imageUrlOverride === undefined
    ? imageUrl
    : imageUrlOverride ?? (allowImageFallback ? imageUrl : null);
  const resolvedFocalX = imageFocalXOverride === undefined ? focalX : imageFocalXOverride;
  const resolvedFocalY = imageFocalYOverride === undefined ? focalY : imageFocalYOverride;
  const resolvedUsesPortraitShell = usesPortraitShellOverride ?? usesPortraitShell;
  const resolvedText = text ?? `Chat with ${companionLabel}`;
  const isFloatingHero = variant === "floating" && floatingSize === "hero";
  const shouldCutOutHeroBackground = isFloatingHero
    && requireHeroCutout
    && Boolean(resolvedImageUrl)
    && !resolvedUsesPortraitShell;
  const {
    cutoutSrc: heroCutoutSrc,
    status: heroCutoutStatus,
  } = useCompanionImageBackgroundCutout(resolvedImageUrl, {
    enabled: shouldCutOutHeroBackground,
  });
  const resolvedHeroImageUrl = heroCutoutSrc ?? (
    requireHeroCutout && shouldCutOutHeroBackground ? null : resolvedImageUrl
  );
  const isWaitingForHeroCutout = shouldCutOutHeroBackground
    && (heroCutoutStatus === "idle" || heroCutoutStatus === "processing");
  const shouldShowHeroPlaceholder = isFloatingHero && (
    !resolvedHeroImageUrl
    || (requireHeroCutout && shouldCutOutHeroBackground && heroCutoutStatus !== "ready")
  );
  const portraitClassName = variant === "floating"
    ? isFloatingHero
      ? "h-[7.75rem] w-[7.75rem]"
      : "h-9 w-9"
    : compact
      ? "h-9 w-9"
      : "h-10 w-10";
  const portraitPlaceholder = (
    <span
      aria-hidden="true"
      data-testid="journeys-companion-launcher-placeholder"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-[radial-gradient(circle_at_40%_28%,rgba(255,255,255,0.22),rgba(255,255,255,0.08)_42%,rgba(15,23,42,0.84))]",
        portraitClassName,
      )}
      data-companion-background-cutout={shouldCutOutHeroBackground ? heroCutoutStatus : undefined}
    >
      <span className="h-1/2 w-1/2 rounded-full bg-white/12 shadow-[inset_0_0_24px_rgba(255,255,255,0.14)]" />
    </span>
  );

  const portrait = isFloatingHero ? (
    <div
      className={cn("relative shrink-0", portraitClassName)}
      style={{ filter: "drop-shadow(0 10px 24px rgba(0, 0, 0, 0.24))" }}
    >
      {shouldShowHeroPlaceholder ? portraitPlaceholder : (
        <CompanionImage
          src={resolvedHeroImageUrl}
          alt={companionLabel}
          fit={resolvedUsesPortraitShell ? "portrait" : "contain"}
          element={element}
          focalX={resolvedFocalX}
          focalY={resolvedFocalY}
          className={cn(
            "pointer-events-none select-none transition-opacity duration-150",
            isWaitingForHeroCutout && "opacity-0",
          )}
          draggable={false}
          data-companion-background-cutout={shouldCutOutHeroBackground ? heroCutoutStatus : undefined}
        />
      )}
    </div>
  ) : !resolvedImageUrl ? (
    portraitPlaceholder
  ) : resolvedUsesPortraitShell ? (
    <CompanionPortraitShell
      src={resolvedImageUrl}
      element={element}
      className={cn("overflow-hidden rounded-full", portraitClassName)}
    >
      <CompanionImage
        src={resolvedImageUrl}
        alt={companionLabel}
        fit="portrait"
        element={element}
        focalX={resolvedFocalX}
        focalY={resolvedFocalY}
        className="rounded-full"
      />
    </CompanionPortraitShell>
  ) : (
    <div className={cn("overflow-hidden rounded-full bg-white/10", portraitClassName)}>
      <CompanionImage
        src={resolvedImageUrl}
        alt={companionLabel}
        element={element}
        focalX={resolvedFocalX}
        focalY={resolvedFocalY}
        className="rounded-full"
      />
    </div>
  );

  if (variant === "floating") {
    return (
      <button
        type={type}
        className={cn(
          "group relative flex items-center justify-center transition-transform duration-300 hover:scale-[1.02]",
          isFloatingHero
            ? "h-36 w-36 overflow-visible rounded-full border-0 bg-transparent p-0 text-cyan-50 shadow-none hover:bg-transparent hover:text-white"
            : "h-12 w-12 rounded-full border border-white/12 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),rgba(255,255,255,0.04)_48%,rgba(15,23,42,0.92))] shadow-[0_12px_28px_rgba(0,0,0,0.22)]",
          className,
        )}
        data-face-direction={faceDirection}
        {...props}
      >
        {!isFloatingHero ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(125,211,252,0.35),transparent_42%),radial-gradient(circle_at_70%_75%,rgba(244,114,182,0.18),transparent_42%)]"
          />
        ) : null}
        <span
          className={cn(
            "relative flex items-center justify-center transition-transform duration-500",
            faceDirection === "away" ? "-scale-x-100 rotate-[3deg]" : "scale-x-100 rotate-0",
          )}
          style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          {portrait}
        </span>
      </button>
    );
  }

  return (
    <button
      type={type}
      className={cn(
        "group relative inline-flex items-center gap-3 overflow-hidden rounded-[20px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.07),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-3 py-2 text-left shadow-[0_16px_28px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-white/15 hover:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))]",
        compact ? "min-h-10" : "min-h-11",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(125,211,252,0.14),transparent_34%),radial-gradient(circle_at_85%_78%,rgba(250,204,21,0.1),transparent_28%)]"
      />
      <span className="relative shrink-0">
        {portrait}
      </span>
      <span className="relative min-w-0">
        {!compact ? (
          <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/46">
            {caption}
          </span>
        ) : null}
        <span className={cn("block truncate font-semibold text-white", compact ? "text-sm" : "text-[0.95rem]")}>
          {resolvedText}
        </span>
      </span>
    </button>
  );
}
