import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface RhythmTrack {
  id: string;
  audio_url: string;
  bpm: number;
  duration_seconds: number;
  genre: string;
  prompt: string;
  play_count: number;
  upvotes: number;
  downvotes: number;
  score: number;
}

interface UseRhythmTrackReturn {
  track: RhythmTrack | null;
  isLoading: boolean;
  error: string | null;
  userRating: 'up' | 'down' | null;
  fetchRandomTrack: (difficulty?: string) => Promise<RhythmTrack | null>;
  rateTrack: (trackId: string, rating: 'up' | 'down') => Promise<boolean>;
  incrementPlayCount: (trackId: string) => Promise<void>;
}

export const useRhythmTrack = (): UseRhythmTrackReturn => {
  const { user } = useAuth();
  const [track, setTrack] = useState<RhythmTrack | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<'up' | 'down' | null>(null);

  // Fetch a random track weighted by score
  const fetchRandomTrack = useCallback(async (difficulty?: string): Promise<RhythmTrack | null> => {
    setIsLoading(true);
    setError(null);
    setUserRating(null);

    try {
      // Fetch tracks with scores using the view
      // Using raw query since the view isn't in types
      let query = supabase
        .from('rhythm_tracks')
        .select('*')
        .eq('is_active', true);

      if (difficulty && difficulty !== 'all') {
        query = query.or(`difficulty_tier.eq.${difficulty},difficulty_tier.eq.all`);
      }

      const { data: tracks, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching rhythm tracks:', fetchError);
        setError('Failed to load tracks');
        setIsLoading(false);
        return null;
      }

      if (!tracks || tracks.length === 0) {
        console.log('No rhythm tracks available');
        setError('No tracks available');
        setIsLoading(false);
        return null;
      }

      // Fetch ratings for weighted selection
      const trackIds = tracks.map(t => t.id);
      const { data: ratings } = await supabase
        .from('rhythm_track_ratings')
        .select('track_id, rating')
        .in('track_id', trackIds);

      // Calculate scores for each track
      const tracksWithScores = tracks.map(t => {
        const trackRatings = ratings?.filter(r => r.track_id === t.id) || [];
        const upvotes = trackRatings.filter(r => r.rating === 'up').length;
        const downvotes = trackRatings.filter(r => r.rating === 'down').length;
        const score = upvotes - downvotes;
        return { ...t, upvotes, downvotes, score };
      });

      // Filter out heavily downvoted tracks
      const validTracks = tracksWithScores.filter(t => t.score >= -5);

      if (validTracks.length === 0) {
        // Fallback to all tracks if everything is downvoted
        const randomTrack = tracksWithScores[Math.floor(Math.random() * tracksWithScores.length)];
        setTrack(randomTrack);
        await fetchUserRating(randomTrack.id);
        setIsLoading(false);
        return randomTrack;
      }

      // Weighted random selection favoring higher-rated tracks
      const weights = validTracks.map(t => Math.max(1, t.score + 10));
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let random = Math.random() * totalWeight;

      let selectedTrack = validTracks[0];
      for (let i = 0; i < validTracks.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          selectedTrack = validTracks[i];
          break;
        }
      }

      setTrack(selectedTrack);
      await fetchUserRating(selectedTrack.id);
      setIsLoading(false);
      return selectedTrack;

    } catch (err) {
      console.error('Error in fetchRandomTrack:', err);
      setError('Failed to load track');
      setIsLoading(false);
      return null;
    }
  }, []);

  // Fetch user's existing rating for a track
  const fetchUserRating = async (trackId: string) => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('rhythm_track_ratings')
      .select('rating')
      .eq('track_id', trackId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setUserRating(data.rating as 'up' | 'down');
    }
  };

  // Rate a track (thumbs up/down)
  const rateTrack = useCallback(async (trackId: string, rating: 'up' | 'down'): Promise<boolean> => {
    if (!user?.id) {
      console.error('User not authenticated');
      return false;
    }

    try {
      // Upsert rating (insert or update)
      const { error: rateError } = await supabase
        .from('rhythm_track_ratings')
        .upsert({
          track_id: trackId,
          user_id: user.id,
          rating,
        }, {
          onConflict: 'track_id,user_id',
        });

      if (rateError) {
        console.error('Error rating track:', rateError);
        return false;
      }

      setUserRating(rating);

      // Update local track score
      if (track && track.id === trackId) {
        const scoreDelta = rating === 'up' ? 1 : -1;
        setTrack(prev => prev ? {
          ...prev,
          upvotes: rating === 'up' ? prev.upvotes + 1 : prev.upvotes,
          downvotes: rating === 'down' ? prev.downvotes + 1 : prev.downvotes,
          score: prev.score + scoreDelta,
        } : null);
      }

      return true;

    } catch (err) {
      console.error('Error rating track:', err);
      return false;
    }
  }, [user?.id, track]);

  // Increment play count for analytics
  const incrementPlayCount = useCallback(async (trackId: string) => {
    try {
      // Simple increment using update - non-critical analytics
      const { data: currentTrack } = await supabase
        .from('rhythm_tracks')
        .select('play_count')
        .eq('id', trackId)
        .single();
      
      if (currentTrack) {
        await supabase
          .from('rhythm_tracks')
          .update({ play_count: (currentTrack.play_count || 0) + 1 })
          .eq('id', trackId);
      }
    } catch (err) {
      // Non-critical, just log
      console.error('Error incrementing play count:', err);
    }
  }, []);

  return {
    track,
    isLoading,
    error,
    userRating,
    fetchRandomTrack,
    rateTrack,
    incrementPlayCount,
  };
};
