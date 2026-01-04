import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Star, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JourneyBeginsProps {
  userName: string;
  companionAnimal: string;
  onComplete: () => void;
}

const narrativeLines = [
  "A bond has been forged across the cosmos...",
  "Your companion stirs, awakening to your presence.",
  "Together, you will write a story the stars themselves will remember.",
  "Every quest completed, every habit built, every moment of growth...",
  "...will shape both your destinies.",
];

export const JourneyBegins = ({ userName, companionAnimal, onComplete }: JourneyBeginsProps) => {
  const [currentLine, setCurrentLine] = useState(0);
  const [showFinalMessage, setShowFinalMessage] = useState(false);
  const [showButton, setShowButton] = useState(false);

  // Memoize particle positions to prevent them from jumping on re-render
  const particlePositions = useMemo(() => 
    [...Array(12)].map(() => ({
      left: `${10 + Math.random() * 80}%`,
      top: `${50 + Math.random() * 40}%`,
      duration: 5 + Math.random() * 3,
    })), []);

  useEffect(() => {
    if (currentLine < narrativeLines.length) {
      const timer = setTimeout(() => {
        setCurrentLine(prev => prev + 1);
      }, 3400);
      return () => clearTimeout(timer);
    } else {
      const finalTimer = setTimeout(() => {
        setShowFinalMessage(true);
      }, 1200);
      return () => clearTimeout(finalTimer);
    }
  }, [currentLine]);

  useEffect(() => {
    if (showFinalMessage) {
      const buttonTimer = setTimeout(() => {
        setShowButton(true);
      }, 3200);
      return () => clearTimeout(buttonTimer);
    }
  }, [showFinalMessage]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 pt-safe-top safe-area-bottom relative overflow-hidden">
      {/* Ambient glow - pulsing cosmic energy */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div 
          className="w-[400px] h-[400px] bg-primary/15 rounded-full blur-[100px]"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute w-[300px] h-[300px] bg-accent/10 rounded-full blur-[80px]"
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative z-10 max-w-lg text-center space-y-8">
        {/* Narrative lines */}
        <div className="min-h-[220px] flex flex-col items-center justify-center space-y-6">
          <AnimatePresence mode="wait">
            {!showFinalMessage && narrativeLines.map((line, index) => (
              index === currentLine - 1 && (
                <motion.p
                  key={index}
                  initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(2px)" }}
                  transition={{ duration: 0.9 }}
                  className="text-lg md:text-xl text-white/80 italic leading-relaxed"
                >
                  {line}
                </motion.p>
              )
            ))}
          </AnimatePresence>

          {/* Final message */}
          <AnimatePresence>
            {showFinalMessage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="space-y-5"
              >
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center justify-center gap-3"
                >
                  <Star className="h-4 w-4 text-primary" />
                  <span className="text-xs uppercase tracking-[0.4em] font-medium text-primary/80">
                    Your Journey Awaits
                  </span>
                  <Star className="h-4 w-4 text-primary" />
                </motion.div>
                
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-3xl md:text-4xl font-bold"
                >
                  <span className="bg-gradient-to-r from-white via-primary-foreground to-white bg-clip-text text-transparent">
                    {userName} & {companionAnimal}
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-white/60 text-base"
                >
                  An unbreakable bond, a shared destiny.
                </motion.p>
                
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                  className="pt-2"
                >
                  <p className="text-white/70 text-lg">
                    The cosmos holds infinite possibilities.
                  </p>
                  <p className="text-white/50 text-sm mt-1">
                    Your first quest awaits...
                  </p>
                </motion.div>
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
              transition={{ duration: 0.6 }}
            >
              <Button
                onClick={onComplete}
                variant="cta"
                size="lg"
                className="px-10 py-6 text-lg gap-2"
              >
                <Rocket className="h-5 w-5" />
                Begin My Journey
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating star particles */}
      {particlePositions.map((particle, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white/50 rounded-full"
          initial={{ 
            opacity: 0,
          }}
          animate={{ 
            y: [0, -150],
            opacity: [0, 0.8, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: i * 0.6,
            ease: "easeOut",
          }}
          style={{
            left: particle.left,
            top: particle.top,
          }}
        />
      ))}

      {/* Orbiting sparkles */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={`orbit-${i}`}
          className="absolute"
          style={{
            left: "50%",
            top: "50%",
          }}
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 15 + i * 5,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <Sparkles 
            className="text-primary/30" 
            size={12 + i * 4}
            style={{
              transform: `translate(${80 + i * 40}px, 0)`,
            }}
          />
        </motion.div>
      ))}
    </div>
  );
};
