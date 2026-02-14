import { memo, useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePromotionOpportunities, PromotionOpportunity } from '@/hooks/usePromotionOpportunities';
import { PromotionOpportunityCard } from './PromotionOpportunityCard';
import { Pathfinder } from './Pathfinder/Pathfinder';
import { useEpics } from '@/hooks/useEpics';
import { toast } from 'sonner';
import { safeLocalStorage } from '@/utils/storage';

const DISMISSED_OPPORTUNITIES_KEY = 'dismissed_promotion_opportunities';

interface PromotionOpportunitiesSectionProps {
  maxVisible?: number;
  compact?: boolean;
}

export const PromotionOpportunitiesSection = memo(function PromotionOpportunitiesSection({
  maxVisible = 2,
  compact = false,
}: PromotionOpportunitiesSectionProps) {
  const { opportunities, isLoading, hasOpportunities, refetch } = usePromotionOpportunities();
  const { createEpic, isCreating } = useEpics();
  const [showAll, setShowAll] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    // Load dismissed IDs from localStorage on mount
    const stored = safeLocalStorage.getItem(DISMISSED_OPPORTUNITIES_KEY);
    if (stored) {
      try {
        return new Set(JSON.parse(stored));
      } catch {
        return new Set();
      }
    }
    return new Set();
  });
  const [selectedOpportunity, setSelectedOpportunity] = useState<PromotionOpportunity | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Persist dismissed IDs to localStorage
  useEffect(() => {
    safeLocalStorage.setItem(DISMISSED_OPPORTUNITIES_KEY, JSON.stringify([...dismissedIds]));
  }, [dismissedIds]);

  // Filter out dismissed opportunities
  const visibleOpportunities = opportunities.filter(
    opp => !dismissedIds.has(opp.sourceIds.join('-'))
  );

  const displayedOpportunities = showAll 
    ? visibleOpportunities 
    : visibleOpportunities.slice(0, maxVisible);

  const handlePromote = (opportunity: PromotionOpportunity) => {
    setSelectedOpportunity(opportunity);
    setShowWizard(true);
  };

  const handleDismiss = (opportunity: PromotionOpportunity) => {
    setDismissedIds(prev => new Set([...prev, opportunity.sourceIds.join('-')]));
  };

  const handleEpicCreated = (data: Parameters<typeof createEpic>[0]) => {
    createEpic(data);
    setShowWizard(false);
    setSelectedOpportunity(null);
    toast.success('Epic created from opportunity!');
    refetch();
  };

  const handleWizardClose = (open: boolean) => {
    if (!open) {
      setShowWizard(false);
      setSelectedOpportunity(null);
    }
  };

  if (isLoading || !hasOpportunities || visibleOpportunities.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Growth Opportunities</h3>
          </div>
          {visibleOpportunities.length > maxVisible && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? (
                <>
                  Show Less <ChevronUp className="h-3 w-3 ml-1" />
                </>
              ) : (
                <>
                  +{visibleOpportunities.length - maxVisible} More <ChevronDown className="h-3 w-3 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>

        {/* Opportunities list */}
        <AnimatePresence mode="popLayout">
          <div className={compact ? "space-y-2" : "space-y-3"}>
            {displayedOpportunities.map((opportunity) => (
              <PromotionOpportunityCard
                key={opportunity.sourceIds.join('-')}
                opportunity={opportunity}
                onPromote={handlePromote}
                onDismiss={handleDismiss}
                compact={compact}
              />
            ))}
          </div>
        </AnimatePresence>
      </div>

      {/* Pathfinder Modal */}
      {selectedOpportunity && (
        <Pathfinder
          open={showWizard}
          onOpenChange={handleWizardClose}
          onCreateEpic={handleEpicCreated}
          isCreating={isCreating}
          initialGoal={selectedOpportunity.suggestedEpicTitle || selectedOpportunity.title}
          initialTargetDays={selectedOpportunity.suggestedDuration || 30}
        />
      )}
    </>
  );
});
