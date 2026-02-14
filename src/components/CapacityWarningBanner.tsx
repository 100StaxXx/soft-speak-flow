import { memo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CapacityWarningBannerProps {
  isAtEpicLimit?: boolean;
  isOverloaded?: boolean;
  suggestedWorkload?: 'light' | 'normal' | 'heavy';
  isLoading?: boolean;
  className?: string;
}

export const CapacityWarningBanner = memo(function CapacityWarningBanner({
  isAtEpicLimit = false,
  isOverloaded = false,
  suggestedWorkload = 'normal',
  isLoading = false,
  className,
}: CapacityWarningBannerProps) {
  const showWarning = isAtEpicLimit || isOverloaded;

  if (isLoading) {
    return null;
  }

  return (
    <AnimatePresence>
      {showWarning && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className={cn(
            "px-3 py-2 rounded-lg text-xs flex items-center gap-2",
            isOverloaded 
              ? "bg-destructive/10 border border-destructive/30 text-destructive"
              : "bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400",
            className
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {isOverloaded 
              ? "You seem overloaded. Consider simplifying current habits first."
              : isAtEpicLimit 
                ? "You have 2 active epics. Complete one before starting another."
                : suggestedWorkload === 'light'
                  ? "Consider a lighter workload today."
                  : null
            }
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
