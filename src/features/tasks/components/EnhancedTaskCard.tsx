import { useState, useCallback } from 'react';
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
  Paperclip,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { QuestImageThumbnail } from '@/components/QuestImageThumbnail';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import type { TaskAttachment } from '@/types/questAttachments';

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
  contact_id?: string | null;
  contact?: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
  image_url?: string | null;
  attachments?: TaskAttachment[];
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
  onUpdateEnergy: _onUpdateEnergy,
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
  const { isBlocked, incompleteBlockers } = useTaskDependencies(task.id);
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
      layout={false}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "group relative rounded-xl border transition-all duration-300",
        task.completed 
          ? "bg-muted/30 border-border/50" 
          : "bg-card border-border hover:border-primary/30 hover:shadow-md",
        task.is_top_three && !task.completed && "border-primary/50 bg-primary/5 shadow-sm",
        isBlocked && "opacity-60",
        justCompleted && "ring-2 ring-green-500/50"
      )}
    >
      <div className={cn("p-3", compact && "p-2")}>
        {/* Main Row */}
        <div className="flex items-start gap-3">
          {/* Expand Button (if has subtasks) */}
          {hasSubtasks && showSubtasks && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-0.5 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Checkbox or Progress Ring */}
          {hasSubtasks ? (
            <div className="mt-0.5">
              <ProgressRing 
                percent={progressPercent} 
                size={20} 
                strokeWidth={2}
              />
            </div>
          ) : (
            <Checkbox
              checked={task.completed}
              onCheckedChange={(checked) => handleToggleComplete(checked as boolean)}
              disabled={isBlocked}
              className={cn(
                "mt-0.5 transition-transform hover:scale-110",
                task.completed && "data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
              )}
            />
          )}

          {/* Task Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Task Text */}
              <span className={cn(
                "text-sm font-medium",
                task.completed && "line-through text-muted-foreground"
              )}>
                {task.task_text}
              </span>

              {/* Badges */}
              {task.is_top_three && !task.completed && (
                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
              )}
              {isBlocked && (
                <BlockedBadge blockerCount={incompleteBlockers.length} blockerNames={blockerNames} />
              )}
            </div>

            {/* Meta Row */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {task.priority && (
                <PriorityBadge
                  priority={task.priority}
                  onChange={onUpdatePriority ? (p) => onUpdatePriority(task.id, p) : undefined}
                  readonly={!onUpdatePriority}
                />
              )}
              {task.energy_level && <EnergyBadge level={task.energy_level} />}
              {task.contact && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-full">
                  <Avatar className="h-3.5 w-3.5">
                    <AvatarImage src={task.contact.avatar_url || undefined} />
                    <AvatarFallback className="text-[8px] bg-emerald-100 dark:bg-emerald-900">
                      {task.contact.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate max-w-[80px]">{task.contact.name}</span>
                </span>
              )}
              {task.estimated_duration && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {task.estimated_duration}m
                </span>
              )}
              {task.scheduled_time && (
                <span className="text-xs text-muted-foreground">
                  @ {task.scheduled_time}
                </span>
              )}
              {hasSubtasks && (
                <span className="text-xs text-muted-foreground">
                  {subtasks.filter(s => s.completed).length}/{subtasks.length} subtasks
                </span>
              )}
              {task.attachments && task.attachments.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Paperclip className="w-3 h-3" />
                  {task.attachments.length}
                </span>
              )}
            </div>
            
            {/* Image Thumbnail */}
            {task.image_url && (
              <div className="mt-2">
                <QuestImageThumbnail 
                  imageUrl={task.image_url} 
                  size="md"
                  removable={false}
                />
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
                    Edit quest
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(task.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete quest
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
