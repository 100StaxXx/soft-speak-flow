import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GeneratedPlan, GeneratedTask } from '@/hooks/useSmartDayPlanner';
import { 
  Clock, 
  Zap, 
  Target, 
  Loader2, 
  Send, 
  Sparkles, 
  AlertCircle,
  ChevronRight,
  Flame
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReviewStepProps {
  generatedPlan: GeneratedPlan | null;
  onAdjust: (request: string) => Promise<GeneratedPlan | null>;
  onSave: () => void;
  isAdjusting: boolean;
  error: string | null;
}

const QUICK_ADJUSTMENTS = [
  { label: 'Make lighter', prompt: 'Make the plan lighter with fewer tasks' },
  { label: 'Add workout', prompt: 'Add a 30-minute workout or exercise block' },
  { label: 'More breaks', prompt: 'Add more break time between tasks' },
  { label: 'Focus time', prompt: 'Add a 2-hour deep focus block' },
];

function TaskCard({ task, index }: { task: GeneratedTask; index: number }) {
  const priorityColors = {
    high: 'border-l-red-500',
    medium: 'border-l-amber-500',
    low: 'border-l-green-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "p-3 rounded-lg bg-card border border-border/50 border-l-4",
        priorityColors[task.priority]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {task.scheduledTime}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {task.estimatedDuration}m
            </span>
            {task.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {task.category}
              </span>
            )}
          </div>
        </div>
        {task.isAnchor && (
          <Flame className="h-4 w-4 text-orange-500 flex-shrink-0" />
        )}
      </div>
    </motion.div>
  );
}

export function ReviewStep({ generatedPlan, onAdjust, onSave, isAdjusting, error }: ReviewStepProps) {
  const [adjustmentInput, setAdjustmentInput] = useState('');

  const handleQuickAdjust = (prompt: string) => {
    onAdjust(prompt);
  };

  const handleCustomAdjust = () => {
    if (adjustmentInput.trim()) {
      onAdjust(adjustmentInput.trim());
      setAdjustmentInput('');
    }
  };

  if (error && !generatedPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-10 w-10 text-destructive mb-3" />
        <h3 className="font-medium text-foreground mb-1">Couldn't generate plan</h3>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={onSave}>
          Try Again
        </Button>
      </div>
    );
  }

  if (!generatedPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Generating your plan...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{generatedPlan.tasks.length}</span>
            <span className="text-xs text-muted-foreground">tasks</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{generatedPlan.totalHours.toFixed(1)}h</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">{generatedPlan.balanceScore}%</span>
          <span className="text-xs text-muted-foreground">balanced</span>
        </div>
      </div>

      {/* Insights */}
      {generatedPlan.insights.length > 0 && (
        <div className="space-y-1">
          {generatedPlan.insights.slice(0, 2).map((insight, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-2 text-xs text-muted-foreground"
            >
              <Sparkles className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
              <span>{insight}</span>
            </motion.div>
          ))}
        </div>
      )}

      {/* Task list */}
      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
        {generatedPlan.tasks.map((task, index) => (
          <TaskCard key={index} task={task} index={index} />
        ))}
      </div>

      {/* Quick adjustments */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Quick adjustments:</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ADJUSTMENTS.map((adj) => (
            <button
              key={adj.label}
              onClick={() => handleQuickAdjust(adj.prompt)}
              disabled={isAdjusting}
              className={cn(
                "px-2.5 py-1 text-xs rounded-full border transition-colors",
                "border-border hover:border-primary hover:text-primary",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {adj.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom adjustment input */}
      <div className="flex gap-2">
        <Input
          value={adjustmentInput}
          onChange={(e) => setAdjustmentInput(e.target.value)}
          placeholder="Tell the Guide what to change..."
          className="flex-1 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleCustomAdjust()}
          disabled={isAdjusting}
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCustomAdjust}
          disabled={!adjustmentInput.trim() || isAdjusting}
        >
          {isAdjusting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Save button */}
      <Button
        onClick={onSave}
        disabled={isAdjusting}
        className="w-full"
        size="lg"
      >
        Begin Adventure
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
