import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Sparkles, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Clock, 
  Pencil, 
  Check, 
  X,
  Loader2,
  CheckCheck,
  Timer
} from 'lucide-react';
import { useTaskDecomposition, SuggestedSubtask } from '@/hooks/useTaskDecomposition';
import { useSubtasks } from '../hooks/useSubtasks';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DecomposeTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
}

export function DecomposeTaskDialog({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  taskDescription,
}: DecomposeTaskDialogProps) {
  const { decompose, isLoading: isDecomposing, error } = useTaskDecomposition();
  const { bulkAddSubtasks, isBulkAdding } = useSubtasks(taskId);
  
  const [suggestions, setSuggestions] = useState<SuggestedSubtask[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDurationId, setEditingDurationId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Computed values
  const selectedCount = useMemo(() => suggestions.filter(s => s.selected).length, [suggestions]);
  const totalTime = useMemo(() => 
    suggestions.filter(s => s.selected).reduce((acc, s) => acc + s.durationMinutes, 0),
    [suggestions]
  );
  const allSelected = suggestions.length > 0 && selectedCount === suggestions.length;

  // Generate suggestions when dialog opens
  useEffect(() => {
    if (open && !hasGenerated) {
      generateSuggestions();
    }
  }, [open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSuggestions([]);
      setEditingId(null);
      setEditingDurationId(null);
      setEditText('');
      setEditDuration('');
      setNewSubtask('');
      setIsAddingCustom(false);
      setHasGenerated(false);
    }
  }, [open]);

  const generateSuggestions = async () => {
    try {
      const result = await decompose(taskTitle, taskDescription);
      setSuggestions(result);
      setHasGenerated(true);
    } catch (err) {
      toast.error('Failed to build suggestions');
    }
  };

  const handleRegenerate = () => {
    setHasGenerated(false);
    generateSuggestions();
  };

  const toggleSelection = (id: string) => {
    setSuggestions(prev => 
      prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s)
    );
  };

  const toggleSelectAll = () => {
    const newSelected = !allSelected;
    setSuggestions(prev => prev.map(s => ({ ...s, selected: newSelected })));
  };

  const removeSubtask = (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const startEdit = (subtask: SuggestedSubtask) => {
    setEditingId(subtask.id);
    setEditText(subtask.title);
    setEditingDurationId(null);
  };

  const startDurationEdit = (subtask: SuggestedSubtask) => {
    setEditingDurationId(subtask.id);
    setEditDuration(subtask.durationMinutes.toString());
    setEditingId(null);
  };

  const saveEdit = () => {
    if (!editingId || !editText.trim()) return;
    setSuggestions(prev => 
      prev.map(s => s.id === editingId ? { ...s, title: editText.trim() } : s)
    );
    setEditingId(null);
    setEditText('');
  };

  const saveDurationEdit = () => {
    if (!editingDurationId) return;
    const minutes = parseInt(editDuration) || 30;
    setSuggestions(prev => 
      prev.map(s => s.id === editingDurationId ? { ...s, durationMinutes: Math.max(5, Math.min(480, minutes)) } : s)
    );
    setEditingDurationId(null);
    setEditDuration('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
    setEditingDurationId(null);
    setEditDuration('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const handleDurationKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveDurationEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const addCustomSubtask = () => {
    if (!newSubtask.trim()) return;
    const custom: SuggestedSubtask = {
      id: `custom-${Date.now()}`,
      title: newSubtask.trim(),
      durationMinutes: 30,
      selected: true,
    };
    setSuggestions(prev => [...prev, custom]);
    setNewSubtask('');
    setIsAddingCustom(false);
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addCustomSubtask();
    } else if (e.key === 'Escape') {
      setIsAddingCustom(false);
      setNewSubtask('');
    }
  };

  const handleAddSelected = async () => {
    const selectedTitles = suggestions
      .filter(s => s.selected)
      .map(s => s.title);

    if (selectedTitles.length === 0) {
      toast.error('No subtasks selected');
      return;
    }

    try {
      await bulkAddSubtasks(selectedTitles);
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to add subtasks');
    }
  };

  const formatTotalTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Break Down Task
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            "{taskTitle}"
          </p>
        </DialogHeader>

        <div className="py-4">
          {isDecomposing ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 animate-in fade-in duration-300">
              <div className="relative">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <div className="absolute inset-0 w-8 h-8 rounded-full bg-primary/20 animate-ping" />
              </div>
              <p className="text-sm text-muted-foreground">Building subtasks...</p>
              <div className="flex gap-1 mt-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary/40 animate-pulse"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          ) : error && suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 animate-in fade-in duration-300">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={handleRegenerate}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          ) : (
            <>
              {/* Header with select all and regenerate */}
              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="text-muted-foreground hover:text-foreground transition-all"
                  disabled={suggestions.length === 0}
                >
                  <CheckCheck className={cn("w-4 h-4 mr-1", allSelected && "text-primary")} />
                  {allSelected ? 'Deselect all' : 'Select all'}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleRegenerate}
                  disabled={isDecomposing}
                  className="transition-all hover:scale-105"
                >
                  <RefreshCw className={cn("w-4 h-4 mr-1 transition-transform", isDecomposing && "animate-spin")} />
                  Try new suggestions
                </Button>
              </div>

              {/* Suggestions list */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                <AnimatePresence mode="popLayout">
                  {suggestions.map((subtask, index) => (
                    <motion.div
                      key={subtask.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, height: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "group flex items-center gap-2 p-2.5 rounded-lg border transition-all duration-200",
                        subtask.selected 
                          ? "bg-primary/5 border-primary/30 shadow-sm" 
                          : "bg-muted/30 border-border hover:border-muted-foreground/30"
                      )}
                    >
                      <Checkbox
                        checked={subtask.selected}
                        onCheckedChange={() => toggleSelection(subtask.id)}
                        className="transition-transform hover:scale-110"
                      />

                      {editingId === subtask.id ? (
                        <div className="flex-1 flex items-center gap-1 animate-in fade-in duration-150">
                          <Input
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            className="h-7 text-sm"
                            autoFocus
                          />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 hover:bg-green-500/10"
                            onClick={saveEdit}
                          >
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={cancelEdit}
                          >
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          {/* Tap-to-edit title */}
                          <span 
                            className="flex-1 text-sm cursor-pointer hover:text-primary transition-colors duration-150"
                            onClick={() => startEdit(subtask)}
                          >
                            {subtask.title}
                          </span>
                          
                          {/* Duration badge - tap to edit */}
                          {editingDurationId === subtask.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={editDuration}
                                onChange={(e) => setEditDuration(e.target.value)}
                                onKeyDown={handleDurationKeyDown}
                                className="h-6 w-16 text-xs text-center"
                                min={5}
                                max={480}
                                autoFocus
                              />
                              <span className="text-xs text-muted-foreground">min</span>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-5 w-5"
                                onClick={saveDurationEdit}
                              >
                                <Check className="w-3 h-3 text-green-500" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startDurationEdit(subtask)}
                              className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full transition-all hover:bg-muted hover:scale-105"
                            >
                              <Clock className="w-3 h-3" />
                              {subtask.durationMinutes}m
                            </button>
                          )}
                          
                          {/* Always-visible action buttons */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all hover:scale-110"
                            onClick={() => startEdit(subtask)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all hover:scale-110"
                            onClick={() => removeSubtask(subtask.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Add custom subtask */}
              <div className="mt-3">
                {isAddingCustom ? (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex items-center gap-2"
                  >
                    <Input
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={handleAddKeyDown}
                      placeholder="Enter custom subtask..."
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <Button 
                      size="sm" 
                      className="h-8 transition-all hover:scale-105"
                      onClick={addCustomSubtask}
                      disabled={!newSubtask.trim()}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8"
                      onClick={() => {
                        setIsAddingCustom(false);
                        setNewSubtask('');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </motion.div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground transition-all"
                    onClick={() => setIsAddingCustom(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add custom subtask
                  </Button>
                )}
              </div>

              {/* Total time estimate */}
              {selectedCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-primary/5 border border-primary/20"
                >
                  <Timer className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">
                    Estimated total: <span className="text-primary">{formatTotalTime(totalTime)}</span>
                  </span>
                </motion.div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="transition-all hover:scale-105">
            Cancel
          </Button>
          <Button 
            onClick={handleAddSelected}
            disabled={selectedCount === 0 || isBulkAdding || isDecomposing}
            className={cn(
              "transition-all duration-200",
              selectedCount > 0 && "shadow-md hover:shadow-lg hover:scale-105"
            )}
          >
            {isBulkAdding ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Add {selectedCount} Subtask{selectedCount !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
