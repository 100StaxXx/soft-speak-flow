import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PLAN_MY_DAY = "Plan my day";

const OTHER_EXAMPLES = [
  // Dates + Times
  "Call mom tomorrow at 3pm",
  "Meeting next Monday at 9am",
  "Submit report by Friday",
  // Duration
  "Deep work session for 2h",
  "Quick 15m email check",
  // Context locations
  "Buy groceries @errands",
  "Reply to emails @work",
  "Evening yoga @home",
  // Priority levels
  "Fix critical bug !urgent",
  "Review docs p2",
  // Difficulty + Energy
  "File taxes hard #high-energy",
  "Water plants easy #low-energy",
  // Recurrence
  "Meditate every day",
  "Team standup every Monday",
  "Gym 3x week",
  // Category (mind/body/soul)
  "Read book for mind",
  "Workout session for body",
  "Journal gratitude for soul",
  // Top 3 / Main Focus
  "Launch feature #top3",
  // Reminders
  "Doctor appt remind 1h before",
  // Notes
  "Call client (prepare notes)",
  // Combined examples
  "Gym @gym tomorrow 6pm for 1h",
];

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Build example list with "Plan my day" appearing more frequently
function buildExampleList(): string[] {
  const shuffled = shuffleArray(OTHER_EXAMPLES);
  const result: string[] = [PLAN_MY_DAY]; // Always start with Plan my day
  
  // Insert "Plan my day" every ~5 examples
  for (let i = 0; i < shuffled.length; i++) {
    result.push(shuffled[i]);
    if ((i + 1) % 5 === 0 && i < shuffled.length - 1) {
      result.push(PLAN_MY_DAY);
    }
  }
  
  return result;
}

interface TypewriterPlaceholderProps {
  isActive: boolean;
  prefix?: string;
}

export function TypewriterPlaceholder({ isActive, prefix = "Add a quest... try '" }: TypewriterPlaceholderProps) {
  // Shuffle once when component mounts (per session)
  const examples = useMemo(() => buildExampleList(), []);
  
  const [exampleIndex, setExampleIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [displayText, setDisplayText] = useState('');

  const currentExample = examples[exampleIndex];

  const tick = useCallback(() => {
    if (!isActive) return;

    if (!isDeleting) {
      // Typing
      if (charIndex < currentExample.length) {
        setDisplayText(currentExample.slice(0, charIndex + 1));
        setCharIndex(prev => prev + 1);
      } else {
        // Pause at end before deleting
        setTimeout(() => setIsDeleting(true), 2000);
      }
    } else {
      // Deleting
      if (charIndex > 0) {
        setDisplayText(currentExample.slice(0, charIndex - 1));
        setCharIndex(prev => prev - 1);
      } else {
        // Move to next example
        setIsDeleting(false);
        setExampleIndex(prev => (prev + 1) % examples.length);
      }
    }
  }, [isActive, charIndex, isDeleting, currentExample, examples.length]);

  useEffect(() => {
    if (!isActive) {
      setDisplayText('');
      setCharIndex(0);
      setIsDeleting(false);
      return;
    }

    const speed = isDeleting ? 30 : 50;
    const timer = setTimeout(tick, speed);
    return () => clearTimeout(timer);
  }, [isActive, tick, isDeleting]);

  if (!isActive) return null;

  return (
    <AnimatePresence>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="text-muted-foreground"
      >
        {prefix}
        <span className="text-foreground/70">{displayText}</span>
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          className="text-primary"
        >
          |
        </motion.span>
        '
      </motion.span>
    </AnimatePresence>
  );
}
