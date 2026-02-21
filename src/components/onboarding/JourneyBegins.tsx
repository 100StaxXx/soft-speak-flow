import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Star, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMotionProfile } from "@/hooks/useMotionProfile";

interface JourneyBeginsProps {
  userName: string;
  companionAnimal: string;
  onComplete: () => void;
}

const narrativeLines = [
  "A covenant now glows between your spirit and the cosmos.",
  "Your companion stirs, answering the light of your presence.",
  "Together, you will write a story even the stars will remember.",
  "Each quest fulfilled and each habit forged becomes living starlight.",
  "Step by step, your destinies braid into one radiant path.",
];

const LINE_DISPLAY_MS = 3000;
const FINAL_LINE_HOLD_MS = 2600;
const FINAL_BUTTON_DELAY_MS = 2200;

export const JourneyBegins = ({ userName, companionAnimal, onComplete }: JourneyBeginsProps) => {
  const [currentLine, setCurrentLine] = useState(0);
  const [showFinalMessage, setShowFinalMessage] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const { capabilities, signals } = useMotionProfile();
  const prefersReducedMotion = signals.prefersReducedMotion;
  const shouldAnimateAmbient =
    capabilities.allowBackgroundAnimation && !signals.prefersReducedMotion && !signals.isBackgrounded;

  const particlePositions = useMemo(
    () =>
      [...Array(14)].map(() => ({
        left: `${10 + Math.random() * 80}%`,
        top: `${18 + Math.random() * 74}%`,
        duration: 6 + Math.random() * 4,
        delay: Math.random() * 2.5,
      })),
    [],
  );

  useEffect(() => {
    if (currentLine < narrativeLines.length) {
      const timer = setTimeout(() => {
        setCurrentLine((prev) => prev + 1);
      }, LINE_DISPLAY_MS);
      return () => clearTimeout(timer);
    }
    const finalTimer = setTimeout(() => {
      setShowFinalMessage(true);
    }, FINAL_LINE_HOLD_MS);
    return () => clearTimeout(finalTimer);
  }, [currentLine]);

  useEffect(() => {
    if (showFinalMessage) {
      const buttonTimer = setTimeout(() => {
        setShowButton(true);
      }, FINAL_BUTTON_DELAY_MS);
      return () => clearTimeout(buttonTimer);
    }
  }, [showFinalMessage]);

  const activeLine = currentLine > 0 ? narrativeLines[currentLine - 1] : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 pt-safe-top safe-area-bottom relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          className={`w-[560px] h-[560px] rounded-full bg-primary/18 blur-[124px] ${shouldAnimateAmbient ? "onb-animated onb-animate-halo-breathe" : ""}`}
          animate={
            shouldAnimateAmbient
              ? { scale: [1, 1.1, 1], opacity: [0.33, 0.56, 0.36] }
              : { scale: 1, opacity: 0.33 }
          }
          transition={{ duration: 6.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className={`absolute w-[440px] h-[440px] rounded-full bg-stardust-gold/12 blur-[110px] ${shouldAnimateAmbient ? "onb-animated onb-animate-halo-breathe" : ""}`}
          animate={
            shouldAnimateAmbient
              ? { scale: [1.08, 0.95, 1.08], opacity: [0.18, 0.36, 0.22] }
              : { scale: 1, opacity: 0.2 }
          }
          transition={{ duration: 8.1, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
        />
      </div>

      {/* Floating stardust */}
      {particlePositions.map((particle, index) => (
        <motion.div
          key={`journey-particle-${index}`}
          className={`absolute onb-decorative-star ${shouldAnimateAmbient ? "onb-animated onb-animate-ornament-drift" : ""}`}
          initial={{ opacity: 0 }}
          animate={
            shouldAnimateAmbient
              ? {
                  y: [0, -24, 0],
                  opacity: [0, 0.82, 0.24],
                  scale: [0.86, 1.26, 0.92],
                }
              : { opacity: 0.6, scale: 1 }
          }
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeInOut",
          }}
          style={{
            left: particle.left,
            top: particle.top,
          }}
        />
      ))}

      <div className="relative z-10 w-full max-w-2xl text-center space-y-9">
        <div className="min-h-[290px] flex flex-col items-center justify-center space-y-6">
          <AnimatePresence mode="wait">
            {!showFinalMessage && activeLine && (
              <motion.div
                key={`journey-line-${currentLine}`}
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 20, filter: "blur(8px)", scale: 0.992 }
                }
                animate={
                  prefersReducedMotion
                    ? { opacity: 1 }
                    : { opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }
                }
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: -16, filter: "blur(6px)", scale: 0.996 }
                }
                transition={{ duration: prefersReducedMotion ? 0.24 : 0.74, ease: "easeOut" }}
                className={`onb-mystic-panel relative w-full max-w-xl px-8 py-10 ${shouldAnimateAmbient ? "onb-animated onb-animate-text-glint" : ""}`}
              >
                <div className="onb-decorative-arc absolute left-7 right-7 top-4 h-4" />
                <div className="onb-decorative-arc absolute left-7 right-7 bottom-4 h-4 rotate-180" />
                <div className="relative z-10 space-y-5">
                  <p className="onb-mystic-kicker">Celestial Oath</p>
                  <p className="onb-mystic-line text-xl md:text-2xl font-medium">{activeLine}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showFinalMessage && (
              <motion.div
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.92, y: 12, filter: "blur(8px)" }
                }
                animate={
                  prefersReducedMotion
                    ? { opacity: 1 }
                    : { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }
                }
                transition={{ duration: prefersReducedMotion ? 0.28 : 1, ease: "easeOut" }}
                className={`onb-mystic-panel relative w-full max-w-xl px-8 py-10 ${shouldAnimateAmbient ? "onb-animated onb-animate-text-glint" : ""}`}
              >
                <div className="onb-decorative-arc absolute left-7 right-7 top-4 h-4" />
                <div className="onb-decorative-arc absolute left-7 right-7 bottom-4 h-4 rotate-180" />
                <motion.div
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: prefersReducedMotion ? 0 : 0.2 }}
                  className="relative z-10 flex items-center justify-center gap-3"
                >
                  <Star className="h-4 w-4 text-stardust-gold/85" />
                  <span className="onb-mystic-kicker">Your Journey Awaits</span>
                  <Star className="h-4 w-4 text-stardust-gold/85" />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: prefersReducedMotion ? 0 : 0.4 }}
                  className="relative z-10 mt-4 text-3xl md:text-4xl onb-mystic-heading"
                >
                  <span className="onb-gilded-text">
                    {userName} & {companionAnimal}
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: prefersReducedMotion ? 0 : 0.6 }}
                  className="relative z-10 mt-4 text-base text-white/72 md:text-lg"
                >
                  Bound by wonder, guided by purpose.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: prefersReducedMotion ? 0 : 0.86 }}
                  className="relative z-10 pt-2"
                >
                  <p className="text-white/78 text-lg">
                    The cosmos is listening.
                  </p>
                  <p className="text-white/58 text-sm mt-1">
                    Your first quest awaits.
                  </p>
                </motion.div>

                <Sparkles className="absolute left-6 top-6 h-4 w-4 text-stardust-gold/50" />
                <Sparkles className="absolute right-6 bottom-6 h-4 w-4 text-stardust-gold/45" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showButton && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0.24 : 0.54 }}
            >
              <Button
                onClick={onComplete}
                variant="cta"
                size="lg"
                className="px-10 py-6 text-lg gap-2 shadow-glow"
              >
                <Rocket className="h-5 w-5" />
                Begin My Journey
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
