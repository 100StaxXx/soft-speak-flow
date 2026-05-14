import {
  isCompanionSceneImageSource,
  shouldContainCompanionSceneImage,
} from "@/lib/companionImageFocal";

export const normalizeEvolutionCardImageUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const shouldUseContainedCompanionCardImage = (src?: string | null): boolean =>
  shouldContainCompanionSceneImage(src) || isCompanionSceneImageSource(src);

export const shouldUseCompanionSceneFramingForEvolutionCardImage = ({
  cardImageUrl,
  evolutionImageUrl,
  evolutionStage,
}: {
  cardImageUrl?: string | null;
  evolutionImageUrl?: string | null;
  evolutionStage: number;
}) => {
  const normalizedCardImageUrl = normalizeEvolutionCardImageUrl(cardImageUrl);
  const normalizedEvolutionImageUrl = normalizeEvolutionCardImageUrl(evolutionImageUrl);
  const resolvedImageUrl = normalizedCardImageUrl ?? normalizedEvolutionImageUrl;

  if (!shouldUseContainedCompanionCardImage(resolvedImageUrl)) return false;
  if (!normalizedCardImageUrl) return true;
  if (
    normalizedEvolutionImageUrl &&
    normalizedCardImageUrl === normalizedEvolutionImageUrl
  ) {
    return true;
  }

  return evolutionStage === 0;
};
