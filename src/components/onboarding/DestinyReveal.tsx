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
  "The hall has welcomed countless travelers before you...",
  "But only a few arrive carrying a story bright enough to wake the hatchery.",
  "You are one of them.",
  "The chamber has been waiting for your name.",
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
      accent="34 92% 70%"
      hero={
        <div className="onb-stage-emblem">
          <Sparkles className="h-10 w-10 text-[#ffe2a3]" />
        </div>
      }
      eyebrow="Opening Overture"
      title="The Hall Has Been Waiting"
      description="The lamps brighten, the banners rise, and the next chamber opens only after you hear the oath being offered to you."
      bodyClassName="mx-auto w-full max-w-3xl"
    >
      <div className="relative overflow-hidden rounded-[2rem] onb-stage-panel px-6 py-8 sm:px-8 sm:py-10">
        {particlePositions.map((particle, i) => (
          <motion.div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-white/60"
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
                    className="font-cinzel text-lg italic leading-relaxed text-[#fff4df]/82 md:text-2xl"
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
                className="mx-auto max-w-2xl space-y-5 rounded-[1.75rem] border border-[#f3cd84]/16 bg-[linear-gradient(180deg,rgba(63,34,20,0.72),rgba(28,14,11,0.92))] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl"
              >
                <div className="flex items-center justify-center gap-3 text-[#f4d39b]/78">
                  <Sparkles className="h-4 w-4 text-[#ffe2a3]" />
                  <span className="text-xs uppercase tracking-[0.36em]">Your Path Awaits</span>
                  <Sparkles className="h-4 w-4 text-[#ffe2a3]" />
                </div>

                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="font-cinzel text-3xl font-semibold text-[#fff4df] md:text-4xl"
                >
                  Welcome, <span className="text-[#ffe8b6]">{userName}</span>
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.38 }}
                  className="text-base leading-7 text-[#f7ead6]/72 md:text-lg"
                >
                  Every legend opens with an oath. Choose your faction and let the first act of
                  your story take the stage.
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
