import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EXAMPLES = [
  "Call mom tomorrow at 3pm",
  "Workout for 30min @gym",
  "Submit report by Friday !urgent",
  "Read for 1h #low-energy",
  "Weekly team sync every Monday",
  "Buy groceries @errands easy",
  "Deep work session 2h #high-energy",
  "Dentist appointment Jan 15 at 10am",
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
