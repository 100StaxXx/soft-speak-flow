import type { CSSProperties, ReactEventHandler } from "react";
import { getStaticBackgroundSrcSet, type StaticBackgroundAsset } from "@/assets/backgrounds";

interface StaticBackgroundImageProps {
  background: StaticBackgroundAsset;
  className?: string;
  style?: CSSProperties;
  objectPosition?: CSSProperties["objectPosition"];
  loading?: "eager" | "lazy";
  onError?: ReactEventHandler<HTMLImageElement>;
  testId?: string;
}

const DEFAULT_CLASSNAME =
  "fixed inset-0 -z-10 h-full w-full object-cover object-center pointer-events-none select-none";

export const StaticBackgroundImage = ({
  background,
  className,
  style,
  objectPosition,
  loading = "eager",
  onError,
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
    loading={loading}
    style={{ objectPosition, ...style }}
    onError={onError}
    data-testid={testId}
  />
);
