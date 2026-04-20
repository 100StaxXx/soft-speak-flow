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
import { plannerPathfinderTheme } from '@/components/companion/plannerPathfinderTheme';
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
import { DurationPickerField } from '@/components/scheduling';
import { cn } from '@/lib/utils';
import type { JourneyRitual } from '@/hooks/useJourneySchedule';
import { FrequencyPresets, formatDaysShort, getDefaultDaysForFrequency, getDefaultMonthDays } from './FrequencyPresets';
import { formatScheduleLabel, inferCustomPeriod } from '@/utils/habitSchedule';

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

  const handleFrequencyChange = ({
    frequency,
    customDays,
    customMonthDays,
    customPeriod,
  }: {
    frequency: 'daily' | '5x_week' | 'weekly' | 'monthly' | 'custom';
    customDays: number[];
    customMonthDays: number[];
    customPeriod: 'week' | 'month';
  }) => {
    setEditedRitual({
      ...editedRitual,
      frequency,
      customDays,
      customMonthDays,
      customPeriod,
    });
  };

  if (isEditing) {
    return (
      <motion.div
        layout
        className={`${plannerPathfinderTheme.raisedPanel} space-y-3 p-4`}
      >
        <div className="space-y-2">
          <Input
            value={editedRitual.title}
            onChange={(e) => setEditedRitual({ ...editedRitual, title: e.target.value })}
            placeholder="Ritual name"
            className={cn(plannerPathfinderTheme.textField, "font-medium")}
          />
          <Input
            value={editedRitual.description}
            onChange={(e) => setEditedRitual({ ...editedRitual, description: e.target.value })}
            placeholder="Description (optional)"
            className={cn(plannerPathfinderTheme.textField, "text-sm")}
          />
        </div>

        {/* Frequency Presets */}
        <FrequencyPresets
          frequency={editedRitual.frequency === '3x_week' ? 'custom' : editedRitual.frequency as 'daily' | '5x_week' | 'weekly' | 'monthly' | 'custom'}
          customDays={editedRitual.customDays || getDefaultDaysForFrequency(editedRitual.frequency)}
          customMonthDays={editedRitual.customMonthDays || getDefaultMonthDays(editedRitual.frequency)}
          customPeriod={editedRitual.customPeriod ?? inferCustomPeriod({
            frequency: editedRitual.frequency,
            custom_days: editedRitual.customDays,
            custom_month_days: editedRitual.customMonthDays,
          })}
          onFrequencyChange={handleFrequencyChange}
          variant="planner"
        />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={cn("mb-1 block text-[10px]", plannerPathfinderTheme.sectionEyebrow)}>Difficulty</label>
            <Select
              value={editedRitual.difficulty}
              onValueChange={(value: 'easy' | 'medium' | 'hard') => 
                setEditedRitual({ ...editedRitual, difficulty: value })
              }
            >
              <SelectTrigger className={cn(plannerPathfinderTheme.textField, "h-10 text-xs")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DurationPickerField
            value={editedRitual.estimatedMinutes ?? null}
            onChange={(duration) => setEditedRitual({
              ...editedRitual,
              estimatedMinutes: duration ?? undefined,
            })}
            label="Minutes"
            variant="compact"
            className="min-w-0"
          />
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className={cn(plannerPathfinderTheme.outlineButton, "flex-1")}
            onClick={handleCancel}
          >
            <X className="w-3 h-3 mr-1" />
            Cancel
          </Button>
          <Button size="sm" className={cn(plannerPathfinderTheme.primaryButton, "flex-1")} onClick={handleSave}>
            <Check className="w-3 h-3 mr-1" />
            Save
          </Button>
        </div>
      </motion.div>
    );
  }

  // Get display days
  const customPeriod = ritual.customPeriod ?? inferCustomPeriod({
    frequency: ritual.frequency,
    custom_days: ritual.customDays,
    custom_month_days: ritual.customMonthDays,
  });
  const displayDays = formatDaysShort(ritual.customDays || [], ritual.customMonthDays || [], customPeriod);

  return (
    <motion.div
      layout
      className={`${plannerPathfinderTheme.mutedPanel} group flex items-center gap-2 p-3 transition-colors hover:bg-white/75`}
    >
      <GripVertical className="w-4 h-4 cursor-grab text-[#8d481c]/45" />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{ritual.title}</span>
          <Badge 
            variant="outline" 
            className={cn(plannerPathfinderTheme.chip, 'text-[10px] px-1.5 py-0', difficultyColors[ritual.difficulty])}
          >
            {ritual.difficulty}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#7f4a1d]/80">
          <span>{formatScheduleLabel({
            frequency: ritual.frequency,
            custom_days: ritual.customDays,
            custom_month_days: ritual.customMonthDays,
            customPeriod: customPeriod,
          })}</span>
          {displayDays && ritual.frequency !== 'daily' && (
            <>
              <span className="text-[10px] opacity-70">({displayDays})</span>
            </>
          )}
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
          className={cn(plannerPathfinderTheme.outlineButton, "h-8 w-8 p-0")}
          onClick={() => setIsEditing(true)}
        >
          <Edit2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-full border-[3px] border-[#8a2716] bg-white/60 p-0 text-[#8a2716] shadow-[0_6px_0_rgba(138,39,22,0.18)] hover:bg-white/75 hover:text-[#8a2716]"
          onClick={() => onDelete(ritual.id)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
});
