import React, { useState, useEffect } from 'react';
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
  Loader2 
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
  const [editText, setEditText] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

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
      setEditText('');
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
      toast.error('Failed to generate suggestions');
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

  const removeSubtask = (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const startEdit = (subtask: SuggestedSubtask) => {
    setEditingId(subtask.id);
    setEditText(subtask.title);
  };

  const saveEdit = () => {
    if (!editingId || !editText.trim()) return;
    setSuggestions(prev => 
      prev.map(s => s.id === editingId ? { ...s, title: editText.trim() } : s)
    );
    setEditingId(null);
    setEditText('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
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

  const selectedCount = suggestions.filter(s => s.selected).length;

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
              <p className="text-sm text-muted-foreground">Generating subtasks...</p>
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
              {/* Regenerate button */}
              <div className="flex justify-end mb-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleRegenerate}
                  disabled={isDecomposing}
                  className="transition-all hover:scale-105"
                >
                  <RefreshCw className={cn("w-4 h-4 mr-1 transition-transform", isDecomposing && "animate-spin")} />
                  Regenerate
                </Button>
              </div>

              {/* Suggestions list */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {suggestions.map((subtask, index) => (
                  <div
                    key={subtask.id}
                    className={cn(
                      "group flex items-center gap-2 p-2.5 rounded-lg border transition-all duration-200",
                      "animate-in fade-in slide-in-from-left-2",
                      subtask.selected 
                        ? "bg-primary/5 border-primary/30 shadow-sm" 
                        : "bg-muted/30 border-border hover:border-muted-foreground/30"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
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
                        {/* Duration badge */}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full transition-colors hover:bg-muted">
                          <Clock className="w-3 h-3" />
                          {subtask.durationMinutes}m
                        </span>
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
                  </div>
                ))}
              </div>

              {/* Add custom subtask */}
              <div className="mt-3">
                {isAddingCustom ? (
                  <div className="flex items-center gap-2">
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
                      className="h-8"
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
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setIsAddingCustom(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add custom subtask
                  </Button>
                )}
              </div>
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
