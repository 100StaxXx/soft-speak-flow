import { memo } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { ArcadeDifficulty, DIFFICULTY_ORDER, DIFFICULTY_LABELS } from '@/types/arcadeDifficulty';

interface ArcadeDifficultySelectorProps {
  selected: ArcadeDifficulty;
  onSelect: (difficulty: ArcadeDifficulty) => void;
  recommended?: ArcadeDifficulty | null;
  highScores?: Partial<Record<ArcadeDifficulty, string | null>>;
}

export const ArcadeDifficultySelector = memo(({
  selected,
  onSelect,
  recommended,
  highScores,
}: ArcadeDifficultySelectorProps) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">Difficulty</span>
        {recommended && recommended !== selected && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1 text-xs text-yellow-400"
          >
            <Star className="w-3 h-3 fill-yellow-400" />
            <span>Try {DIFFICULTY_LABELS[recommended].label}</span>
          </motion.div>
        )}
      </div>
      
      <div className="flex gap-1.5">
        {DIFFICULTY_ORDER.map((difficulty) => {
          const config = DIFFICULTY_LABELS[difficulty];
          const isSelected = selected === difficulty;
          const isRecommended = recommended === difficulty && !isSelected;
          const highScore = highScores?.[difficulty];
          
          return (
            <motion.button
              key={difficulty}
              onClick={() => onSelect(difficulty)}
              whileTap={{ scale: 0.95 }}
              className={`
                relative flex-1 py-2 px-1 rounded-lg text-xs font-medium
                transition-all duration-200 border
                ${isSelected 
                  ? `bg-gradient-to-r ${config.color} text-white border-white/30 shadow-lg` 
                  : `bg-background/50 border-border/50 text-muted-foreground hover:bg-background/80`
                }
              `}
            >
              {/* Recommended badge */}
              {isRecommended && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 z-10"
                >
                  <div className="relative">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <motion.div
                      className="absolute inset-0"
                      animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Star className="w-4 h-4 fill-yellow-400/50 text-yellow-400/50" />
                    </motion.div>
                  </div>
                </motion.div>
              )}
              
              {/* Label */}
              <span className={isSelected ? 'font-bold' : ''}>
                {config.label}
              </span>
              
              {/* High score indicator */}
              {highScore && (
                <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-muted-foreground/80'}`}>
                  {highScore}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
});

ArcadeDifficultySelector.displayName = 'ArcadeDifficultySelector';
