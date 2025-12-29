import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, Palette, Loader2, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StoryTypeSelector, storyTypes } from '@/components/narrative/StoryTypeSelector';
import type { StoryTypeSlug } from '@/types/narrativeTypes';

// Theme colors available for epics
const themeColors = [
  { id: 'heroic', label: 'Heroic Gold', color: 'from-amber-500 to-yellow-600', value: '#f59e0b' },
  { id: 'warrior', label: 'Warrior Red', color: 'from-red-500 to-rose-600', value: '#ef4444' },
  { id: 'nature', label: 'Nature Green', color: 'from-emerald-500 to-green-600', value: '#10b981' },
  { id: 'cosmic', label: 'Cosmic Purple', color: 'from-purple-500 to-violet-600', value: '#8b5cf6' },
  { id: 'ocean', label: 'Ocean Blue', color: 'from-blue-500 to-cyan-600', value: '#3b82f6' },
  { id: 'sunset', label: 'Sunset Orange', color: 'from-orange-500 to-amber-600', value: '#f97316' },
  { id: 'mystic', label: 'Mystic Pink', color: 'from-pink-500 to-rose-600', value: '#ec4899' },
  { id: 'shadow', label: 'Shadow Gray', color: 'from-slate-600 to-zinc-700', value: '#475569' },
];

interface StoryStepProps {
  storyType: StoryTypeSlug | null;
  themeColor: string;
  onStoryTypeChange: (type: StoryTypeSlug) => void;
  onThemeColorChange: (color: string) => void;
  onContinue: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

export function StoryStep({
  storyType,
  themeColor,
  onStoryTypeChange,
  onThemeColorChange,
  onContinue,
  onBack,
  isLoading = false,
}: StoryStepProps) {
  const selectedTheme = themeColors.find(t => t.value === themeColor) || themeColors[0];

  return (
    <motion.div
      key="story"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full min-h-0"
    >
      <div className="flex-1 overflow-y-auto px-6 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
        <div className="space-y-6 pb-4">
          {/* Story Type Selection */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Choose Your Story</Label>
            <p className="text-xs text-muted-foreground mb-3">
              Your epic will unfold as a narrative adventure with chapters and a final boss
            </p>
            <StoryTypeSelector
              selectedType={storyType}
              onSelect={onStoryTypeChange}
            />
          </div>

          {/* Theme Color Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Theme Color
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {themeColors.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => onThemeColorChange(theme.value)}
                  className={cn(
                    "relative h-12 rounded-lg transition-all",
                    "bg-gradient-to-br",
                    theme.color,
                    themeColor === theme.value
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105"
                      : "hover:scale-105"
                  )}
                  title={theme.label}
                >
                  {themeColor === theme.value && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-3 h-3 bg-white rounded-full shadow-lg" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {selectedTheme.label}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 pt-4 border-t bg-background space-y-3">
        <Button
          onClick={onContinue}
          disabled={!storyType || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating your plan...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Generate Smart Timeline
            </>
          )}
        </Button>
        <Button variant="ghost" onClick={onBack} className="w-full" disabled={isLoading}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
      </div>
    </motion.div>
  );
}

export { themeColors };
