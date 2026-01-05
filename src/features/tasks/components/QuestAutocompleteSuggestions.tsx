import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AutocompleteSuggestion } from '@/hooks/useQuestAutocomplete';

interface QuestAutocompleteSuggestionsProps {
  suggestions: AutocompleteSuggestion[];
  onSelect: (text: string) => void;
  isVisible: boolean;
  selectedIndex: number;
  inputValue: string;
}

export const QuestAutocompleteSuggestions = memo(function QuestAutocompleteSuggestions({
  suggestions,
  onSelect,
  isVisible,
  selectedIndex,
  inputValue,
}: QuestAutocompleteSuggestionsProps) {
  if (!isVisible || suggestions.length === 0) return null;

  const highlightMatch = (text: string, query: string) => {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase().trim();
    const startIndex = lowerText.indexOf(lowerQuery);
    
    if (startIndex === -1) return text;

    const before = text.slice(0, startIndex);
    const match = text.slice(startIndex, startIndex + lowerQuery.length);
    const after = text.slice(startIndex + lowerQuery.length);

    return (
      <>
        {before}
        <span className="text-primary font-medium">{match}</span>
        {after}
      </>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="absolute left-0 right-0 top-full mt-1 z-50"
      >
        <div className="bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.source}-${suggestion.text}`}
              type="button"
              onClick={() => onSelect(suggestion.text)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-left text-sm",
                "transition-colors duration-75",
                "hover:bg-accent",
                index === selectedIndex && "bg-accent"
              )}
            >
              {/* Source icon */}
              <span className={cn(
                "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
                suggestion.source === 'recent' 
                  ? "bg-muted-foreground/10 text-muted-foreground" 
                  : "bg-primary/10 text-primary"
              )}>
                {suggestion.source === 'recent' ? (
                  <Clock className="h-3 w-3" />
                ) : (
                  <Repeat className="h-3 w-3" />
                )}
              </span>

              {/* Text with highlighted match */}
              <span className="flex-1 truncate text-foreground">
                {highlightMatch(suggestion.text, inputValue)}
              </span>

              {/* Frequency badge for recent items */}
              {suggestion.source === 'recent' && suggestion.frequency > 1 && (
                <span className="flex-shrink-0 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  {suggestion.frequency}×
                </span>
              )}

              {/* Habit label */}
              {suggestion.source === 'habit' && (
                <span className="flex-shrink-0 text-[10px] text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-full">
                  ritual
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
});
