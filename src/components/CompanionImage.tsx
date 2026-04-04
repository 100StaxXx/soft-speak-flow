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

  return (
    <div
      className={cn("relative isolate overflow-hidden", className)}
      style={{
        backgroundImage: `radial-gradient(circle at 50% 22%, ${accentGlow} 0%, transparent 62%), linear-gradient(180deg, rgba(15, 23, 42, 0.78) 0%, rgba(15, 23, 42, 0.38) 100%)`,
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
