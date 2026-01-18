import { memo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Sparkles } from 'lucide-react';
import { PRESET_BAD_HABITS, AdversaryTheme } from '@/types/astralEncounters';
import { GlassCard } from '@/components/ui/glass-card';

interface AddBadHabitDialogProps {
  onAdd: (params: { name: string; icon: string; theme: AdversaryTheme }) => void;
  isLoading?: boolean;
}

const THEME_OPTIONS: { value: AdversaryTheme; label: string }[] = [
  { value: 'distraction', label: 'Distraction' },
  { value: 'laziness', label: 'Laziness' },
  { value: 'stagnation', label: 'Stagnation' },
  { value: 'anxiety', label: 'Anxiety' },
  { value: 'overthinking', label: 'Overthinking' },
  { value: 'doubt', label: 'Self-Doubt' },
  { value: 'fear', label: 'Fear' },
];

export const AddBadHabitDialog = memo(({ onAdd, isLoading }: AddBadHabitDialogProps) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [customName, setCustomName] = useState('');
  const [customIcon, setCustomIcon] = useState('🚫');
  const [customTheme, setCustomTheme] = useState<AdversaryTheme>('distraction');

  const handlePresetSelect = (preset: typeof PRESET_BAD_HABITS[0]) => {
    onAdd({ name: preset.name, icon: preset.icon, theme: preset.theme });
    setOpen(false);
  };

  const handleCustomSubmit = () => {
    if (!customName.trim()) return;
    onAdd({ name: customName.trim(), icon: customIcon, theme: customTheme });
    setCustomName('');
    setCustomIcon('🚫');
    setCustomTheme('distraction');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Add Bad Habit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Track a Bad Habit
          </DialogTitle>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={mode === 'preset' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('preset')}
            className="flex-1"
          >
            Quick Select
          </Button>
          <Button
            variant={mode === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('custom')}
            className="flex-1"
          >
            Custom
          </Button>
        </div>

        {mode === 'preset' ? (
          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
            {PRESET_BAD_HABITS.map((preset) => (
              <GlassCard
                key={preset.name}
                variant="subtle"
                className="p-3 cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => handlePresetSelect(preset)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{preset.icon}</span>
                  <span className="text-sm font-medium">{preset.name}</span>
                </div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="habit-name">Habit Name</Label>
              <Input
                id="habit-name"
                placeholder="e.g., Late night snacking"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="habit-icon">Icon</Label>
                <Input
                  id="habit-icon"
                  placeholder="🚫"
                  value={customIcon}
                  onChange={(e) => setCustomIcon(e.target.value)}
                  maxLength={2}
                  className="text-center text-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="habit-theme">Category</Label>
                <Select value={customTheme} onValueChange={(v) => setCustomTheme(v as AdversaryTheme)}>
                  <SelectTrigger id="habit-theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THEME_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleCustomSubmit}
              disabled={!customName.trim() || isLoading}
            >
              Add Habit
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});

AddBadHabitDialog.displayName = 'AddBadHabitDialog';
