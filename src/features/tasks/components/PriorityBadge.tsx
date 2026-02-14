import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Priority } from '../hooks/usePriorityTasks';

interface PriorityBadgeProps {
  priority?: Priority | null;
  onChange?: (priority: Priority) => void;
  readonly?: boolean;
  showLabel?: boolean;
}

const PRIORITY_OPTIONS: {
  priority: Priority;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}[] = [
  {
    priority: 'urgent',
    label: 'Urgent',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  {
    priority: 'high',
    label: 'High',
    icon: <ArrowUp className="w-3.5 h-3.5" />,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  {
    priority: 'medium',
    label: 'Medium',
    icon: <Minus className="w-3.5 h-3.5" />,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
  {
    priority: 'low',
    label: 'Low',
    icon: <ArrowDown className="w-3.5 h-3.5" />,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
];

export function PriorityBadge({ 
  priority, 
  onChange, 
  readonly = false,
  showLabel = false 
}: PriorityBadgeProps) {
  const currentOption = PRIORITY_OPTIONS.find(o => o.priority === priority) || PRIORITY_OPTIONS[2];

  const badge = (
    <span className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium",
      currentOption.bgColor,
      currentOption.color
    )}>
      {currentOption.icon}
      {showLabel && <span>{currentOption.label}</span>}
    </span>
  );

  if (readonly || !onChange) {
    return badge;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-auto p-0 hover:bg-transparent",
            currentOption.color
          )}
        >
          {badge}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-2" align="start">
        <div className="space-y-1">
          {PRIORITY_OPTIONS.map((option) => (
            <motion.button
              key={option.priority}
              onClick={() => onChange(option.priority)}
              whileHover={{ x: 2 }}
              className={cn(
                "w-full flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors",
                "hover:bg-muted",
                priority === option.priority && option.bgColor
              )}
            >
              <span className={option.color}>{option.icon}</span>
              <span>{option.label}</span>
            </motion.button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Larger picker for forms/modals
export function PriorityPicker({ 
  value, 
  onChange 
}: { 
  value?: Priority | null; 
  onChange: (priority: Priority) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">
        Priority
      </label>
      <div className="flex gap-2">
        {PRIORITY_OPTIONS.map((option) => (
          <motion.button
            key={option.priority}
            onClick={() => onChange(option.priority)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 p-2 rounded-lg border transition-all",
              value === option.priority
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
