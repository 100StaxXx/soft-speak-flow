import { getStaticBackgroundSrcSet, type StaticBackgroundAsset } from "@/assets/backgrounds";

interface StaticBackgroundImageProps {
  background: StaticBackgroundAsset;
  className?: string;
}

const DEFAULT_CLASSNAME =
  "fixed inset-0 -z-10 h-full w-full object-cover object-center pointer-events-none select-none";

export const StaticBackgroundImage = ({
  background,
  className,
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
  />
);
