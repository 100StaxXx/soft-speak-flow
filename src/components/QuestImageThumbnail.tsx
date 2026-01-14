import { useState } from 'react';
import { X, Expand, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface QuestImageThumbnailProps {
  imageUrl: string;
  onRemove?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  removable?: boolean;
}

export function QuestImageThumbnail({
  imageUrl,
  onRemove,
  size = 'md',
  className,
  removable = true,
}: QuestImageThumbnailProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [showFullSize, setShowFullSize] = useState(false);
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  if (hasError) {
    return null;
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className={cn(
          "relative group rounded-lg overflow-hidden border border-border bg-muted/50",
          sizeClasses[size],
          className
        )}
      >
        {/* Loading skeleton */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-muted"
            >
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image */}
        <img
          src={imageUrl}
          alt="Quest attachment"
          className={cn(
            "w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105",
            isLoading && "opacity-0"
          )}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          onClick={() => setShowFullSize(true)}
        />

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowFullSize(true)}
            className="h-6 w-6 text-white hover:text-white hover:bg-white/20"
          >
            <Expand className="h-3 w-3" />
          </Button>
          {removable && onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="h-6 w-6 text-white hover:text-destructive hover:bg-white/20"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Remove button always visible on mobile */}
        {removable && onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm md:hidden"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
      </motion.div>

      {/* Full-size image dialog */}
      <Dialog open={showFullSize} onOpenChange={setShowFullSize}>
        <DialogContent className="max-w-3xl p-2 bg-background/95 backdrop-blur-sm">
          <DialogTitle className="sr-only">Quest Image</DialogTitle>
          <div className="relative">
            <img
              src={imageUrl}
              alt="Quest attachment full size"
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
