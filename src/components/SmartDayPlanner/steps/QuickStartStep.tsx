import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Zap, Settings, RotateCcw, Clock, Battery, Sparkles, Users } from 'lucide-react';

interface SavedPreferences {
  defaultEnergyLevel: string;
  defaultFlexHours: number;
  defaultDayShape: string;
  includeRelationshipTasks: boolean;
  timesUsed: number;
}

interface QuickStartStepProps {
  savedPreferences: SavedPreferences | null;
  contactsNeedingAttentionCount: number;
  onUseDefaults: () => void;
  onCustomize: () => void;
  onReset: () => void;
}

export function QuickStartStep({
  savedPreferences,
  contactsNeedingAttentionCount,
  onUseDefaults,
  onCustomize,
  onReset,
}: QuickStartStepProps) {
  if (!savedPreferences) {
    // First time user - go straight to customize
    return null;
  }

  const energyLabel = savedPreferences.defaultEnergyLevel === 'high' 
    ? 'High Energy' 
    : savedPreferences.defaultEnergyLevel === 'low' 
    ? 'Low Energy' 
    : 'Medium Energy';

  const shapeLabel = savedPreferences.defaultDayShape === 'front_load'
    ? 'Power Morning'
    : savedPreferences.defaultDayShape === 'back_load'
    ? 'Late Bloomer'
    : savedPreferences.defaultDayShape === 'spread'
    ? 'Steady Pace'
    : 'Smart Auto';

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-4"
      >
        <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Welcome Back!</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Used {savedPreferences.timesUsed} time{savedPreferences.timesUsed !== 1 ? 's' : ''}
        </p>
      </motion.div>

      {/* Contacts needing attention alert */}
      {contactsNeedingAttentionCount > 0 && savedPreferences.includeRelationshipTasks && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30"
        >
          <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Users className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              {contactsNeedingAttentionCount} contact{contactsNeedingAttentionCount !== 1 ? 's' : ''} need attention
            </p>
            <p className="text-xs text-muted-foreground">Follow-ups overdue or going cold</p>
          </div>
        </motion.div>
      )}

      {/* Saved preferences summary */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="p-4 rounded-xl bg-muted/50 border border-border/50"
      >
        <p className="text-xs font-medium text-muted-foreground mb-3">Your saved settings:</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center mx-auto mb-1">
              <Battery className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs font-medium text-foreground">{energyLabel}</span>
          </div>
          <div className="text-center">
            <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center mx-auto mb-1">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs font-medium text-foreground">{savedPreferences.defaultFlexHours}h flex</span>
          </div>
          <div className="text-center">
            <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center mx-auto mb-1">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs font-medium text-foreground">{shapeLabel}</span>
          </div>
        </div>
      </motion.div>

      {/* Action buttons */}
      <div className="space-y-2 pt-2">
        <Button
          onClick={onUseDefaults}
          className="w-full"
          size="lg"
        >
          <Zap className="h-4 w-4 mr-2" />
          Use My Defaults
        </Button>

        <Button
          onClick={onCustomize}
          variant="outline"
          className="w-full"
          size="lg"
        >
          <Settings className="h-4 w-4 mr-2" />
          Customize Today
        </Button>
      </div>

      {/* Reset link */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={onReset}
        className="flex items-center justify-center gap-1.5 w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        <RotateCcw className="h-3 w-3" />
        Reset Preferences
      </motion.button>
    </div>
  );
}
