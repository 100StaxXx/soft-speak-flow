import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Check, 
  Clock, 
  Sparkles, 
  Lightbulb, 
  Battery, 
  BatteryLow, 
  BatteryFull,
  Sun,
  Sunset,
  Moon,
  Plus,
  X,
  Loader2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ExtractedTask, SuggestedTask, DetectedContext } from '@/hooks/useIntentClassifier';

interface TaskBatchPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extractedTasks: ExtractedTask[];
  suggestedTasks: SuggestedTask[];
  detectedContext?: DetectedContext;
  onConfirm: (tasks: ExtractedTask[]) => void;
  isCreating?: boolean;
}

interface SelectableTask extends ExtractedTask {
  id: string;
  selected: boolean;
  isSuggestion: boolean;
  reason?: string;
}

const energyIcons = {
  low: BatteryLow,
  medium: Battery,
  high: BatteryFull,
};

const timeIcons = {
  morning: Sun,
  afternoon: Sunset,
  evening: Moon,
};

export function TaskBatchPreview({
  open,
  onOpenChange,
  extractedTasks,
  suggestedTasks,
  detectedContext,
  onConfirm,
  isCreating = false,
}: TaskBatchPreviewProps) {
  // Combine and track selections
  const [tasks, setTasks] = useState<SelectableTask[]>(() => {
    const extracted = extractedTasks.map((t, i) => ({
      ...t,
      id: `extracted-${i}`,
      selected: true, // Pre-selected
      isSuggestion: false,
    }));
    const suggested = suggestedTasks.map((t, i) => ({
      ...t,
      id: `suggested-${i}`,
      selected: false, // Not pre-selected
      isSuggestion: true,
      reason: t.reason,
    }));
    return [...extracted, ...suggested];
  });

  const [newTaskInput, setNewTaskInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Reset tasks when props change
  useMemo(() => {
    const extracted = extractedTasks.map((t, i) => ({
      ...t,
      id: `extracted-${i}`,
      selected: true,
      isSuggestion: false,
    }));
    const suggested = suggestedTasks.map((t, i) => ({
      ...t,
      id: `suggested-${i}`,
      selected: false,
      isSuggestion: true,
      reason: (t as SuggestedTask).reason,
    }));
    setTasks([...extracted, ...suggested]);
  }, [extractedTasks, suggestedTasks]);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, selected: !t.selected } : t
    ));
  };

  const updateTaskTitle = (id: string, title: string) => {
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, title } : t
    ));
    setEditingId(null);
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const addTask = () => {
    if (!newTaskInput.trim()) return;
    setTasks(prev => [...prev, {
      id: `manual-${Date.now()}`,
      title: newTaskInput.trim(),
      selected: true,
      isSuggestion: false,
    }]);
    setNewTaskInput('');
  };

  const selectedTasks = tasks.filter(t => t.selected);
  const suggestedCount = tasks.filter(t => t.isSuggestion && t.selected).length;

  const handleConfirm = () => {
    const tasksToCreate = selectedTasks.map(({ id, selected, isSuggestion, reason, ...task }) => task);
    onConfirm(tasksToCreate);
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return null;
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m ? `${h}h ${m}m` : `${h}h`;
    }
    return `${minutes}m`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Review Quests
          </DialogTitle>
          {detectedContext?.dayOfWeek && (
            <p className="text-sm text-muted-foreground">
              For {detectedContext.dayOfWeek}
              {detectedContext.userSituation && ` • ${detectedContext.userSituation}`}
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-2">
            {/* Extracted Tasks Section */}
            {tasks.filter(t => !t.isSuggestion).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  Detected Quests ({tasks.filter(t => !t.isSuggestion).length})
                </h3>
                <div className="space-y-1.5">
                  {tasks.filter(t => !t.isSuggestion).map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isEditing={editingId === task.id}
                      onToggle={() => toggleTask(task.id)}
                      onEdit={() => setEditingId(task.id)}
                      onSaveEdit={(title) => updateTaskTitle(task.id, title)}
                      onCancelEdit={() => setEditingId(null)}
                      onRemove={() => removeTask(task.id)}
                      formatDuration={formatDuration}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Tasks Section */}
            {tasks.filter(t => t.isSuggestion).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-500" />
                  Suggestions ({tasks.filter(t => t.isSuggestion).length})
                </h3>
                <div className="space-y-1.5">
                  {tasks.filter(t => t.isSuggestion).map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isEditing={editingId === task.id}
                      onToggle={() => toggleTask(task.id)}
                      onEdit={() => setEditingId(task.id)}
                      onSaveEdit={(title) => updateTaskTitle(task.id, title)}
                      onCancelEdit={() => setEditingId(null)}
                      onRemove={() => removeTask(task.id)}
                      formatDuration={formatDuration}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Add Task */}
            <div className="flex gap-2 pt-2">
              <Input
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                placeholder="Add another quest..."
                className="h-9 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={addTask}
                disabled={!newTaskInput.trim()}
                className="h-9 px-3"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected
            {suggestedCount > 0 && (
              <span className="text-yellow-500"> (+{suggestedCount} suggested)</span>
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={selectedTasks.length === 0 || isCreating}
              className="min-w-[120px]"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                `Create ${selectedTasks.length} Quest${selectedTasks.length !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface TaskRowProps {
  task: SelectableTask;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onSaveEdit: (title: string) => void;
  onCancelEdit: () => void;
  onRemove: () => void;
  formatDuration: (minutes?: number) => string | null;
}

function TaskRow({ 
  task, 
  isEditing, 
  onToggle, 
  onEdit, 
  onSaveEdit, 
  onCancelEdit,
  onRemove,
  formatDuration 
}: TaskRowProps) {
  const [editValue, setEditValue] = useState(task.title);
  const EnergyIcon = task.energyLevel ? energyIcons[task.energyLevel] : null;
  const TimeIcon = task.suggestedTimeOfDay ? timeIcons[task.suggestedTimeOfDay] : null;
  const duration = formatDuration(task.estimatedDuration);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className={cn(
        "flex items-start gap-3 p-2.5 rounded-lg border transition-colors",
        task.selected 
          ? "bg-primary/5 border-primary/20" 
          : "bg-muted/30 border-transparent opacity-60"
      )}
    >
      <Checkbox
        checked={task.selected}
        onCheckedChange={onToggle}
        className="mt-0.5"
      />
      
      <div className="flex-1 min-w-0 space-y-1">
        {isEditing ? (
          <div className="flex gap-2">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit(editValue);
                if (e.key === 'Escape') onCancelEdit();
              }}
            />
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onSaveEdit(editValue)}>
              <Check className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <p 
            className={cn(
              "text-sm font-medium cursor-pointer hover:text-primary transition-colors",
              !task.selected && "line-through"
            )}
            onClick={onEdit}
          >
            {task.title}
          </p>
        )}
        
        {/* Metadata badges */}
        <div className="flex flex-wrap gap-1.5">
          {task.isSuggestion && task.reason && (
            <Badge variant="outline" className="text-[10px] h-5 bg-yellow-500/10 border-yellow-500/30 text-yellow-600">
              {task.reason}
            </Badge>
          )}
          {duration && (
            <Badge variant="outline" className="text-[10px] h-5 gap-1">
              <Clock className="w-3 h-3" />
              {duration}
            </Badge>
          )}
          {EnergyIcon && (
            <Badge variant="outline" className="text-[10px] h-5 gap-1">
              <EnergyIcon className="w-3 h-3" />
              {task.energyLevel}
            </Badge>
          )}
          {TimeIcon && (
            <Badge variant="outline" className="text-[10px] h-5 gap-1">
              <TimeIcon className="w-3 h-3" />
              {task.suggestedTimeOfDay}
            </Badge>
          )}
          {task.category && (
            <Badge variant="outline" className="text-[10px] h-5">
              {task.category}
            </Badge>
          )}
        </div>
      </div>

      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive transition-colors p-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}
