import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseAdversaryImageParams {
  theme: string;
  tier: string;
  name: string;
  selectionSeed?: string;
  targetVariants?: number;
  enabled?: boolean;
}

interface VariantIndexRow {
  variant_index: number;
}

const DEFAULT_TARGET_VARIANTS = 5;
const MAX_TARGET_VARIANTS = 5;
const MISSING_COLUMN_CODE = '42703';
const topUpInFlightKeys = new Set<string>();
const selectedImageCache = new Map<string, string>();

const clampVariants = (value: number | undefined) => {
  if (!Number.isFinite(value)) return DEFAULT_TARGET_VARIANTS;
  return Math.max(1, Math.min(MAX_TARGET_VARIANTS, Math.floor(value as number)));
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const isMissingVariantColumnError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as { code?: string; message?: string };
  if (maybeError.code === MISSING_COLUMN_CODE) return true;

  const message = (maybeError.message || '').toLowerCase();
  return message.includes('variant_index') && message.includes('does not exist');
};

const normalizeVariantIndexes = (rows: Array<{ variant_index?: unknown }>) => {
  const indexes = new Set<number>();
  for (const row of rows) {
    if (typeof row?.variant_index !== 'number' || !Number.isFinite(row.variant_index)) continue;
    indexes.add(Math.floor(row.variant_index));
  }
  return Array.from(indexes).sort((left, right) => left - right);
};

export const useAdversaryImage = ({
  theme,
  tier,
  name,
  selectionSeed,
  targetVariants = DEFAULT_TARGET_VARIANTS,
  enabled = true,
}: UseAdversaryImageParams) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !theme || !tier) {
      setImageUrl(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const clampedTargetVariants = clampVariants(targetVariants);
    const topUpKey = `${theme}:${tier}:${clampedTargetVariants}`;
    const variantSeed = selectionSeed?.trim() || name.trim() || `${theme}:${tier}`;
    const selectedImageCacheKey = `${theme}:${tier}:${variantSeed}`;
    let isMounted = true;

    const cachedSelectionImage = selectedImageCache.get(selectedImageCacheKey);
    if (cachedSelectionImage) {
      setImageUrl(cachedSelectionImage);
    }

    const fetchCachedVariants = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data: variantIndexRows, error: variantError } = await supabase
          .from('adversary_images')
          .select('variant_index')
          .eq('theme', theme)
          .eq('tier', tier)
          .order('variant_index', { ascending: true });

        let availableVariantCount = 0;
        let selectedImageUrl: string | null = null;

        if (!variantError) {
          const variantIndexes = normalizeVariantIndexes((variantIndexRows ?? []) as Array<VariantIndexRow>);
          availableVariantCount = variantIndexes.length;

          if (variantIndexes.length > 0) {
            const selectedVariantIndex = variantIndexes[hashString(variantSeed) % variantIndexes.length];
            const { data: selectedImageRows, error: selectedImageError } = await supabase
              .from('adversary_images')
              .select('image_url, variant_index')
              .eq('theme', theme)
              .eq('tier', tier)
              .eq('variant_index', selectedVariantIndex)
              .order('variant_index', { ascending: true });

            if (selectedImageError) {
              throw selectedImageError;
            }

            const selectedImageRow = selectedImageRows?.[0];
            if (selectedImageRow && typeof selectedImageRow.image_url === 'string') {
              selectedImageUrl = selectedImageRow.image_url;
            }
          }
        } else if (isMissingVariantColumnError(variantError)) {
          const { data: legacyRows, error: legacyError } = await supabase
            .from('adversary_images')
            .select('image_url')
            .eq('theme', theme)
            .eq('tier', tier)
            .order('created_at', { ascending: true });

          if (legacyError) {
            throw legacyError;
          }

          const legacyRow = legacyRows?.[0];
          if (legacyRow && typeof legacyRow.image_url === 'string') {
            selectedImageUrl = legacyRow.image_url;
            availableVariantCount = 1;
          }
        } else {
          throw variantError;
        }

        if (!isMounted) return;

        if (selectedImageUrl) {
          setImageUrl(selectedImageUrl);
          selectedImageCache.set(selectedImageCacheKey, selectedImageUrl);
        } else {
          // Strict no-wait policy: show fallback art while background top-up runs.
          setImageUrl(null);
        }

        const canTriggerTopUp = !topUpInFlightKeys.has(topUpKey);

        if (availableVariantCount < clampedTargetVariants && canTriggerTopUp) {
          topUpInFlightKeys.add(topUpKey);

          supabase.functions
            .invoke('generate-adversary-image', {
              body: {
                theme,
                tier,
                name,
                targetVariants: clampedTargetVariants,
                selectionSeed: variantSeed,
              },
            })
            .then(({ data, error: fnError }) => {
              if (fnError) {
                throw new Error(fnError.message);
              }

              if (isMounted && !selectedImageUrl && typeof data?.imageUrl === 'string') {
                setImageUrl(data.imageUrl);
                selectedImageCache.set(selectedImageCacheKey, data.imageUrl);
              }
            })
            .catch((topUpError) => {
              console.error('Background adversary image top-up failed:', topUpError);
            })
            .finally(() => {
              topUpInFlightKeys.delete(topUpKey);
            });
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to fetch cached adversary variants:', err);
        setError(err instanceof Error ? err.message : 'Failed to load image');
        setImageUrl(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchCachedVariants();

    return () => {
      isMounted = false;
    };
  }, [theme, tier, name, enabled, selectionSeed, targetVariants]);

  return { imageUrl, isLoading, error };
};
