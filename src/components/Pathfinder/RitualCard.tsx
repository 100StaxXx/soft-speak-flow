import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  GripVertical, 
  Trash2, 
  Clock, 
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { JourneyRitual } from '@/hooks/useJourneySchedule';

interface RitualCardProps {
  ritual: JourneyRitual;
  onUpdate: (ritual: JourneyRitual) => void;
  onDelete: (ritualId: string) => void;
  isEditing?: boolean;
}

const difficultyColors = {
  easy: 'bg-green-500/10 text-green-500 border-green-500/30',
  medium: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  hard: 'bg-red-500/10 text-red-500 border-red-500/30',
};

const frequencyLabels: Record<string, string> = {
  daily: 'Daily',
  '5x_week': '5x/week',
  '3x_week': '3x/week',
  weekly: 'Weekly', // backwards compat
  custom: 'Custom',
};

export const RitualCard = memo(function RitualCard({ ritual, onUpdate, onDelete, isEditing: initialEditing = false }: RitualCardProps) {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [editedRitual, setEditedRitual] = useState(ritual);

  const handleSave = () => {
    onUpdate(editedRitual);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedRitual(ritual);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <motion.div
        layout
        className="p-3 rounded-lg border bg-muted/30 space-y-3"
      >
        <div className="space-y-2">
          <Input
            value={editedRitual.title}
            onChange={(e) => setEditedRitual({ ...editedRitual, title: e.target.value })}
            placeholder="Ritual name"
            className="font-medium"
          />
          <Input
            value={editedRitual.description}
            onChange={(e) => setEditedRitual({ ...editedRitual, description: e.target.value })}
            placeholder="Description (optional)"
            className="text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Frequency</label>
            <Select
              value={editedRitual.frequency}
              onValueChange={(value: 'daily' | '5x_week' | '3x_week' | 'custom') => 
                setEditedRitual({ ...editedRitual, frequency: value })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="5x_week">5x per week</SelectItem>
                <SelectItem value="3x_week">3x per week</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Difficulty</label>
            <Select
              value={editedRitual.difficulty}
              onValueChange={(value: 'easy' | 'medium' | 'hard') => 
                setEditedRitual({ ...editedRitual, difficulty: value })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Minutes</label>
            <Input
              type="number"
              value={editedRitual.estimatedMinutes || ''}
              onChange={(e) => setEditedRitual({ 
                ...editedRitual, 
                estimatedMinutes: parseInt(e.target.value) || undefined 
              })}
              placeholder="15"
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={handleCancel}>
            <X className="w-3 h-3 mr-1" />
            Cancel
          </Button>
          <Button size="sm" className="flex-1" onClick={handleSave}>
            <Check className="w-3 h-3 mr-1" />
            Save
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      className="group flex items-center gap-2 p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors"
    >
      <GripVertical className="w-4 h-4 text-muted-foreground/50 cursor-grab" />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{ritual.title}</span>
          <Badge 
            variant="outline" 
            className={cn('text-[10px] px-1.5 py-0', difficultyColors[ritual.difficulty])}
          >
            {ritual.difficulty}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{frequencyLabels[ritual.frequency]}</span>
          {ritual.estimatedMinutes && (
            <>
              <span>•</span>
              <Clock className="w-3 h-3" />
              <span>{ritual.estimatedMinutes}min</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setIsEditing(true)}
        >
          <Edit2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(ritual.id)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
});
