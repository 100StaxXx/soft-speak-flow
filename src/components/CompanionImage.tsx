import { forwardRef } from "react";
import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  ImgHTMLAttributes,
} from "react";
import { AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { resolveCompanionImagePresentation } from "@/lib/companionImageFocal";

type CommonCompanionImageProps = {
  src?: string | null;
  alt: string;
  fit?: "cover" | "contain";
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

export const CompanionImage = forwardRef<HTMLImageElement, CompanionImageProps>(
  (
    {
      variant = "img",
      src,
      alt,
      fit = "cover",
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

    const mergedClassName = cn(
      "h-full w-full",
      fit === "contain" ? "object-contain" : "object-cover",
      className,
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
    };

    if (variant === "avatar") {
      return <AvatarImage {...sharedProps} {...rest} />;
    }

    return <img {...sharedProps} {...rest} />;
  },
);

CompanionImage.displayName = "CompanionImage";
