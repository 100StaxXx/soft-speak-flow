import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GeneratedTask } from '@/hooks/useSmartDayPlanner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  Flame, 
  GripVertical, 
  Trash2, 
  Check, 
  X,
  Pencil,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DragHandleProps } from '@/components/DraggableTaskList';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EditableTaskCardProps {
  task: GeneratedTask;
  index: number;
  isEditMode: boolean;
  onUpdate: (index: number, updates: Partial<GeneratedTask>) => void;
  onRemove: (index: number) => void;
  dragHandleProps?: DragHandleProps;
  hasConflict?: boolean;
  conflictDetails?: string;
}

export function EditableTaskCard({ 
  task, 
  index, 
  isEditMode,
  onUpdate, 
  onRemove,
  dragHandleProps,
  hasConflict,
  conflictDetails,
}: EditableTaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedTime, setEditedTime] = useState(task.scheduledTime);
  const [editedDuration, setEditedDuration] = useState(task.estimatedDuration.toString());

  const priorityColors = {
    high: 'border-l-red-500',
    medium: 'border-l-amber-500',
    low: 'border-l-green-500',
  };

  const handleSaveEdit = () => {
    onUpdate(index, {
      title: editedTitle,
      scheduledTime: editedTime,
      estimatedDuration: parseInt(editedDuration) || task.estimatedDuration,
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedTitle(task.title);
    setEditedTime(task.scheduledTime);
    setEditedDuration(task.estimatedDuration.toString());
    setIsEditing(false);
  };

  const isDragging = dragHandleProps?.isDragging ?? false;

  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-3 rounded-lg bg-card border border-primary/50 space-y-2"
      >
        <Input
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          className="text-sm font-medium"
          autoFocus
        />
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground mb-1 block">Time</label>
            <Input
              type="time"
              value={editedTime}
              onChange={(e) => setEditedTime(e.target.value)}
              className="text-xs h-8"
            />
          </div>
          <div className="w-20">
            <label className="text-[10px] text-muted-foreground mb-1 block">Mins</label>
            <Input
              type="number"
              value={editedDuration}
              onChange={(e) => setEditedDuration(e.target.value)}
              className="text-xs h-8"
              min="5"
              max="240"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSaveEdit}>
            <Check className="h-3.5 w-3.5 mr-1" />
            Save
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "p-3 rounded-lg bg-card border border-border/50 border-l-4",
        hasConflict 
          ? "border-l-amber-500 bg-amber-500/5 ring-1 ring-amber-500/30" 
          : priorityColors[task.priority],
        isDragging && "shadow-lg scale-[1.02]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {isEditMode && (
          <div 
            ref={dragHandleProps?.dragHandleRef}
            className={cn(
              "flex items-center gap-1 mr-1 touch-none cursor-grab active:cursor-grabbing",
              dragHandleProps?.isActivated && "scale-110"
            )}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {task.scheduledTime}
            </span>
            {hasConflict && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      Overlap
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px] text-xs">
                    {conflictDetails || 'This task overlaps with another'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
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
        
        <div className="flex items-center gap-1">
          {task.isAnchor && (
            <Flame className="h-4 w-4 text-orange-500 flex-shrink-0" />
          )}
          {isEditMode && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={() => onRemove(index)}
                className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
