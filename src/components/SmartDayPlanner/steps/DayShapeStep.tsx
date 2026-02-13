import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PlanContext, DayShape } from '@/hooks/useSmartDayPlanner';
import { Sunrise, Sun, Sunset, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DayShapeStepProps {
  context: PlanContext;
  updateContext: (updates: Partial<PlanContext>) => void;
  onNext: () => void;
  isGenerating?: boolean;
}

interface ShapeOption {
  value: DayShape;
  label: string;
  description: string;
  icon: React.ElementType;
  curve: number[]; // Heights for visual curve
}

const SHAPE_OPTIONS: ShapeOption[] = [
  {
    value: 'front_load',
    label: 'Power Morning',
    description: 'Heavy work early, coast later',
    icon: Sunrise,
    curve: [90, 80, 60, 40, 30, 20],
  },
  {
    value: 'spread',
    label: 'Steady Pace',
    description: 'Even distribution throughout',
    icon: Sun,
    curve: [50, 60, 55, 60, 50, 45],
  },
  {
    value: 'back_load',
    label: 'Late Bloomer',
    description: 'Light start, heavy afternoon',
    icon: Sunset,
    curve: [20, 30, 40, 60, 80, 90],
  },
  {
    value: 'auto',
    label: 'Smart Auto',
    description: 'Chooses based on your data',
    icon: Sparkles,
    curve: [40, 70, 50, 60, 75, 35],
  },
];

function DayCurve({ heights, isSelected }: { heights: number[]; isSelected: boolean }) {
  const width = 100;
  const height = 40;
  const points = heights.map((h, i) => ({
    x: (i / (heights.length - 1)) * width,
    y: height - (h / 100) * height,
  }));

  // Create smooth curve path
  const pathD = points.reduce((acc, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    
    const prev = points[i - 1];
    const cpX = (prev.x + point.x) / 2;
    return `${acc} Q ${cpX} ${prev.y} ${cpX} ${(prev.y + point.y) / 2} Q ${cpX} ${point.y} ${point.x} ${point.y}`;
  }, '');

  // Create fill path (close the path at the bottom)
  const fillD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10">
      {/* Fill */}
      <path
        d={fillD}
        className={cn(
          "transition-all duration-300",
          isSelected ? "fill-primary/20" : "fill-muted/30"
        )}
      />
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        className={cn(
          "transition-all duration-300",
          isSelected ? "stroke-primary" : "stroke-muted-foreground/50"
        )}
      />
      {/* Dots */}
      {points.map((point, i) => (
        <circle
          key={i}
          cx={point.x}
          cy={point.y}
          r={2}
          className={cn(
            "transition-all duration-300",
            isSelected ? "fill-primary" : "fill-muted-foreground/50"
          )}
        />
      ))}
    </svg>
  );
}

export function DayShapeStep({ context, updateContext, onNext, isGenerating }: DayShapeStepProps) {
  const handleShapeSelect = (value: DayShape) => {
    updateContext({ dayShape: value });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center mb-4">
        How should we distribute your tasks throughout the day?
      </p>

      <div className="grid grid-cols-2 gap-3">
        {SHAPE_OPTIONS.map((option, index) => {
          const Icon = option.icon as React.ComponentType<{ className?: string }>;
          const isSelected = context.dayShape === option.value;
          return (
            <motion.button
              key={option.value}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleShapeSelect(option.value)}
              className={cn(
                "p-3 rounded-xl border-2 transition-all duration-200 text-left",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center",
                  isSelected ? "bg-primary/20" : "bg-muted"
                )}>
                  <Icon className={cn(
                    "h-4 w-4",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <span className={cn(
                  "text-sm font-medium",
                  isSelected ? "text-foreground" : "text-muted-foreground"
                )}>
                  {option.label}
                </span>
              </div>
              
              <DayCurve heights={option.curve} isSelected={isSelected} />
              
              <p className="text-[10px] text-muted-foreground mt-2">
                {option.description}
              </p>
            </motion.button>
          );
        })}
      </div>

      {/* Time labels */}
      <div className="flex justify-between px-2 mt-1">
        <span className="text-[10px] text-muted-foreground">Morning</span>
        <span className="text-[10px] text-muted-foreground">Midday</span>
        <span className="text-[10px] text-muted-foreground">Evening</span>
      </div>

      {/* Summary card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="p-3 rounded-lg bg-muted/50 border border-border/50 mt-4"
      >
        <div className="flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-primary mt-0.5" />
          <div>
            <p className="text-xs font-medium text-foreground">What happens next</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Next, you can add blocked time slots and special requests before we build your plan.
            </p>
          </div>
        </div>
      </motion.div>

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
