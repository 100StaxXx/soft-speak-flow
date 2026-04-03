import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Star, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingStageShell } from "./OnboardingStageShell";

interface JourneyBeginsProps {
  userName: string;
  companionAnimal: string;
  eggElementLabel?: string;
  onComplete: () => void;
}

const narrativeLines = [
  "A bond has been forged across the cosmos...",
  "Your egg stirs, answering your presence from within the shell.",
  "Together, you will write a story the stars themselves will remember.",
  "Every quest completed, every habit built, every moment of growth...",
  "...will shape both your destinies.",
];

const LINE_DISPLAY_MS = 3400;
const FINAL_LINE_HOLD_MS = LINE_DISPLAY_MS;
const FINAL_BUTTON_DELAY_MS = 3200;

export const JourneyBegins = ({
  userName,
  companionAnimal,
  eggElementLabel,
  onComplete,
}: JourneyBeginsProps) => {
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
      }, LINE_DISPLAY_MS);
      return () => clearTimeout(timer);
    } else {
      const finalTimer = setTimeout(() => {
        setShowFinalMessage(true);
      }, FINAL_LINE_HOLD_MS);
      return () => clearTimeout(finalTimer);
    }
  }, [currentLine]);

  useEffect(() => {
    if (showFinalMessage) {
      const buttonTimer = setTimeout(() => {
        setShowButton(true);
      }, FINAL_BUTTON_DELAY_MS);
      return () => clearTimeout(buttonTimer);
    }
  }, [showFinalMessage]);

  return (
    <OnboardingStageShell
      width="lg"
      accent="268 94% 72%"
      hero={
        <div className="onb-stage-emblem">
          <Sparkles className="h-10 w-10 text-white" />
        </div>
      }
      eyebrow="Bond Forged"
      title="The First Chapter Begins"
      description="Your guide has found you, your companion has answered, and the first chapter of your journey is about to open."
      bodyClassName="mx-auto w-full max-w-4xl"
    >
      {particlePositions.map((particle, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute h-1 w-1 rounded-full bg-white/50"
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

      <div className="relative overflow-hidden rounded-[2rem] onb-stage-panel px-6 py-8 sm:px-8 sm:py-10">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={`orbit-${i}`}
            className="pointer-events-none absolute left-1/2 top-1/2"
            animate={{ rotate: 360 }}
            transition={{
              duration: 15 + i * 5,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <Sparkles
              className="text-white/25"
              size={12 + i * 4}
              style={{
                transform: `translate(${80 + i * 40}px, 0)`,
              }}
            />
          </motion.div>
        ))}

        <div className="relative z-10 space-y-10 text-center">
          <div className="min-h-[240px] space-y-6">
            <AnimatePresence mode="wait">
              {!showFinalMessage && narrativeLines.map((line, index) => (
                index === currentLine - 1 && (
                  <motion.p
                    key={index}
                    initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -10, filter: "blur(2px)" }}
                    transition={{ duration: 0.9 }}
                  className="mx-auto max-w-3xl text-lg italic leading-relaxed text-white/82 md:text-2xl"
                >
                  {line}
                </motion.p>
              )
            ))}
            </AnimatePresence>

            <AnimatePresence>
              {showFinalMessage && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 1.05, ease: "easeOut" }}
                className="mx-auto max-w-3xl space-y-6 rounded-[1.85rem] border border-white/10 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl"
              >
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center justify-center gap-3"
                  >
                    <Star className="h-4 w-4 text-primary" />
                    <span className="text-xs uppercase tracking-[0.4em] text-primary/80">
                      Your Journey Awaits
                    </span>
                    <Star className="h-4 w-4 text-primary" />
                  </motion.div>

                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="text-3xl font-semibold text-white md:text-5xl"
                  >
                    {userName} &amp; {companionAnimal}
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="mx-auto max-w-2xl text-base leading-7 text-white/70 md:text-lg"
                  >
                    {eggElementLabel
                      ? `An unbreakable bond now rests inside a ${eggElementLabel.toLowerCase()} shell, carrying the spirit of your ${companionAnimal.toLowerCase()} into its first chapter.`
                      : "An unbreakable bond has been sealed, and the way forward is open."}
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.95 }}
                    className="space-y-1"
                  >
                  <p className="text-lg text-white/78">The cosmos holds infinite possibility.</p>
                  <p className="text-sm uppercase tracking-[0.26em] text-white/46">
                    Your first quest awaits...
                  </p>
                </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showButton && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Button
                  onClick={onComplete}
                  size="lg"
                  className="onb-stage-cta h-14 rounded-full px-10 text-base"
                >
                  <Rocket className="h-5 w-5" />
                  Begin My Journey
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </OnboardingStageShell>
  );
};
