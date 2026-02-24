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
const MISSING_COLUMN_CODE = '42703';
const topUpRequestStatus = new Map<string, 'in_flight' | 'success'>();

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

const isMissingVariantColumnError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as { code?: string; message?: string };
  if (maybeError.code === MISSING_COLUMN_CODE) return true;

  const message = (maybeError.message || '').toLowerCase();
  return message.includes('variant_index') && message.includes('does not exist');
};

const normalizeVariantRows = (rows: Array<{ image_url?: unknown; variant_index?: unknown }>) => {
  const variantsByIndex = new Map<number, CachedAdversaryImage>();

  for (const row of rows) {
    if (typeof row?.image_url !== 'string') continue;

    const index = typeof row.variant_index === 'number' && Number.isFinite(row.variant_index)
      ? Math.floor(row.variant_index)
      : 0;

    if (!variantsByIndex.has(index)) {
      variantsByIndex.set(index, {
        image_url: row.image_url,
        variant_index: index,
      });
    }
  }

  return Array.from(variantsByIndex.values())
    .sort((left, right) => left.variant_index - right.variant_index);
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
        const { data: variantRows, error: variantError } = await supabase
          .from('adversary_images')
          .select('image_url, variant_index')
          .eq('theme', theme)
          .eq('tier', tier)
          .order('variant_index', { ascending: true });

        let usableVariants: CachedAdversaryImage[];

        if (!variantError) {
          usableVariants = normalizeVariantRows((variantRows ?? []) as Array<{ image_url?: unknown; variant_index?: unknown }>);
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

          usableVariants = normalizeVariantRows((legacyRows ?? []) as Array<{ image_url?: unknown; variant_index?: unknown }>);
        } else {
          throw variantError;
        }

        if (!isMounted) return;

        if (usableVariants.length > 0) {
          const selectedVariant = pickDeterministicVariant(usableVariants, variantSeed);
          setImageUrl(selectedVariant.image_url);
        } else {
          // Strict no-wait policy: show fallback art while background top-up runs.
          setImageUrl(null);
        }

        const existingTopUpStatus = topUpRequestStatus.get(topUpKey);
        const canTriggerTopUp = existingTopUpStatus !== 'in_flight' && existingTopUpStatus !== 'success';

        if (usableVariants.length < clampedTargetVariants && canTriggerTopUp) {
          topUpRequestStatus.set(topUpKey, 'in_flight');

          supabase.functions
            .invoke('generate-adversary-image', {
              body: { theme, tier, name, targetVariants: clampedTargetVariants },
            })
            .then(({ data, error: fnError }) => {
              if (fnError) {
                throw new Error(fnError.message);
              }

              topUpRequestStatus.set(topUpKey, 'success');
              if (isMounted && usableVariants.length === 0 && typeof data?.imageUrl === 'string') {
                setImageUrl(data.imageUrl);
              }
            })
            .catch((topUpError) => {
              topUpRequestStatus.delete(topUpKey);
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
