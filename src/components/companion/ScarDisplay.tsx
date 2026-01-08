import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Moon, Heart, Flame, Sparkles, Shield, Mountain, Compass, 
  ChevronRight, History 
} from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCompanionScars, SCAR_TYPE_INFO, type Scar, type ScarType } from '@/hooks/useCompanionScars';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// Icon mapping for scar types
const SCAR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Moon,
  Heart,
  Flame,
  Sparkles,
  Shield,
  Mountain,
  Compass,
};

interface ScarBadgeProps {
  scar: Scar;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export const ScarBadge = memo(({ scar, size = 'md', showTooltip = true }: ScarBadgeProps) => {
  const scarInfo = SCAR_TYPE_INFO[scar.type];
  const IconComponent = SCAR_ICONS[scarInfo.icon] || Sparkles;
  
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const badge = (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        sizeClasses[size],
        "relative rounded-full flex items-center justify-center",
        "bg-gradient-to-br from-slate-700/80 to-slate-800/80",
        "border border-amber-500/30 shadow-inner",
        "hover:border-amber-400/50 transition-all cursor-pointer"
      )}
    >
      {/* Subtle glow effect */}
      <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-sm" />
      <IconComponent className={cn(iconSizes[size], "text-amber-400/80 relative z-10")} />
    </motion.div>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium text-amber-300">{scarInfo.name}</p>
            <p className="text-xs text-muted-foreground">{scarInfo.description}</p>
            <p className="text-[10px] text-muted-foreground/70">
              Earned {formatDistanceToNow(new Date(scar.earnedAt), { addSuffix: true })}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

ScarBadge.displayName = 'ScarBadge';

interface ScarCollectionProps {
  maxDisplay?: number;
  className?: string;
}

export const ScarCollection = memo(({ maxDisplay = 4, className }: ScarCollectionProps) => {
  const { scars, totalScars, isLoading } = useCompanionScars();

  const displayedScars = useMemo(() => {
    return scars.slice(-maxDisplay).reverse();
  }, [scars, maxDisplay]);

  const remainingCount = Math.max(0, totalScars - maxDisplay);

  if (isLoading || scars.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "flex items-center gap-1 p-2 rounded-xl cursor-pointer",
            "bg-slate-800/40 border border-slate-700/50",
            "hover:bg-slate-800/60 hover:border-amber-500/30 transition-all",
            className
          )}
        >
          {/* Scar badges */}
          <div className="flex -space-x-2">
            <AnimatePresence>
              {displayedScars.map((scar, index) => (
                <motion.div
                  key={scar.id}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  style={{ zIndex: displayedScars.length - index }}
                >
                  <ScarBadge scar={scar} size="sm" showTooltip={false} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          {/* Count indicator */}
          {remainingCount > 0 && (
            <span className="text-xs text-muted-foreground ml-1">
              +{remainingCount}
            </span>
          )}
          
          <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto" />
        </motion.div>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
              Marks of Journey
            </span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4 py-2">
            {scars.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                Your companion has no scars yet. Scars are earned through significant events in your journey together.
              </p>
            ) : (
              scars.map((scar) => (
                <ScarHistoryItem key={scar.id} scar={scar} />
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
});

ScarCollection.displayName = 'ScarCollection';

interface ScarHistoryItemProps {
  scar: Scar;
}

const ScarHistoryItem = memo(({ scar }: ScarHistoryItemProps) => {
  const scarInfo = SCAR_TYPE_INFO[scar.type];
  const IconComponent = SCAR_ICONS[scarInfo.icon] || Sparkles;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50"
    >
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center border border-amber-500/30 flex-shrink-0">
        <IconComponent className="w-5 h-5 text-amber-400" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-medium text-amber-300 text-sm truncate">
            {scarInfo.name}
          </h4>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {formatDistanceToNow(new Date(scar.earnedAt), { addSuffix: true })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {scar.context}
        </p>
      </div>
    </motion.div>
  );
});

ScarHistoryItem.displayName = 'ScarHistoryItem';

// Export a simple indicator for the companion display
interface ScarIndicatorProps {
  className?: string;
}

export const ScarIndicator = memo(({ className }: ScarIndicatorProps) => {
  const { totalScars, latestScar, isLoading } = useCompanionScars();

  if (isLoading || totalScars === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full",
              "bg-amber-500/10 border border-amber-500/30",
              "cursor-pointer hover:bg-amber-500/20 transition-all",
              className
            )}
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span className="text-xs font-medium text-amber-300">{totalScars}</span>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-sm">
            {totalScars} mark{totalScars !== 1 ? 's' : ''} of survival
          </p>
          {latestScar && (
            <p className="text-xs text-muted-foreground">
              Latest: {SCAR_TYPE_INFO[latestScar.type].name}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

ScarIndicator.displayName = 'ScarIndicator';
