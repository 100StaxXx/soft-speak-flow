import { memo, useState } from 'react';
import { Star, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useLegacyTraits, LegacyTrait } from '@/hooks/useLegacyTraits';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LegacyTraitsBadgeProps {
  className?: string;
}

export const LegacyTraitsBadge = memo(({ className }: LegacyTraitsBadgeProps) => {
  const { legacyTraits } = useLegacyTraits();
  const [open, setOpen] = useState(false);

  if (legacyTraits.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full",
            "bg-gradient-to-r from-amber-500/20 to-orange-500/20",
            "border border-amber-500/30",
            "text-xs font-medium text-amber-300",
            "hover:border-amber-500/50 transition-colors",
            className
          )}
        >
          <Star className="w-3 h-3 fill-amber-400" />
          <span>{legacyTraits.length} Legacy</span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400/30" />
            Legacy Traits
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1 text-sm text-muted-foreground mb-4">
          <p>Gifts passed down from companions of the past.</p>
        </div>

        <div className="space-y-3">
          {legacyTraits.map((trait, index) => (
            <LegacyTraitCard key={`${trait.trait}-${index}`} trait={trait} index={index} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
});

LegacyTraitsBadge.displayName = 'LegacyTraitsBadge';

interface LegacyTraitCardProps {
  trait: LegacyTrait;
  index: number;
}

const LegacyTraitCard = memo(({ trait, index }: LegacyTraitCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg p-3 border border-amber-500/20"
    >
      <div className="flex items-start gap-2">
        <Star className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-amber-300 text-sm">
            {trait.trait}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {trait.description}
          </p>
          <p className="text-xs text-amber-400/80 mt-1 flex items-center gap-1">
            <ChevronRight className="w-3 h-3" />
            {trait.bonus}
          </p>
          {trait.source_companion && (
            <p className="text-xs text-muted-foreground/60 mt-1 italic">
              From {trait.source_companion}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
});

LegacyTraitCard.displayName = 'LegacyTraitCard';
