import React, { useState } from 'react';
import { Link2, X, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useTaskDependencies } from '../hooks/useTaskDependencies';
import { useTasksQuery } from '@/hooks/useTasksQuery';
import { cn } from '@/lib/utils';

interface DependencyPickerProps {
  taskId: string;
  compact?: boolean;
}

export const DependencyPicker: React.FC<DependencyPickerProps> = ({
  taskId,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const { tasks } = useTasksQuery();
  const {
    blockers,
    isBlocked,
    incompleteBlockers,
    addDependency,
    removeDependency,
  } = useTaskDependencies(taskId);

  // Filter out current task and already-added dependencies
  const blockerIds = blockers.map((b: any) => b.depends_on_task_id);
  const availableTasks = tasks.filter(
    (t) => t.id !== taskId && !blockerIds.includes(t.id)
  );

  const handleSelect = (selectedTaskId: string) => {
    addDependency(selectedTaskId);
    setOpen(false);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {isBlocked && (
          <Badge variant="outline" className="text-amber-500 border-amber-500/50 gap-1 text-xs">
            <AlertTriangle className="h-3 w-3" />
            Blocked
          </Badge>
        )}
        {blockers.length > 0 && !isBlocked && (
          <Badge variant="outline" className="text-green-500 border-green-500/50 gap-1 text-xs">
            <Check className="h-3 w-3" />
            Ready
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Dependencies</span>
        
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              Add blocker
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search quests..." />
              <CommandList>
                <CommandEmpty>No quests found.</CommandEmpty>
                <CommandGroup>
                  {availableTasks.map((task) => (
                    <CommandItem
                      key={task.id}
                      value={task.task_text}
                      onSelect={() => handleSelect(task.id)}
                      className="cursor-pointer"
                    >
                      <span className={cn(
                        "truncate",
                        task.completed && "line-through text-muted-foreground"
                      )}>
                        {task.task_text}
                      </span>
                      {task.completed && (
                        <Check className="h-3 w-3 ml-auto text-green-500" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {isBlocked && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-xs text-amber-500">
            Blocked by {incompleteBlockers.length} incomplete {incompleteBlockers.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>
      )}

      {blockers.length > 0 && (
        <div className="space-y-1">
          {blockers.map((blocker: any) => (
            <div
              key={blocker.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md text-sm",
                blocker.daily_tasks?.completed 
                  ? "bg-green-500/10 border border-green-500/20"
                  : "bg-amber-500/10 border border-amber-500/20"
              )}
            >
              {blocker.daily_tasks?.completed ? (
                <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              )}
              <span className={cn(
                "flex-1 truncate text-xs",
                blocker.daily_tasks?.completed && "line-through text-muted-foreground"
              )}>
                {blocker.daily_tasks?.task_text}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => removeDependency(blocker.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
