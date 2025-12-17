import { motion } from 'framer-motion';
import { ThumbsUp, ThumbsDown, Music, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { triggerHaptic } from './gameUtils';

interface TrackRatingUIProps {
  trackName?: string;
  onRate: (rating: 'up' | 'down') => void;
  onSkip: () => void;
  isSubmitting?: boolean;
  currentRating?: 'up' | 'down' | null;
}

export const TrackRatingUI = ({
  trackName,
  onRate,
  onSkip,
  isSubmitting = false,
  currentRating,
}: TrackRatingUIProps) => {
  const handleRate = (rating: 'up' | 'down') => {
    triggerHaptic('medium');
    onRate(rating);
  };

  return (
    <motion.div
      className="flex flex-col items-center gap-4 p-6 rounded-2xl"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card) / 0.8) 100%)',
        border: '1px solid hsl(var(--border) / 0.5)',
        boxShadow: '0 8px 32px hsl(var(--primary) / 0.15)',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 text-primary">
        <Music className="w-5 h-5" />
        <span className="text-lg font-semibold">Rate this track!</span>
      </div>

      {/* Track name if provided */}
      {trackName && (
        <p className="text-sm text-muted-foreground text-center max-w-[200px] truncate">
          {trackName}
        </p>
      )}

      {/* Rating buttons */}
      <div className="flex items-center gap-4">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant={currentRating === 'up' ? 'default' : 'outline'}
            size="lg"
            onClick={() => handleRate('up')}
            disabled={isSubmitting}
            className="flex items-center gap-2 min-w-[100px]"
            style={{
              background: currentRating === 'up' 
                ? 'linear-gradient(135deg, hsl(142, 71%, 45%), hsl(142, 71%, 35%))' 
                : undefined,
              borderColor: 'hsl(142, 71%, 45%)',
            }}
          >
            <ThumbsUp className={`w-5 h-5 ${currentRating === 'up' ? 'fill-current' : ''}`} />
            <span>Like</span>
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant={currentRating === 'down' ? 'default' : 'outline'}
            size="lg"
            onClick={() => handleRate('down')}
            disabled={isSubmitting}
            className="flex items-center gap-2 min-w-[100px]"
            style={{
              background: currentRating === 'down' 
                ? 'linear-gradient(135deg, hsl(0, 84%, 60%), hsl(0, 84%, 50%))' 
                : undefined,
              borderColor: 'hsl(0, 84%, 60%)',
            }}
          >
            <ThumbsDown className={`w-5 h-5 ${currentRating === 'down' ? 'fill-current' : ''}`} />
            <span>Dislike</span>
          </Button>
        </motion.div>
      </div>

      {/* Skip option */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onSkip}
        disabled={isSubmitting}
        className="text-muted-foreground hover:text-foreground"
      >
        <SkipForward className="w-4 h-4 mr-1" />
        Skip
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Your feedback helps improve future tracks!
      </p>
    </motion.div>
  );
};
