import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingStageShell } from "./OnboardingStageShell";

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
    <OnboardingStageShell
      width="md"
      accent="264 88% 72%"
      hero={
        <div className="onb-stage-emblem">
          <Sparkles className="h-10 w-10 text-white" />
        </div>
      }
      eyebrow="Destiny Reveal"
      title="The Stars Have Been Waiting"
      description="Take in the moment. Your path is about to open, and your first choice is waiting just beyond this breath."
      bodyClassName="mx-auto w-full max-w-3xl"
    >
      <div className="relative overflow-hidden rounded-[2rem] onb-stage-panel px-6 py-8 sm:px-8 sm:py-10">
        {particlePositions.map((particle, i) => (
          <motion.div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-primary/70"
            initial={{
              x: particle.x,
              y: particle.y,
              opacity: 0,
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

        <div className="relative z-10 min-h-[260px] space-y-8 text-center">
          <div className="min-h-[128px]">
            <AnimatePresence mode="wait">
              {narrativeLines.map((line, index) => (
                index === currentLine - 1 && index < narrativeLines.length && (
                  <motion.p
                    key={index}
                    initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
                    transition={{ duration: 0.8 }}
                    className="text-lg italic leading-relaxed text-white/82 md:text-2xl"
                  >
                    {line}
                  </motion.p>
                )
              ))}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showFinalMessage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="mx-auto max-w-2xl space-y-5 rounded-[1.75rem] border border-white/10 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl"
              >
                <div className="flex items-center justify-center gap-3 text-primary/80">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-xs uppercase tracking-[0.36em]">Your Path Awaits</span>
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>

                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-3xl font-semibold text-white md:text-4xl"
                >
                  Welcome, <span className="text-primary">{userName}</span>
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.38 }}
                  className="text-base leading-7 text-white/72 md:text-lg"
                >
                  Every legend begins with a choice. Choose your faction and let your story begin.
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showButton && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
              >
                <Button
                  onClick={onComplete}
                  size="lg"
                  className="onb-stage-cta h-14 rounded-full px-8 text-base"
                >
                  Choose My Faction
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </OnboardingStageShell>
  );
};
