import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Battery, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { EnergyLevel } from '../hooks/usePriorityTasks';

interface EnergyLevelPickerProps {
  value?: EnergyLevel | null;
  onChange: (level: EnergyLevel) => void;
  compact?: boolean;
}

const ENERGY_OPTIONS: {
  level: EnergyLevel;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}[] = [
  {
    level: 'high',
    label: 'High Energy',
    description: 'Complex, creative work',
    icon: <Zap className="w-4 h-4" />,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
  {
    level: 'medium',
    label: 'Medium Energy',
    description: 'Regular tasks',
    icon: <Battery className="w-4 h-4" />,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    level: 'low',
    label: 'Low Energy',
    description: 'Simple, routine tasks',
    icon: <Moon className="w-4 h-4" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
  },
];

export function EnergyLevelPicker({ value, onChange, compact = false }: EnergyLevelPickerProps) {
  const currentOption = ENERGY_OPTIONS.find(o => o.level === value) || ENERGY_OPTIONS[1];

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 px-2 gap-1", currentOption.color)}
          >
            {currentOption.icon}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="space-y-1">
            {ENERGY_OPTIONS.map((option) => (
              <button
                key={option.level}
                onClick={() => onChange(option.level)}
                className={cn(
                  "w-full flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors",
                  "hover:bg-muted",
                  value === option.level && option.bgColor
                )}
              >
                <span className={option.color}>{option.icon}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">
        Energy Required
      </label>
      <div className="flex gap-2">
        {ENERGY_OPTIONS.map((option) => (
          <motion.button
            key={option.level}
            onClick={() => onChange(option.level)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border transition-all",
              value === option.level
                ? `${option.bgColor} border-current ${option.color}`
                : "border-border hover:border-muted-foreground/50"
            )}
          >
            <span className={option.color}>{option.icon}</span>
            <span className="text-xs font-medium">{option.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// Badge version for display in task lists
export function EnergyBadge({ level }: { level?: EnergyLevel | null }) {
  if (!level) return null;
  
  const option = ENERGY_OPTIONS.find(o => o.level === level);
  if (!option) return null;

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs",
      option.bgColor,
      option.color
    )}>
      {option.icon}
    </span>
  );
}
