import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSmartDayPlanner, WizardStep } from '@/hooks/useSmartDayPlanner';
import { QuickStartStep } from './steps/QuickStartStep';
import { CheckInStep } from './steps/CheckInStep';
import { AnchorsStep } from './steps/AnchorsStep';
import { DayShapeStep } from './steps/DayShapeStep';
import { ReviewStep } from './steps/ReviewStep';
import { Compass, ChevronLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SmartDayPlannerWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planDate?: Date;
  onComplete?: () => void;
}

const STEP_CONFIG: Record<WizardStep, { title: string; subtitle: string; number: number }> = {
  quick_start: {
    title: "Plan Your Day",
    subtitle: "Your smart daily planning companion",
    number: 0,
  },
  check_in: {
    title: "How are you feeling?",
    subtitle: "Let's understand your energy and availability",
    number: 1,
  },
  anchors: {
    title: "Protect Your Streaks",
    subtitle: "Identify what matters most today",
    number: 2,
  },
  shape: {
    title: "Shape Your Quest",
    subtitle: "Design how your day flows",
    number: 3,
  },
  review: {
    title: "Your Day Awaits",
    subtitle: "Review and customize your plan",
    number: 4,
  },
};

export function SmartDayPlannerWizard({
  open,
  onOpenChange,
  planDate = new Date(),
  onComplete,
}: SmartDayPlannerWizardProps) {
  const planner = useSmartDayPlanner(planDate);
  const { step, prevStep, reset, savedPreferences, loadPreferences, resetPreferences, applyDefaults } = planner;
  const config = STEP_CONFIG[step];

  useEffect(() => {
    if (open) {
      reset();
      loadPreferences();
    }
  }, [open, reset, loadPreferences]);

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  const handleComplete = async () => {
    const saved = await planner.savePlan();
    if (saved) {
      onComplete?.();
      handleClose();
    }
  };

  const canGoBack = step !== 'quick_start' && step !== 'check_in';
  const showProgress = step !== 'quick_start';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-lg p-0 gap-0 overflow-hidden bg-background border-border/50"
        hideCloseButton
      >
        <div className="relative p-4 pb-2 border-b border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {canGoBack ? (
                <Button variant="ghost" size="icon" onClick={prevStep} className="h-8 w-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Compass className="h-4 w-4 text-primary" />
                </div>
              )}
              <div>
                <h2 className="font-semibold text-foreground">{config.title}</h2>
                <p className="text-xs text-muted-foreground">{config.subtitle}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {showProgress && (
            <div className="flex justify-center gap-1.5 mt-3">
              {[1, 2, 3, 4].map((num) => (
                <div
                  key={num}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    num === config.number ? "w-6 bg-primary" : num < config.number ? "w-1.5 bg-primary/50" : "w-1.5 bg-muted"
                  )}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-4 min-h-[400px] max-h-[60vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 'quick_start' && savedPreferences && (
                <QuickStartStep
                  savedPreferences={savedPreferences}
                  contactsNeedingAttentionCount={planner.contactsNeedingAttention.length}
                  onUseDefaults={applyDefaults}
                  onCustomize={() => planner.setStep('check_in')}
                  onReset={resetPreferences}
                />
              )}
              {step === 'check_in' && (
                <CheckInStep context={planner.context} updateContext={planner.updateContext} onNext={planner.nextStep} />
              )}
              {step === 'anchors' && (
                <AnchorsStep
                  context={planner.context}
                  updateContext={planner.updateContext}
                  habitsWithStreaks={planner.habitsWithStreaks}
                  upcomingMilestones={planner.upcomingMilestones}
                  existingTasks={planner.existingTasks}
                  contactsNeedingAttention={planner.contactsNeedingAttention}
                  isLoading={planner.isLoadingAnchors}
                  onNext={planner.nextStep}
                />
              )}
              {step === 'shape' && (
                <DayShapeStep
                  context={planner.context}
                  updateContext={planner.updateContext}
                  onNext={async () => {
                    await planner.generatePlan();
                    planner.nextStep();
                  }}
                  isGenerating={planner.isGenerating}
                />
              )}
              {step === 'review' && (
                <ReviewStep
                  generatedPlan={planner.generatedPlan}
                  onAdjust={planner.adjustPlan}
                  onSave={handleComplete}
                  isAdjusting={planner.isAdjusting}
                  error={planner.error}
                  hasContacts={planner.contactsNeedingAttention.length > 0}
                  onUpdateTask={planner.updateTaskInPlan}
                  onRemoveTask={planner.removeTaskFromPlan}
                  onReorderTasks={planner.reorderTasksInPlan}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
