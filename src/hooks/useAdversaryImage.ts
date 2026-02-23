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

interface CachedAdversaryImage {
  image_url: string;
  variant_index: number;
}

const DEFAULT_TARGET_VARIANTS = 3;
const MAX_TARGET_VARIANTS = 5;
const topUpTriggeredKeys = new Set<string>();

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

const pickDeterministicVariant = (variants: CachedAdversaryImage[], seed: string) => {
  const sorted = [...variants].sort((left, right) => left.variant_index - right.variant_index);
  const selectionIndex = hashString(seed) % sorted.length;
  return sorted[selectionIndex];
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
    let isMounted = true;

    const fetchCachedVariants = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data: cachedImages, error: cacheError } = await supabase
          .from('adversary_images')
          .select('image_url, variant_index')
          .eq('theme', theme)
          .eq('tier', tier)
          .order('variant_index', { ascending: true });

        if (cacheError) {
          throw cacheError;
        }

        if (!isMounted) return;

        const usableVariants = (cachedImages ?? [])
          .filter((row): row is CachedAdversaryImage =>
            typeof row.image_url === 'string' && typeof row.variant_index === 'number'
          );

        if (usableVariants.length > 0) {
          const selectedVariant = pickDeterministicVariant(usableVariants, variantSeed);
          setImageUrl(selectedVariant.image_url);
        } else {
          // Strict no-wait policy: show fallback art while background top-up runs.
          setImageUrl(null);
        }

        if (usableVariants.length < clampedTargetVariants && !topUpTriggeredKeys.has(topUpKey)) {
          topUpTriggeredKeys.add(topUpKey);

          supabase.functions
            .invoke('generate-adversary-image', {
              body: { theme, tier, name, targetVariants: clampedTargetVariants },
            })
            .then(({ data, error: fnError }) => {
              if (fnError) {
                throw new Error(fnError.message);
              }

              if (isMounted && usableVariants.length === 0 && typeof data?.imageUrl === 'string') {
                setImageUrl(data.imageUrl);
              }
            })
            .catch((topUpError) => {
              console.error('Background adversary image top-up failed:', topUpError);
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
