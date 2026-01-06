import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Zap, Settings, RotateCcw, Clock, Battery, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SavedPreferences {
  defaultEnergyLevel: string;
  defaultFlexHours: number;
  defaultDayShape: string;
  timesUsed: number;
}

interface QuickStartStepProps {
  savedPreferences: SavedPreferences | null;
  onUseDefaults: () => void;
  onCustomize: () => void;
  onReset: () => void;
}

export function QuickStartStep({
  savedPreferences,
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
