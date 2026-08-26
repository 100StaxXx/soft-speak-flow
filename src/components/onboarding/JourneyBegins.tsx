import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Sunrise, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRODUCT } from "@/config/product";

interface JourneyBeginsProps {
  userName: string;
  companionAnimal: string;
  onComplete: () => void;
}

const narrativeLines = PRODUCT.mode === "christian"
  ? [
      "Your daily path is ready...",
      "Your Guide helps you listen and choose a direction.",
      "Today turns that direction into one faithful step.",
      "Your companion notices, responds, and carries the thread forward.",
      "In the evening, your Guide helps you return to the same day with grace.",
    ]
  : [
      "Your path is ready...",
      "Your Guide helps you turn intention into direction.",
      "Your plan turns that direction into meaningful action.",
      "Your companion notices, responds, and carries the story forward.",
      "Reflection helps you learn from the day and build momentum.",
    ];

const LINE_DISPLAY_MS = 3000;
const FINAL_LINE_HOLD_MS = 3200;
const FINAL_BUTTON_DELAY_MS = 900;

export const JourneyBegins = ({ userName, companionAnimal, onComplete }: JourneyBeginsProps) => {
  const [currentLine, setCurrentLine] = useState(0);
  const [showFinalMessage, setShowFinalMessage] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const currentNarrativeLine = narrativeLines[currentLine];

  // Memoize particle positions to prevent them from jumping on re-render
  const particlePositions = useMemo(() => 
    [...Array(12)].map(() => ({
      left: `${10 + Math.random() * 80}%`,
      top: `${50 + Math.random() * 40}%`,
      duration: 5 + Math.random() * 3,
    })), []);

  useEffect(() => {
    if (showFinalMessage) {
      return;
    }

    if (currentLine < narrativeLines.length - 1) {
      const timer = setTimeout(() => {
        setCurrentLine(prev => prev + 1);
      }, LINE_DISPLAY_MS);
      return () => clearTimeout(timer);
    }

    const finalTimer = setTimeout(() => {
      setShowFinalMessage(true);
    }, FINAL_LINE_HOLD_MS);
    return () => clearTimeout(finalTimer);
  }, [currentLine, showFinalMessage]);

  useEffect(() => {
    if (showFinalMessage) {
      const buttonTimer = setTimeout(() => {
        setShowButton(true);
      }, FINAL_BUTTON_DELAY_MS);
      return () => clearTimeout(buttonTimer);
    }
  }, [showFinalMessage]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 pt-safe-top safe-area-bottom relative overflow-hidden">
      {/* Quiet dawn-like ambient glow */}
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
            {!showFinalMessage && currentNarrativeLine && (
              <motion.p
                key={currentLine}
                initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(2px)" }}
                transition={{ duration: 0.9 }}
                className="text-lg md:text-xl text-white/80 italic leading-relaxed"
              >
                {currentNarrativeLine}
              </motion.p>
            )}
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
                  <Sunrise className="h-4 w-4 text-primary" />
                  <span className="text-xs uppercase tracking-[0.4em] font-medium text-primary/80">
                    Your Daily Path Is Ready
                  </span>
                  <Sunrise className="h-4 w-4 text-primary" />
                </motion.div>
                
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-3xl md:text-4xl font-bold"
                >
                  <span className="bg-gradient-to-r from-white via-primary-foreground to-white bg-clip-text text-transparent">
                    {userName}
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-white/60 text-base"
                >
                  {PRODUCT.mode === "christian"
                    ? `Your ${companionAnimal} is a visual companion for the practices you complete. It reflects consistency—not God's love, favor, or approval, which cannot be earned.`
                    : `Your ${companionAnimal} is a living record of the actions, choices, and momentum you build.`}
                </motion.p>
                
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                  className="pt-2"
                >
                  <p className="text-white/70 text-lg">
                    {PRODUCT.mode === "christian"
                      ? "Guide, practice, companion, and reflection now move together."
                      : "Guide, plan, companion, and reflection now move together."}
                  </p>
                  <p className="text-white/50 text-sm mt-1">
                    Begin with what {PRODUCT.name} prepared for today. No perfect streak required.
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
                <ArrowRight className="h-5 w-5" />
                See Today
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating light motes */}
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
