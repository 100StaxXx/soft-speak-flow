import { forwardRef } from "react";
import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  ImgHTMLAttributes,
  ReactNode,
} from "react";
import { AvatarImage } from "@/components/ui/avatar";
import { getCompanionElement } from "@/config/companionCatalog";
import { cn } from "@/lib/utils";
import { resolveCompanionImagePresentation } from "@/lib/companionImageFocal";

type CommonCompanionImageProps = {
  src?: string | null;
  alt: string;
  fit?: "cover" | "contain" | "portrait";
  element?: string | null;
  focalX?: number | null;
  focalY?: number | null;
  containerAspectRatio?: number;
  className?: string;
  style?: CSSProperties;
};

type CompanionNativeImageProps = CommonCompanionImageProps &
  Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "style" | "className"> & {
    variant?: "img";
  };

type CompanionAvatarImageProps = CommonCompanionImageProps &
  Omit<ComponentPropsWithoutRef<typeof AvatarImage>, "src" | "alt" | "style" | "className"> & {
    variant: "avatar";
  };

export type CompanionImageProps = CompanionNativeImageProps | CompanionAvatarImageProps;

interface CompanionPortraitShellProps extends ComponentPropsWithoutRef<"div"> {
  src?: string | null;
  element?: string | null;
  children: ReactNode;
  contentClassName?: string;
}

const hexToRgba = (value: string, alpha: number): string => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(value.trim());
  if (!match) return `rgba(148, 163, 184, ${alpha})`;
  const [, r, g, b] = match;
  return `rgba(${Number.parseInt(r, 16)}, ${Number.parseInt(g, 16)}, ${Number.parseInt(b, 16)}, ${alpha})`;
};

const ELEMENT_SCENE_BACKDROPS: Record<string, string> = {
  fire:
    "radial-gradient(circle at 50% 72%, rgba(249, 115, 22, 0.36) 0%, transparent 42%), linear-gradient(150deg, rgba(40, 11, 8, 0.94) 0%, rgba(84, 32, 12, 0.68) 46%, rgba(10, 16, 24, 0.9) 100%)",
  ice:
    "radial-gradient(circle at 48% 72%, rgba(125, 211, 252, 0.32) 0%, transparent 44%), linear-gradient(150deg, rgba(8, 28, 52, 0.92) 0%, rgba(24, 75, 112, 0.64) 48%, rgba(8, 15, 30, 0.92) 100%)",
  storm:
    "radial-gradient(circle at 50% 70%, rgba(99, 102, 241, 0.32) 0%, transparent 44%), linear-gradient(145deg, rgba(15, 23, 42, 0.94) 0%, rgba(55, 48, 163, 0.66) 48%, rgba(7, 16, 28, 0.92) 100%)",
  nature:
    "radial-gradient(circle at 50% 72%, rgba(52, 211, 153, 0.28) 0%, transparent 44%), linear-gradient(145deg, rgba(9, 38, 29, 0.94) 0%, rgba(49, 98, 51, 0.62) 48%, rgba(8, 19, 21, 0.92) 100%)",
  void:
    "radial-gradient(circle at 50% 70%, rgba(168, 85, 247, 0.34) 0%, transparent 46%), linear-gradient(145deg, rgba(12, 8, 28, 0.96) 0%, rgba(70, 28, 118, 0.66) 46%, rgba(4, 9, 20, 0.94) 100%)",
  light:
    "radial-gradient(circle at 50% 70%, rgba(250, 204, 21, 0.3) 0%, transparent 44%), linear-gradient(150deg, rgba(42, 33, 18, 0.92) 0%, rgba(131, 105, 55, 0.54) 46%, rgba(12, 22, 33, 0.9) 100%)",
};

const DEFAULT_SCENE_BACKDROP =
  "radial-gradient(circle at 50% 72%, rgba(148, 163, 184, 0.22) 0%, transparent 44%), linear-gradient(150deg, rgba(15, 23, 42, 0.94) 0%, rgba(51, 65, 85, 0.58) 48%, rgba(8, 13, 24, 0.92) 100%)";

const getElementSceneBackdrop = (element?: string | null): string => {
  const normalizedElement = element?.trim().toLowerCase() ?? "";
  return ELEMENT_SCENE_BACKDROPS[normalizedElement] ?? DEFAULT_SCENE_BACKDROP;
};

export function CompanionPortraitShell({
  src,
  element,
  className,
  children,
  contentClassName,
  style,
  ...rest
}: CompanionPortraitShellProps) {
  const elementMeta = element ? getCompanionElement(element) : null;
  const accentGlow = elementMeta
    ? hexToRgba(elementMeta.anchorColor, 0.22)
    : "rgba(148, 163, 184, 0.18)";
  const accentHalo = elementMeta
    ? hexToRgba(elementMeta.accentColor, 0.18)
    : "rgba(226, 232, 240, 0.14)";
  const sceneBackdrop = getElementSceneBackdrop(element);

  return (
    <div
      className={cn("relative isolate overflow-hidden", className)}
      style={{
        backgroundImage: `radial-gradient(circle at 50% 22%, ${accentGlow} 0%, transparent 62%), ${sceneBackdrop}`,
        ...style,
      }}
      {...rest}
    >
      {src ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 scale-110 opacity-30 blur-2xl"
          style={{
            backgroundImage: `url(${src})`,
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
          }}
        />
      ) : null}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 28%, ${accentHalo} 0%, transparent 58%)`,
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.13),transparent_28%,rgba(0,0,0,0.22))]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_58%)]" />
      <div className={cn("relative z-10 h-full w-full", contentClassName)}>
        {children}
      </div>
    </div>
  );
}

export const CompanionImage = forwardRef<HTMLImageElement, CompanionImageProps>(
  (
    {
      variant = "img",
      src,
      alt,
      fit = "cover",
      element,
      focalX,
      focalY,
      containerAspectRatio = 1,
      className,
      style,
      ...rest
    },
    ref,
  ) => {
    const presentation = resolveCompanionImagePresentation({
      src,
      fit,
      focalX,
      focalY,
      containerAspectRatio,
    });

    const mergedStyle = {
      ...presentation.style,
      ...style,
    };

    const containLikeFit = fit === "contain" || fit === "portrait";
    const mergedClassName = cn(
      "h-full w-full",
      className,
      containLikeFit ? "object-contain" : "object-cover",
    );

    const sharedProps = {
      ref,
      src: src ?? undefined,
      alt,
      className: mergedClassName,
      style: mergedStyle,
      "data-companion-image-fit": fit,
      "data-companion-image-focal-source": presentation.focalSource,
      "data-companion-image-asset-key": presentation.assetKey ?? undefined,
      "data-companion-image-element": element ?? undefined,
    };

    if (variant === "avatar") {
      return <AvatarImage {...sharedProps} {...rest} />;
    }

    return <img {...sharedProps} {...rest} />;
  },
);

CompanionImage.displayName = "CompanionImage";
