import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/queryKeys';

export function useWelcomeImage() {
  const { user } = useAuth();

  const { data: imageUrl, isLoading, error } = useQuery({
    queryKey: queryKeys.epics.welcomeImage(user?.id),
    queryFn: async () => {
      if (!user?.id) return null;

      // Check for cached image in DB
      const { data: existingImage } = await supabase
        .from('user_welcome_images')
        .select('image_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingImage?.image_url) {
        return existingImage.image_url;
      }

      // Generate new image via edge function
      const { data, error: fnError } = await supabase.functions.invoke(
        'generate-campaign-welcome-image',
        { body: { userId: user.id } }
      );

      if (fnError) throw fnError;
      return data?.imageUrl || null;
    },
    enabled: !!user?.id,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60, // 1 hour
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  return { 
    imageUrl: imageUrl || null, 
    isLoading, 
    error: error instanceof Error ? error.message : null 
  };
}