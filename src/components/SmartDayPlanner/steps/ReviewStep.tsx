import React, { useState, useMemo } from 'react';
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
  Pencil,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditableTaskCard } from '../components/EditableTaskCard';
import { analyzePlan, getSmartAdjustments } from '../utils/planAnalyzer';

interface ReviewStepProps {
  generatedPlan: GeneratedPlan | null;
  onAdjust: (request: string) => Promise<GeneratedPlan | null>;
  onSave: () => void;
  isAdjusting: boolean;
  error: string | null;
  hasContacts?: boolean;
  onUpdateTask?: (index: number, updates: Partial<GeneratedTask>) => void;
  onRemoveTask?: (index: number) => void;
}

export function ReviewStep({ 
  generatedPlan, 
  onAdjust, 
  onSave, 
  isAdjusting, 
  error,
  hasContacts = false,
  onUpdateTask,
  onRemoveTask,
}: ReviewStepProps) {
  const [adjustmentInput, setAdjustmentInput] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  // Analyze plan and get context-aware suggestions
  const planAnalysis = useMemo(() => 
    generatedPlan ? analyzePlan(generatedPlan.tasks) : null,
    [generatedPlan]
  );

  const smartAdjustments = useMemo(() => 
    planAnalysis ? getSmartAdjustments(planAnalysis, hasContacts) : [],
    [planAnalysis, hasContacts]
  );

  const handleQuickAdjust = (prompt: string) => {
    onAdjust(prompt);
  };

  const handleCustomAdjust = () => {
    if (adjustmentInput.trim()) {
      onAdjust(adjustmentInput.trim());
      setAdjustmentInput('');
    }
  };

  const handleUpdateTask = (index: number, updates: Partial<GeneratedTask>) => {
    onUpdateTask?.(index, updates);
  };

  const handleRemoveTask = (index: number) => {
    onRemoveTask?.(index);
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
      {/* Stats bar with edit toggle */}
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
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">{generatedPlan.balanceScore}%</span>
          </div>
          {onUpdateTask && onRemoveTask && (
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                isEditMode 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted"
              )}
            >
              {isEditMode ? (
                <Check className="h-4 w-4" />
              ) : (
                <Pencil className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Insights */}
      {generatedPlan.insights.length > 0 && !isEditMode && (
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

      {/* Task list - editable or static */}
      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
        {generatedPlan.tasks.map((task, index) => (
          <EditableTaskCard
            key={index}
            task={task}
            index={index}
            isEditMode={isEditMode}
            onUpdate={handleUpdateTask}
            onRemove={handleRemoveTask}
          />
        ))}
      </div>

      {/* Context-aware quick adjustments */}
      {!isEditMode && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Suggested adjustments:</p>
          <div className="flex flex-wrap gap-1.5">
            {smartAdjustments.map((adj) => (
              <button
                key={adj.label}
                onClick={() => handleQuickAdjust(adj.prompt)}
                disabled={isAdjusting}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-full border transition-colors flex items-center gap-1",
                  adj.priority === 'high' 
                    ? "border-primary/50 text-primary hover:bg-primary/10" 
                    : "border-border hover:border-primary hover:text-primary",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {adj.icon && <span>{adj.icon}</span>}
                {adj.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom adjustment input */}
      {!isEditMode && (
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
      )}

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
