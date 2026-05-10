import { memo } from 'react';
import { motion } from 'framer-motion';
import { Check, Repeat, Flag } from 'lucide-react';
import { cn, stripMarkdown } from '@/lib/utils';
import type { EpicSuggestion } from '@/hooks/useEpicSuggestions';

interface SuggestionCardProps {
  suggestion: EpicSuggestion;
  onToggle: (id: string) => void;
  index: number;
}

const difficultyConfig = {
  easy: { label: 'Easy', color: 'text-green-500 bg-green-500/10 border-green-500/20' },
  medium: { label: 'Medium', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  hard: { label: 'Hard', color: 'text-red-500 bg-red-500/10 border-red-500/20' },
};

const frequencyLabels: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  custom: 'Custom Days',
};

export const SuggestionCard = memo(function SuggestionCard({
  suggestion,
  onToggle,
  index,
}: SuggestionCardProps) {
  const isHabit = suggestion.type === 'habit';
  const difficulty = difficultyConfig[suggestion.difficulty];

  return (
    <motion.button
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      onClick={() => onToggle(suggestion.id)}
      className={cn(
        'w-full p-4 rounded-xl border text-left transition-all duration-200',
        'hover:shadow-[0_14px_32px_-28px_rgba(28,87,135,0.44)] hover:scale-[1.02] active:scale-[0.98]',
        suggestion.selected
          ? 'border-[hsl(var(--celestial-blue)_/_0.42)] bg-[linear-gradient(180deg,#ffffff_0%,hsl(var(--celestial-blue)_/_0.16)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]'
          : 'border-[hsl(var(--celestial-blue)_/_0.24)] bg-card/70 hover:border-[hsl(var(--celestial-blue)_/_0.42)]'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Selection indicator */}
        <div
          className={cn(
            'w-6 h-6 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all',
            suggestion.selected
              ? 'border-[hsl(var(--celestial-blue)_/_0.5)] bg-[linear-gradient(180deg,#ffffff_0%,hsl(var(--celestial-blue)_/_0.38)_100%)] text-[hsl(var(--deep-space))]'
              : 'border-muted-foreground/30'
          )}
        >
          {suggestion.selected && <Check className="w-4 h-4" />}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title and type badge */}
          <div className="flex items-center gap-2 mb-1">
            {isHabit ? (
              <Repeat className="w-4 h-4 text-epic-nature shrink-0" />
            ) : (
              <Flag className="w-4 h-4 text-stardust-gold shrink-0" />
            )}
            <span className="font-semibold text-foreground truncate">
              {suggestion.title}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {stripMarkdown(suggestion.description)}
          </p>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {/* Type badge */}
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full border',
                isHabit
                  ? 'text-epic-nature bg-epic-nature/10 border-epic-nature/25'
                  : 'text-stardust-gold bg-stardust-gold/10 border-stardust-gold/25'
              )}
            >
              {isHabit ? 'Habit' : 'Milestone'}
            </span>

            {/* Frequency for habits */}
            {isHabit && suggestion.frequency && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                {frequencyLabels[suggestion.frequency] || suggestion.frequency}
              </span>
            )}

            {/* Week target for milestones */}
            {!isHabit && suggestion.suggestedWeek && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                Week {suggestion.suggestedWeek}
              </span>
            )}

            {/* Difficulty */}
            <span className={cn('text-xs px-2 py-0.5 rounded-full border', difficulty.color)}>
              {difficulty.label}
            </span>

            {/* Category */}
            {suggestion.category && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {suggestion.category}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  );
});
