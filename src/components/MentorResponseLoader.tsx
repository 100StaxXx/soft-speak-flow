import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const LOADING_PHRASES = [
  "Channeling wisdom...",
  "Consulting the stars...",
  "Gathering insights...",
  "Aligning thoughts...",
  "Seeking clarity...",
];

interface MentorResponseLoaderProps {
  mentorName: string;
}

export const MentorResponseLoader = ({ mentorName }: MentorResponseLoaderProps) => {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="font-semibold text-sm">{mentorName}</div>
      
      <div className="flex items-center gap-3">
        {/* Cosmic orb animation */}
        <div className="relative w-8 h-8">
          {/* Outer ring */}
          <motion.div
            className="absolute inset-0 rounded-full border border-primary/30"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />
          
          {/* Inner pulsing core */}
          <motion.div
            className="absolute inset-1 rounded-full bg-gradient-to-br from-primary/40 to-purple-500/30"
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.6, 1, 0.6],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          
          {/* Orbiting particles */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-primary/80"
              style={{
                top: "50%",
                left: "50%",
                marginTop: -3,
                marginLeft: -3,
              }}
              animate={{
                x: Math.cos((i * Math.PI * 2) / 3) * 12,
                y: Math.sin((i * Math.PI * 2) / 3) * 12,
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.3,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
        
        {/* Loading phrase */}
        <motion.span
          key={phraseIndex}
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 5 }}
          className="text-sm text-muted-foreground italic"
        >
          {LOADING_PHRASES[phraseIndex]}
        </motion.span>
      </div>
    </div>
  );
};
