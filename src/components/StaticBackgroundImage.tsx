import type { CSSProperties } from "react";
import { getStaticBackgroundSrcSet, type StaticBackgroundAsset } from "@/assets/backgrounds";

interface StaticBackgroundImageProps {
  background: StaticBackgroundAsset;
  className?: string;
  style?: CSSProperties;
  objectPosition?: CSSProperties["objectPosition"];
  testId?: string;
}

const DEFAULT_CLASSNAME =
  "fixed inset-0 -z-10 h-full w-full object-cover object-center pointer-events-none select-none";

export const StaticBackgroundImage = ({
  background,
  className,
  style,
  objectPosition,
  testId,
}: StaticBackgroundImageProps) => (
  <img
    src={background.src}
    srcSet={getStaticBackgroundSrcSet(background)}
    sizes="100vw"
    alt=""
    aria-hidden="true"
    className={className ?? DEFAULT_CLASSNAME}
    draggable={false}
    decoding="async"
    loading="eager"
    style={{ objectPosition, ...style }}
    data-testid={testId}
  />
);
