import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DestinyRevealProps {
  userName: string;
  onComplete: () => void;
}

const narrativeLines = [
  "The stars have watched countless souls wander through the cosmos...",
  "But few possess the spark to shape their own destiny.",
  "You are different.",
  "The universe has been waiting for you.",
];

export const DestinyReveal = ({ userName, onComplete }: DestinyRevealProps) => {
  const [currentLine, setCurrentLine] = useState(0);
  const [showFinalMessage, setShowFinalMessage] = useState(false);
  const [showButton, setShowButton] = useState(false);

  // Memoize particle positions to prevent them from jumping on re-render
  const particlePositions = useMemo(() => 
    [...Array(6)].map(() => ({
      x: Math.random() * 400 - 200,
      y: Math.random() * 400 - 200,
      left: `${20 + Math.random() * 60}%`,
      top: `${30 + Math.random() * 40}%`,
      duration: 4 + Math.random() * 2,
    })), []);

  useEffect(() => {
    if (currentLine < narrativeLines.length) {
      const timer = setTimeout(() => {
        setCurrentLine(prev => prev + 1);
      }, 2500);
      return () => clearTimeout(timer);
    } else {
      const finalTimer = setTimeout(() => {
        setShowFinalMessage(true);
      }, 800);
      return () => clearTimeout(finalTimer);
    }
  }, [currentLine]);

  useEffect(() => {
    if (showFinalMessage) {
      const buttonTimer = setTimeout(() => {
        setShowButton(true);
      }, 2000);
      return () => clearTimeout(buttonTimer);
    }
  }, [showFinalMessage]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 pt-safe-top safe-area-bottom relative">
      {/* Ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      </div>

      <div className="relative z-10 max-w-lg text-center space-y-8">
        {/* Narrative lines */}
        <div className="min-h-[200px] flex flex-col items-center justify-center space-y-6">
          <AnimatePresence mode="wait">
            {narrativeLines.map((line, index) => (
              index === currentLine - 1 && index < narrativeLines.length && (
                <motion.p
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.8 }}
                  className="text-lg md:text-xl text-muted-foreground italic leading-relaxed"
                >
                  {line}
                </motion.p>
              )
            ))}
          </AnimatePresence>

          {/* Final personalized message */}
          <AnimatePresence>
            {showFinalMessage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="space-y-4"
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center justify-center gap-2 text-primary"
                >
                  <Sparkles className="h-5 w-5" />
                  <span className="text-sm uppercase tracking-[0.3em] font-medium">Your Path Awaits</span>
                  <Sparkles className="h-5 w-5" />
                </motion.div>
                
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="text-3xl md:text-4xl font-bold text-foreground"
                >
                  Welcome, <span className="text-primary">{userName}</span>
                </motion.h1>
                
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="text-muted-foreground text-lg"
                >
                  Every legend begins with a choice.
                  <br />
                  <span className="text-foreground/80">Choose your allegiance.</span>
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Continue button */}
        <AnimatePresence>
          {showButton && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Button
                onClick={onComplete}
                size="lg"
                className="px-8 py-6 text-lg bg-primary hover:bg-primary/90"
              >
                Choose My Faction
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating particles */}
      {particlePositions.map((particle, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-primary/40 rounded-full"
          initial={{ 
            x: particle.x, 
            y: particle.y,
            opacity: 0 
          }}
          animate={{ 
            y: [null, -100],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: i * 0.8,
          }}
          style={{
            left: particle.left,
            top: particle.top,
          }}
        />
      ))}
    </div>
  );
};
