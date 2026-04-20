import type { ButtonHTMLAttributes } from "react";
import { CompanionImage, CompanionPortraitShell } from "@/components/CompanionImage";
import { cn } from "@/lib/utils";
import { useJourneysCompanionVisual } from "@/hooks/useJourneysCompanionVisual";

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

  const resolvedImageUrl = imageUrlOverride ?? imageUrl;
  const resolvedFocalX = imageFocalXOverride ?? focalX;
  const resolvedFocalY = imageFocalYOverride ?? focalY;
  const resolvedUsesPortraitShell = usesPortraitShellOverride ?? usesPortraitShell;
  const resolvedText = text ?? `Chat with ${companionLabel}`;
  const portraitClassName = variant === "floating"
    ? floatingSize === "hero"
      ? "h-[5.1rem] w-[5.1rem]"
      : "h-9 w-9"
    : compact
      ? "h-9 w-9"
      : "h-10 w-10";

  const portrait = resolvedUsesPortraitShell ? (
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
    const isHero = floatingSize === "hero";
    return (
      <button
        type={type}
        className={cn(
          "group relative flex items-center justify-center overflow-hidden backdrop-blur-xl transition-transform duration-300 hover:scale-[1.02]",
          isHero
            ? "h-28 w-28 rounded-[2rem] border-[3px] border-[#4d2811] bg-[radial-gradient(circle_at_30%_20%,rgba(255,244,178,0.92),transparent_32%),radial-gradient(circle_at_70%_78%,rgba(255,130,28,0.38),transparent_34%),linear-gradient(180deg,#ffd55f_0%,#ff9b35_58%,#d84f11_100%)] shadow-[0_14px_0_#713714,0_24px_42px_rgba(55,24,5,0.42)]"
            : "h-12 w-12 rounded-full border border-white/12 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),rgba(255,255,255,0.04)_48%,rgba(15,23,42,0.92))] shadow-[0_12px_28px_rgba(0,0,0,0.22)]",
          className,
        )}
        data-face-direction={faceDirection}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0",
            isHero
              ? "rounded-[2rem] bg-[radial-gradient(circle_at_32%_24%,rgba(255,255,255,0.48),transparent_30%),radial-gradient(circle_at_68%_80%,rgba(125,211,252,0.22),transparent_28%)]"
              : "rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(125,211,252,0.35),transparent_42%),radial-gradient(circle_at_70%_75%,rgba(244,114,182,0.18),transparent_42%)]",
          )}
        />
        {isHero ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-[10px] rounded-[1.6rem] border-2 border-white/35"
          />
        ) : null}
        <span
          className={cn(
            "relative transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            faceDirection === "away" ? "-scale-x-100 rotate-[3deg]" : "scale-x-100 rotate-0",
          )}
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
