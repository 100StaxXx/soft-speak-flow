import React, { useState } from 'react';
import { Plus, Check, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useSubtasks } from '../hooks/useSubtasks';
import { ProgressRing } from './ProgressRing';
import { cn } from '@/lib/utils';

interface SubtaskListProps {
  parentTaskId: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const SubtaskList: React.FC<SubtaskListProps> = ({
  parentTaskId,
  isExpanded = false,
  onToggleExpand,
}) => {
  const [newSubtask, setNewSubtask] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const {
    subtasks,
    isLoading,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    progressPercent,
    completedCount,
    totalCount,
  } = useSubtasks(parentTaskId);

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    addSubtask(newSubtask.trim());
    setNewSubtask('');
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddSubtask();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewSubtask('');
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="mt-2">
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-1 text-muted-foreground hover:text-foreground">
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          {totalCount > 0 && (
            <div className="flex items-center gap-2">
              <ProgressRing percent={progressPercent} size={20} strokeWidth={2} />
              <span className="text-xs text-muted-foreground">
                {completedCount}/{totalCount} subtasks
              </span>
            </div>
          )}
          
          {!isAdding && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add subtask
            </Button>
          )}
        </div>

        <CollapsibleContent className="mt-2 space-y-1 pl-6">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className={cn(
                "group flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors",
                "hover:bg-muted/50",
                subtask.completed && "opacity-60"
              )}
            >
              <Checkbox
                checked={subtask.completed}
                onCheckedChange={(checked) => 
                  toggleSubtask({ subtaskId: subtask.id, completed: checked as boolean })
                }
                className="h-4 w-4"
              />
              <span className={cn(
                "flex-1 text-sm",
                subtask.completed && "line-through text-muted-foreground"
              )}>
                {subtask.title}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                onClick={() => deleteSubtask(subtask.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {isAdding && (
            <div className="flex items-center gap-2 py-1">
              <Input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter subtask..."
                className="h-7 text-sm"
                autoFocus
              />
              <Button
                size="sm"
                className="h-7 px-2"
                onClick={handleAddSubtask}
                disabled={!newSubtask.trim()}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
