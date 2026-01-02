import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  Play,
  Star,
  MoreHorizontal,
  Sparkles,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { SubtaskList } from './SubtaskList';
import { PriorityBadge } from './PriorityBadge';
import { EnergyBadge } from './EnergyLevelPicker';
import { BlockedBadge } from './BlockedBadge';
import { ProgressRing } from './ProgressRing';
import { DecomposeTaskDialog } from './DecomposeTaskDialog';
import { useSubtasks } from '../hooks/useSubtasks';
import { useTaskDependencies } from '../hooks/useTaskDependencies';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Priority, EnergyLevel } from '../hooks/usePriorityTasks';

export interface TaskCardTask {
  id: string;
  task_text: string;
  completed: boolean;
  priority?: Priority | null;
  energy_level?: EnergyLevel | null;
  is_top_three?: boolean | null;
  estimated_duration?: number | null;
  scheduled_time?: string | null;
  category?: string | null;
}

interface EnhancedTaskCardProps {
  task: TaskCardTask;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onUpdatePriority?: (taskId: string, priority: Priority) => void;
  onUpdateEnergy?: (taskId: string, energy: EnergyLevel) => void;
  onToggleTopThree?: (taskId: string, isTopThree: boolean) => void;
  onStartFocus?: (taskId: string, taskName: string) => void;
  onDelete?: (taskId: string) => void;
  onEdit?: (taskId: string) => void;
  showSubtasks?: boolean;
  compact?: boolean;
}

export function EnhancedTaskCard({
  task,
  onToggleComplete,
  onUpdatePriority,
  onUpdateEnergy,
  onToggleTopThree,
  onStartFocus,
  onDelete,
  onEdit,
  showSubtasks = true,
  compact = false,
}: EnhancedTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDecomposeDialog, setShowDecomposeDialog] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const { subtasks, progressPercent } = useSubtasks(task.id);
  const { blockers, isBlocked, incompleteBlockers } = useTaskDependencies(task.id);
  const { success, light } = useHapticFeedback();

  const hasSubtasks = subtasks.length > 0;
  const blockerNames = incompleteBlockers.map(b => b.daily_tasks?.task_text || 'Unknown task');

  const handleToggleComplete = useCallback((checked: boolean) => {
    if (checked) {
      success(); // Satisfying completion haptic
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 600);
    } else {
      light();
    }
    onToggleComplete(task.id, checked);
  }, [task.id, onToggleComplete, success, light]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "group relative border-b border-border/20 last:border-b-0 transition-all duration-200",
        task.completed && "opacity-60",
        isBlocked && "opacity-40",
        justCompleted && "bg-green-500/5"
      )}
    >
      <div className={cn("py-4", compact && "py-3")}>
        {/* Main Row */}
        <div className="flex items-center gap-4">
          {/* Expand Button (if has subtasks) */}
          {hasSubtasks && showSubtasks && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Checkbox or Progress Ring */}
          {hasSubtasks ? (
            <ProgressRing 
              percent={progressPercent} 
              size={24} 
              strokeWidth={2.5}
            />
          ) : (
            <Checkbox
              checked={task.completed}
              onCheckedChange={(checked) => handleToggleComplete(checked as boolean)}
              disabled={isBlocked}
            />
          )}

          {/* Task Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* Task Text */}
              <span className={cn(
                "text-lg font-medium leading-tight",
                task.completed && "line-through text-muted-foreground"
              )}>
                {task.task_text}
              </span>

              {/* Top 3 Star */}
              {task.is_top_three && !task.completed && (
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
              )}
            </div>

            {/* Meta Row - simplified */}
            {(task.estimated_duration || task.scheduled_time || hasSubtasks || isBlocked) && (
              <div className="flex items-center gap-3 mt-1">
                {task.scheduled_time && (
                  <span className="text-sm text-muted-foreground">
                    {task.scheduled_time}
                  </span>
                )}
                {task.estimated_duration && (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    {task.estimated_duration}m
                  </span>
                )}
                {hasSubtasks && (
                  <span className="text-sm text-muted-foreground">
                    {subtasks.filter(s => s.completed).length}/{subtasks.length}
                  </span>
                )}
                {isBlocked && (
                  <BlockedBadge blockerCount={incompleteBlockers.length} blockerNames={blockerNames} />
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onStartFocus && !task.completed && !isBlocked && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onStartFocus(task.id, task.task_text)}
                title="Start focus session"
              >
                <Play className="w-3.5 h-3.5" />
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {onToggleTopThree && (
                  <DropdownMenuItem onClick={() => onToggleTopThree(task.id, !task.is_top_three)}>
                    <Star className={cn("w-4 h-4 mr-2", task.is_top_three && "fill-yellow-500 text-yellow-500")} />
                    {task.is_top_three ? 'Remove from Top 3' : 'Add to Top 3'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setShowDecomposeDialog(true)}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Break down with AI
                </DropdownMenuItem>
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(task.id)}>
                    Edit task
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(task.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete task
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && hasSubtasks && showSubtasks && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 pl-8">
                <SubtaskList parentTaskId={task.id} isExpanded />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Completion Animation Overlay */}
      <AnimatePresence>
        {task.completed && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-4 h-4 text-green-500" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decompose Task Dialog */}
      <DecomposeTaskDialog
        open={showDecomposeDialog}
        onOpenChange={setShowDecomposeDialog}
        taskId={task.id}
        taskTitle={task.task_text}
      />
    </motion.div>
  );
}
