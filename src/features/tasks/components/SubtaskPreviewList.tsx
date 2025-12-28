import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Timer, Pencil, Trash2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SuggestedSubtask } from '@/hooks/useTaskDecomposition';

interface SubtaskPreviewListProps {
  subtasks: SuggestedSubtask[];
  onChange: (subtasks: SuggestedSubtask[]) => void;
  className?: string;
}

export function SubtaskPreviewList({
  subtasks,
  onChange,
  className
}: SubtaskPreviewListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const selectedCount = subtasks.filter(s => s.selected).length;
  const totalDuration = subtasks
    .filter(s => s.selected)
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  const toggleSubtask = (id: string) => {
    onChange(subtasks.map(s => 
      s.id === id ? { ...s, selected: !s.selected } : s
    ));
  };

  const toggleAll = () => {
    const allSelected = subtasks.every(s => s.selected);
    onChange(subtasks.map(s => ({ ...s, selected: !allSelected })));
  };

  const startEditing = (subtask: SuggestedSubtask) => {
    setEditingId(subtask.id);
    setEditingTitle(subtask.title);
  };

  const saveEdit = () => {
    if (editingId && editingTitle.trim()) {
      onChange(subtasks.map(s => 
        s.id === editingId ? { ...s, title: editingTitle.trim() } : s
      ));
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const deleteSubtask = (id: string) => {
    onChange(subtasks.filter(s => s.id !== id));
  };

  const addCustomSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    
    const newSubtask: SuggestedSubtask = {
      id: `custom-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      durationMinutes: 15,
      selected: true
    };
    
    onChange([...subtasks, newSubtask]);
    setNewSubtaskTitle('');
    setShowAddInput(false);
  };

  const formatDuration = (minutes: number): string => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between text-xs">
        <button 
          onClick={toggleAll}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {subtasks.every(s => s.selected) ? 'Deselect all' : 'Select all'}
        </button>
        <span className="text-muted-foreground">
          {selectedCount} selected • ~{formatDuration(totalDuration)}
        </span>
      </div>

      {/* Subtask List */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {subtasks.map((subtask, index) => (
            <motion.div
              key={subtask.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg transition-colors",
                subtask.selected 
                  ? "bg-primary/5 border border-primary/20" 
                  : "bg-muted/30 border border-transparent opacity-60"
              )}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleSubtask(subtask.id)}
                className={cn(
                  "shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                  subtask.selected 
                    ? "bg-primary border-primary text-primary-foreground" 
                    : "border-muted-foreground/30 hover:border-primary/50"
                )}
              >
                {subtask.selected && <Check className="w-3 h-3" />}
              </button>

              {/* Title */}
              {editingId === subtask.id ? (
                <Input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="h-7 text-sm flex-1"
                  autoFocus
                />
              ) : (
                <span className="flex-1 text-sm truncate">
                  {subtask.title}
                </span>
              )}

              {/* Duration badge */}
              <span className={cn(
                "shrink-0 text-xs px-1.5 py-0.5 rounded flex items-center gap-1",
                subtask.selected 
                  ? "bg-cyan-500/10 text-cyan-600" 
                  : "bg-muted text-muted-foreground"
              )}>
                <Timer className="w-3 h-3" />
                {formatDuration(subtask.durationMinutes)}
              </span>

              {/* Actions */}
              <div className="shrink-0 flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEditing(subtask)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteSubtask(subtask.id)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add Custom Subtask */}
      <AnimatePresence>
        {showAddInput ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2"
          >
            <Input
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              placeholder="Add a custom step..."
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addCustomSubtask();
                if (e.key === 'Escape') setShowAddInput(false);
              }}
              autoFocus
            />
            <Button
              size="sm"
              onClick={addCustomSubtask}
              disabled={!newSubtaskTitle.trim()}
              className="h-8 px-3"
            >
              Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddInput(false)}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowAddInput(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add custom step
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
