import { useState, useMemo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { 
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Send, 
  Loader2, 
  Wand2,
  Clock,
  Calendar,
  Target,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  normalizeTaskSchedulingState,
  normalizeTaskSchedulingUpdate,
} from '@/utils/taskSchedulingRules';

interface Task {
  id: string;
  task_text: string;
  scheduled_time?: string | null;
  completed?: boolean | null;
  ai_generated?: boolean | null;
}

interface QuickAdjustDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  selectedDate: Date;
  onComplete: () => void;
}

interface QuickAction {
  icon: ReactNode;
  label: string;
  prompt: string;
}

export function QuickAdjustDrawer({ 
  open, 
  onOpenChange, 
  tasks, 
  selectedDate,
  onComplete 
}: QuickAdjustDrawerProps) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const incompleteTasks = useMemo(() => 
    tasks.filter(t => !t.completed),
    [tasks]
  );

  const quickActions = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const actions: QuickAction[] = [];
    
    // Context-aware suggestions
    if (incompleteTasks.length > 3 && currentHour > 14) {
      actions.push({
        icon: <Target className="h-4 w-4" />,
        label: 'Focus on top 3',
        prompt: 'Keep only the 3 most important remaining tasks for today and move the rest to tomorrow'
      });
    }
    
    if (incompleteTasks.length > 0) {
      actions.push({
        icon: <Clock className="h-4 w-4" />,
        label: 'Push all by 1 hour',
        prompt: 'Push all remaining tasks back by 1 hour'
      });
    }
    
    if (incompleteTasks.length > 2) {
      actions.push({
        icon: <Calendar className="h-4 w-4" />,
        label: 'Move rest to tomorrow',
        prompt: 'Move all remaining incomplete tasks to tomorrow'
      });
    }

    // Always available
    actions.push({
      icon: <Sparkles className="h-4 w-4" />,
      label: 'Reschedule smarter',
      prompt: 'Reorganize the remaining tasks based on current time and energy optimization'
    });
    
    return actions.slice(0, 4);
  }, [incompleteTasks]);

  const handleAdjust = async (prompt: string) => {
    if (!prompt.trim()) return;
    
    setIsProcessing(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const { data, error } = await supabase.functions.invoke('adjust-saved-daily-plan', {
        body: {
          planDate: dateStr,
          adjustmentRequest: prompt,
          currentTasks: incompleteTasks.map(t => ({
            id: t.id,
            title: t.task_text,
            scheduledTime: t.scheduled_time,
          })),
        },
      });

      if (error) throw error;

      // Apply the adjustments returned by the edge function
      if (data?.adjustments && Array.isArray(data.adjustments)) {
        let normalizedToInboxCount = 0;
        for (const adj of data.adjustments) {
          if (adj.action === 'update' && adj.taskId && adj.updates) {
            const updatePayload = { ...adj.updates } as Record<string, unknown>;

            if (Object.prototype.hasOwnProperty.call(updatePayload, 'task_date')
              || Object.prototype.hasOwnProperty.call(updatePayload, 'scheduled_time')) {
              const { data: existing, error: existingError } = await supabase
                .from('daily_tasks')
                .select('task_date, scheduled_time, habit_source_id, source')
                .eq('id', adj.taskId)
                .maybeSingle();

              if (existingError) throw existingError;
              if (existing) {
                const normalized = normalizeTaskSchedulingUpdate(existing, {
                  task_date: (updatePayload.task_date as string | null | undefined),
                  scheduled_time: (updatePayload.scheduled_time as string | null | undefined),
                });
                updatePayload.task_date = normalized.task_date;
                updatePayload.scheduled_time = normalized.scheduled_time;
                if (normalized.source !== existing.source) {
                  updatePayload.source = normalized.source;
                }
                if (normalized.normalizedToInbox) normalizedToInboxCount += 1;
              }
            }

            await supabase
              .from('daily_tasks')
              .update(updatePayload)
              .eq('id', adj.taskId);
          } else if (adj.action === 'delete' && adj.taskId) {
            await supabase
              .from('daily_tasks')
              .delete()
              .eq('id', adj.taskId);
          } else if (adj.action === 'move_to_tomorrow' && adj.taskId) {
            const tomorrow = new Date(selectedDate);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const { data: existing, error: existingError } = await supabase
              .from('daily_tasks')
              .select('task_date, scheduled_time, habit_source_id, source')
              .eq('id', adj.taskId)
              .maybeSingle();
            if (existingError) throw existingError;
            if (!existing) continue;

            const normalized = normalizeTaskSchedulingState({
              task_date: format(tomorrow, 'yyyy-MM-dd'),
              scheduled_time: existing.scheduled_time,
              habit_source_id: existing.habit_source_id,
              source: existing.source,
            });
            if (normalized.normalizedToInbox) normalizedToInboxCount += 1;

            const updatePayload: Record<string, unknown> = {
              task_date: normalized.task_date,
              scheduled_time: normalized.scheduled_time,
            };
            if (normalized.source !== existing.source) {
              updatePayload.source = normalized.source;
            }

            await supabase
              .from('daily_tasks')
              .update(updatePayload)
              .eq('id', adj.taskId);
          }
        }

        if (normalizedToInboxCount > 0) {
          toast(`${normalizedToInboxCount} quest${normalizedToInboxCount === 1 ? '' : 's'} stayed in Inbox (time required).`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast.success(data?.message || 'Plan adjusted!');
      setInput('');
      onComplete();
    } catch (err) {
      console.error('Adjust error:', err);
      toast.error('Failed to adjust plan');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[70vh]">
        <DrawerHeader className="text-center pb-2">
          <div className="flex justify-center mb-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Wand2 className="h-5 w-5 text-primary" />
            </div>
          </div>
          <DrawerTitle>Quick Adjust</DrawerTitle>
          <DrawerDescription>
            {incompleteTasks.length} task{incompleteTasks.length !== 1 ? 's' : ''} remaining
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handleAdjust(action.prompt)}
                disabled={isProcessing}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg",
                  "bg-muted/50 border border-border/50",
                  "hover:bg-muted hover:border-primary/30 transition-all",
                  "text-left text-sm",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <div className="text-primary">{action.icon}</div>
                <span className="font-medium">{action.label}</span>
              </motion.button>
            ))}
          </div>

          {/* Natural Language Input */}
          <div className="relative">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Or describe what to change..."
              className="pr-12"
              onKeyDown={(e) => e.key === 'Enter' && handleAdjust(input)}
              disabled={isProcessing}
            />
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => handleAdjust(input)}
              disabled={!input.trim() || isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Example prompts */}
          <div className="flex flex-wrap gap-1.5">
            {[
              'Move workout to 6pm',
              'Cancel meeting prep',
              'Add 30min break',
            ].map((example) => (
              <button
                key={example}
                onClick={() => setInput(example)}
                disabled={isProcessing}
                className="text-xs px-2 py-1 rounded-full bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
