import { motion } from "framer-motion";

interface SuggestedSearchesProps {
  onSearch: (query: string) => void;
}

const suggestions = [
  { label: "motivation", emoji: "🔥" },
  { label: "anxiety", emoji: "🌊" },
  { label: "confidence", emoji: "💪" },
  { label: "morning", emoji: "🌅" },
  { label: "growth", emoji: "🌱" },
  { label: "peace", emoji: "☮️" },
  { label: "strength", emoji: "⚡" },
  { label: "self-love", emoji: "💜" },
];

export const SuggestedSearches = ({ onSearch }: SuggestedSearchesProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8, duration: 0.5 }}
      className="mb-8"
    >
      <p className="text-sm text-muted-foreground mb-3 text-center">
        Popular searches
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((suggestion, index) => (
          <motion.button
            key={suggestion.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9 + index * 0.05 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSearch(suggestion.label)}
            className="px-4 py-2 rounded-full bg-card/50 border border-white/10 text-sm text-foreground hover:border-primary/50 hover:bg-primary/10 transition-all backdrop-blur-sm"
          >
            <span className="mr-1.5">{suggestion.emoji}</span>
            {suggestion.label}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};