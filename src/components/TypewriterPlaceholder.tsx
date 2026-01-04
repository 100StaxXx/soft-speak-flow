import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EXAMPLES = [
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

interface TypewriterPlaceholderProps {
  isActive: boolean;
  prefix?: string;
}

export function TypewriterPlaceholder({ isActive, prefix = "Add a quest... try '" }: TypewriterPlaceholderProps) {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [displayText, setDisplayText] = useState('');

  const currentExample = EXAMPLES[exampleIndex];

  const tick = useCallback(() => {
    if (!isActive) return;

    if (!isDeleting) {
      // Typing
      if (charIndex < currentExample.length) {
        setDisplayText(currentExample.slice(0, charIndex + 1));
        setCharIndex(prev => prev + 1);
      } else {
        // Pause at end before deleting
        setTimeout(() => setIsDeleting(true), 6000);
      }
    } else {
      // Deleting
      if (charIndex > 0) {
        setDisplayText(currentExample.slice(0, charIndex - 1));
        setCharIndex(prev => prev - 1);
      } else {
        // Move to next example
        setIsDeleting(false);
        setExampleIndex(prev => (prev + 1) % EXAMPLES.length);
      }
    }
  }, [isActive, charIndex, isDeleting, currentExample]);

  useEffect(() => {
    if (!isActive) {
      setDisplayText('');
      setCharIndex(0);
      setIsDeleting(false);
      return;
    }

    const speed = isDeleting ? 60 : 100;
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
