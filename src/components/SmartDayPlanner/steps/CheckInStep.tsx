import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { PlanContext, EnergyLevel } from '@/hooks/useSmartDayPlanner';
import { Battery, BatteryLow, BatteryFull, Clock, Zap, Sun, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckInStepProps {
  context: PlanContext;
  updateContext: (updates: Partial<PlanContext>) => void;
  onNext: () => void;
}

const ENERGY_OPTIONS: { value: EnergyLevel; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'low', label: 'Low', icon: BatteryLow, description: 'Taking it easy today' },
  { value: 'medium', label: 'Medium', icon: Battery, description: 'Ready for a balanced day' },
  { value: 'high', label: 'High', icon: BatteryFull, description: 'Feeling energized!' },
];

const FLEX_TIME_LABELS = [
  { value: 2, label: '2h', description: 'Packed day' },
  { value: 4, label: '4h', description: 'Some flexibility' },
  { value: 6, label: '6h', description: 'Good flexibility' },
  { value: 8, label: '8h', description: 'Wide open' },
  { value: 10, label: '10h+', description: 'Maximum flex' },
];

export function CheckInStep({ context, updateContext, onNext }: CheckInStepProps) {
  const handleEnergySelect = (value: EnergyLevel) => {
    updateContext({ energyLevel: value });
  };

  const handleFlexTimeChange = (value: number[]) => {
    updateContext({ flexTimeHours: value[0] });
  };

  const getFlexLabel = () => {
    const match = FLEX_TIME_LABELS.find(l => context.flexTimeHours <= l.value);
    return match?.description || 'Maximum flex';
  };

  return (
    <div className="space-y-6">
      {/* Energy Level */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Energy Level
        </label>
        <div className="grid grid-cols-3 gap-2">
        {ENERGY_OPTIONS.map((option, index) => {
            const Icon = option.icon as React.ComponentType<{ className?: string }>;
            const isSelected = context.energyLevel === option.value;
            return (
              <motion.button
                key={option.value}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleEnergySelect(option.value)}
                className={cn(
                  "p-3 rounded-xl border-2 transition-all duration-200",
                  "flex flex-col items-center gap-1.5 text-center",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-6 w-6", isSelected ? "text-primary" : "text-muted-foreground")} />
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-[10px] opacity-70">{option.description}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Flex Time */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Available Flex Time
        </label>
        <div className="px-2">
          <Slider
            value={[context.flexTimeHours]}
            onValueChange={handleFlexTimeChange}
            min={2}
            max={10}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between mt-2">
            <span className="text-xs text-muted-foreground">2h</span>
            <span className="text-sm font-medium text-primary">
              {context.flexTimeHours}h - {getFlexLabel()}
            </span>
            <span className="text-xs text-muted-foreground">10h+</span>
          </div>
        </div>
      </div>

      {/* Quick context cards */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="p-3 rounded-lg bg-muted/50 border border-border/50"
        >
          <div className="flex items-center gap-2 mb-1">
            <Sun className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium text-foreground">Today</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            We'll optimize for your {context.energyLevel} energy
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="p-3 rounded-lg bg-muted/50 border border-border/50"
        >
          <div className="flex items-center gap-2 mb-1">
            <Coffee className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-medium text-foreground">Schedule</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {context.flexTimeHours}h of flexible time to plan
          </p>
        </motion.div>
      </div>

      {/* Continue button */}
      <Button
        onClick={onNext}
        className="w-full mt-4"
        size="lg"
      >
        Continue
      </Button>
    </div>
  );
}
