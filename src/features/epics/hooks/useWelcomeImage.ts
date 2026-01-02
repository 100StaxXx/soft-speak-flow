import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useWelcomeImage() {
  const { user } = useAuth();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const fetchOrGenerateImage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // First check if we have a cached image
        const { data: existingImage } = await supabase
          .from('user_welcome_images')
          .select('image_url')
          .eq('user_id', user.id)
          .single();

        if (existingImage?.image_url) {
          setImageUrl(existingImage.image_url);
          setIsLoading(false);
          return;
        }

        // Generate new image via edge function
        const { data, error: fnError } = await supabase.functions.invoke(
          'generate-campaign-welcome-image',
          { body: { userId: user.id } }
        );

        if (fnError) {
          throw fnError;
        }

        if (data?.imageUrl) {
          setImageUrl(data.imageUrl);
        }
      } catch (err) {
        console.error('Error fetching welcome image:', err);
        setError(err instanceof Error ? err.message : 'Failed to load image');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrGenerateImage();
  }, [user?.id]);

  return { imageUrl, isLoading, error };
}