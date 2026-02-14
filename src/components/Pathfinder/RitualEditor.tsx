import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Clock, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RitualCard } from './RitualCard';
import { cn } from '@/lib/utils';
import type { JourneyRitual } from '@/hooks/useJourneySchedule';

interface RitualEditorProps {
  rituals: JourneyRitual[];
  originalRituals: JourneyRitual[];
  onRitualsChange: (rituals: JourneyRitual[]) => void;
  className?: string;
}

export function RitualEditor({ 
  rituals, 
  originalRituals, 
  onRitualsChange,
  className 
}: RitualEditorProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newRitualTitle, setNewRitualTitle] = useState('');

  // Calculate weekly time commitment
  const weeklyMinutes = useMemo(() => {
    return rituals.reduce((total, ritual) => {
      const minutes = ritual.estimatedMinutes || 15;
      const multiplierMap: Record<string, number> = {
        daily: 7,
        '5x_week': 5,
        '3x_week': 3,
        weekly: 1, // backwards compat
        custom: 3, // default assumption
      };
      const multiplier = multiplierMap[ritual.frequency] || 3;
      return total + (minutes * multiplier);
    }, 0);
  }, [rituals]);

  const weeklyHours = Math.round((weeklyMinutes / 60) * 10) / 10;

  const handleUpdateRitual = (updatedRitual: JourneyRitual) => {
    onRitualsChange(
      rituals.map(r => r.id === updatedRitual.id ? updatedRitual : r)
    );
  };

  const handleDeleteRitual = (ritualId: string) => {
    onRitualsChange(rituals.filter(r => r.id !== ritualId));
  };

  const handleAddRitual = () => {
    if (!newRitualTitle.trim()) return;
    
    const newRitual: JourneyRitual = {
      id: `custom-${Date.now()}`,
      title: newRitualTitle.trim(),
      description: '',
      frequency: 'daily',
      difficulty: 'medium',
      estimatedMinutes: 15,
    };
    
    onRitualsChange([...rituals, newRitual]);
    setNewRitualTitle('');
    setIsAddingNew(false);
  };

  const handleReset = () => {
    onRitualsChange([...originalRituals]);
  };

  const hasChanges = JSON.stringify(rituals) !== JSON.stringify(originalRituals);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="w-3 h-3" />
            {rituals.length} Rituals
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Clock className="w-3 h-3" />
            ~{weeklyHours} hrs/week
          </Badge>
        </div>
        
        {hasChanges && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </Button>
        )}
      </div>

      {/* Rituals list */}
      <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {rituals.map((ritual) => (
              <motion.div
                key={ritual.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <RitualCard
                  ritual={ritual}
                  onUpdate={handleUpdateRitual}
                  onDelete={handleDeleteRitual}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Add new ritual */}
          <AnimatePresence>
            {isAddingNew ? (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex gap-2"
              >
                <Input
                  value={newRitualTitle}
                  onChange={(e) => setNewRitualTitle(e.target.value)}
                  placeholder="New ritual name..."
                  className="flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddRitual();
                    if (e.key === 'Escape') setIsAddingNew(false);
                  }}
                />
                <Button size="sm" onClick={handleAddRitual} disabled={!newRitualTitle.trim()}>
                  Add
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsAddingNew(false)}>
                  Cancel
                </Button>
              </motion.div>
            ) : (
              <motion.div layout>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed gap-2"
                  onClick={() => setIsAddingNew(true)}
                >
                  <Plus className="w-4 h-4" />
                  Add Custom Ritual
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
      </div>

      {/* Difficulty breakdown */}
      <div className="flex gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          {rituals.filter(r => r.difficulty === 'easy').length} easy
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          {rituals.filter(r => r.difficulty === 'medium').length} medium
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          {rituals.filter(r => r.difficulty === 'hard').length} hard
        </span>
      </div>
    </div>
  );
}
