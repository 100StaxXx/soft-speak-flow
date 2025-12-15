import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseAdversaryImageParams {
  theme: string;
  tier: string;
  name: string;
  enabled?: boolean;
}

export const useAdversaryImage = ({ theme, tier, name, enabled = true }: UseAdversaryImageParams) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !theme || !tier) {
      return;
    }

    const fetchOrGenerateImage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // First check cache in database
        const { data: cachedImage } = await supabase
          .from('adversary_images')
          .select('image_url')
          .eq('theme', theme)
          .eq('tier', tier)
          .single();

        if (cachedImage?.image_url) {
          console.log(`Using cached adversary image for ${theme}/${tier}`);
          setImageUrl(cachedImage.image_url);
          setIsLoading(false);
          return;
        }

        // Generate new image via edge function
        console.log(`Generating new adversary image for ${theme}/${tier}`);
        const { data, error: fnError } = await supabase.functions.invoke('generate-adversary-image', {
          body: { theme, tier, name },
        });

        if (fnError) {
          throw new Error(fnError.message);
        }

        if (data?.imageUrl) {
          setImageUrl(data.imageUrl);
        } else if (data?.error) {
          throw new Error(data.error);
        }
      } catch (err) {
        console.error('Failed to get adversary image:', err);
        setError(err instanceof Error ? err.message : 'Failed to load image');
        // Don't block the encounter - just use fallback
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrGenerateImage();
  }, [theme, tier, name, enabled]);

  return { imageUrl, isLoading, error };
};