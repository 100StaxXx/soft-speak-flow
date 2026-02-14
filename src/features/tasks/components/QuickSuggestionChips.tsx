import { motion } from 'framer-motion';
import { 
  Calendar, 
  MapPin, 
  Timer, 
  Zap, 
  AlertTriangle,
  Star,
  Repeat
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickSuggestionChipsProps {
  onSuggestionClick: (text: string) => void;
  currentInput: string;
  className?: string;
}

const SUGGESTIONS = [
  { text: 'today', icon: Calendar, category: 'date' },
  { text: 'tomorrow', icon: Calendar, category: 'date' },
  { text: '30m', icon: Timer, category: 'duration' },
  { text: '1h', icon: Timer, category: 'duration' },
  { text: '@work', icon: MapPin, category: 'context' },
  { text: '@home', icon: MapPin, category: 'context' },
  { text: '!urgent', icon: AlertTriangle, category: 'priority' },
  { text: 'easy', icon: Zap, category: 'difficulty' },
  { text: '#top3', icon: Star, category: 'special' },
  { text: 'every day', icon: Repeat, category: 'recurrence' },
];

export function QuickSuggestionChips({ 
  onSuggestionClick, 
  currentInput,
  className 
}: QuickSuggestionChipsProps) {
  // Filter out suggestions that are already present in the input
  const filteredSuggestions = SUGGESTIONS.filter(s => {
    const normalizedInput = currentInput.toLowerCase();
    const normalizedSuggestion = s.text.toLowerCase();
    
    // Don't show if already in input
    if (normalizedInput.includes(normalizedSuggestion)) return false;
    
    // Don't show date suggestions if input already has a date
    if (s.category === 'date' && 
        (normalizedInput.includes('today') || 
         normalizedInput.includes('tomorrow') ||
         normalizedInput.includes('monday') ||
         normalizedInput.includes('tuesday') ||
         normalizedInput.includes('wednesday') ||
         normalizedInput.includes('thursday') ||
         normalizedInput.includes('friday') ||
         normalizedInput.includes('saturday') ||
         normalizedInput.includes('sunday'))) {
      return false;
    }
    
    // Don't show context if already has one
    if (s.category === 'context' && normalizedInput.includes('@')) return false;
    
    // Don't show duration if already has one
    if (s.category === 'duration' && 
        (normalizedInput.includes('min') || 
         normalizedInput.includes('hour') || 
         /\d+[hm]/.test(normalizedInput))) {
      return false;
    }
    
    return true;
  }).slice(0, 6); // Show max 6 suggestions

  if (filteredSuggestions.length === 0) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {filteredSuggestions.map((suggestion, index) => {
        const Icon = suggestion.icon;
        return (
          <motion.button
            key={suggestion.text}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => onSuggestionClick(suggestion.text)}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
              "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground",
              "border border-transparent hover:border-border",
              "transition-all duration-150 hover:scale-105 active:scale-95"
            )}
          >
            <Icon className="h-3 w-3" />
            {suggestion.text}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
