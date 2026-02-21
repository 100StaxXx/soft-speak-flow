import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMotionProfile } from "@/hooks/useMotionProfile";

interface DestinyRevealProps {
  userName: string;
  onComplete: () => void;
}

const narrativeLines = [
  "For ages, the constellations have watched wanderers cross the dark.",
  "Only a rare few carry the spark to shape fate with intention.",
  "You are one of the marked.",
  "The universe has been waiting for your first step.",
];

const LINE_DISPLAY_MS = 2800;
const FINAL_MESSAGE_DELAY_MS = 900;
const FINAL_BUTTON_DELAY_MS = 1800;

export const DestinyReveal = ({ userName, onComplete }: DestinyRevealProps) => {
  const [currentLine, setCurrentLine] = useState(0);
  const [showFinalMessage, setShowFinalMessage] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const { capabilities, signals } = useMotionProfile();
  const prefersReducedMotion = signals.prefersReducedMotion;
  const shouldAnimateAmbient =
    capabilities.allowBackgroundAnimation && !signals.prefersReducedMotion && !signals.isBackgrounded;

  const particlePositions = useMemo(
    () =>
      [...Array(10)].map((_, index) => ({
        x: Math.random() * 360 - 180,
        y: Math.random() * 360 - 180,
        left: `${20 + Math.random() * 60}%`,
        top: `${22 + Math.random() * 58}%`,
        duration: 6 + Math.random() * 3,
        delay: index * 0.42 + Math.random() * 0.7,
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
    }, FINAL_MESSAGE_DELAY_MS);
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
      {/* Ambient halo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          className={`w-[520px] h-[520px] bg-primary/15 rounded-full blur-[120px] ${shouldAnimateAmbient ? "onb-animated onb-animate-halo-breathe" : ""}`}
          animate={
            shouldAnimateAmbient
              ? { scale: [1, 1.08, 1], opacity: [0.32, 0.56, 0.34] }
              : { scale: 1, opacity: 0.32 }
          }
          transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className={`absolute w-[420px] h-[420px] rounded-full bg-accent/12 blur-[100px] ${shouldAnimateAmbient ? "onb-animated onb-animate-halo-breathe" : ""}`}
          animate={
            shouldAnimateAmbient
              ? { scale: [1.05, 0.96, 1.05], opacity: [0.2, 0.4, 0.22] }
              : { scale: 1, opacity: 0.2 }
          }
          transition={{ duration: 7.4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
        />
      </div>

      {/* Floating particles */}
      {particlePositions.map((particle, index) => (
        <motion.div
          key={`destiny-particle-${index}`}
          className={`absolute onb-decorative-star ${shouldAnimateAmbient ? "onb-animated onb-animate-ornament-drift" : ""}`}
          initial={{ opacity: 0 }}
          animate={
            shouldAnimateAmbient
              ? {
                  y: [particle.y, particle.y - 22, particle.y],
                  x: [particle.x, particle.x + 8, particle.x],
                  opacity: [0, 0.72, 0.22],
                  scale: [0.9, 1.25, 0.92],
                }
              : { opacity: 0.58, scale: 1 }
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
        <div className="min-h-[260px] flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {!showFinalMessage && activeLine && (
              <motion.div
                key={`destiny-line-${currentLine}`}
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 20, filter: "blur(8px)", scale: 0.99 }
                }
                animate={
                  prefersReducedMotion
                    ? { opacity: 1 }
                    : { opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }
                }
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: -14, filter: "blur(6px)", scale: 0.995 }
                }
                transition={{ duration: prefersReducedMotion ? 0.24 : 0.72, ease: "easeOut" }}
                className={`onb-mystic-panel relative w-full max-w-xl px-8 py-10 ${shouldAnimateAmbient ? "onb-animated onb-animate-text-glint" : ""}`}
              >
                <div className="onb-decorative-arc absolute left-7 right-7 top-4 h-4" />
                <div className="onb-decorative-arc absolute left-7 right-7 bottom-4 h-4 rotate-180" />
                <div className="relative z-10 space-y-5">
                  <p className="onb-mystic-kicker">Destiny Chronicle</p>
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
                transition={{ duration: prefersReducedMotion ? 0.26 : 0.9, ease: "easeOut" }}
                className={`onb-mystic-panel relative mx-auto w-full max-w-xl px-8 py-10 ${shouldAnimateAmbient ? "onb-animated onb-animate-text-glint" : ""}`}
              >
                <div className="onb-decorative-arc absolute left-7 right-7 top-4 h-4" />
                <div className="onb-decorative-arc absolute left-7 right-7 bottom-4 h-4 rotate-180" />
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: prefersReducedMotion ? 0 : 0.2 }}
                  className="relative z-10 flex items-center justify-center gap-2"
                >
                  <Sparkles className="h-4 w-4 text-stardust-gold/85" />
                  <span className="onb-mystic-kicker">Your Path Awakens</span>
                  <Sparkles className="h-4 w-4 text-stardust-gold/85" />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: prefersReducedMotion ? 0 : 0.34 }}
                  className="relative z-10 mt-4 text-3xl md:text-4xl onb-mystic-heading"
                >
                  Welcome, <span className="onb-gilded-text">{userName}</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: prefersReducedMotion ? 0 : 0.52 }}
                  className="relative z-10 mt-4 text-[1.04rem] leading-relaxed text-white/76 md:text-lg"
                >
                  Every legend begins with a vow. Choose the faction that calls your spirit.
                </motion.p>

                <Star className="absolute left-5 top-6 h-3.5 w-3.5 text-stardust-gold/60" />
                <Star className="absolute right-5 bottom-6 h-3.5 w-3.5 text-stardust-gold/45" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showButton && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0.24 : 0.48 }}
            >
              <Button
                onClick={onComplete}
                size="lg"
                className="px-9 py-6 text-lg font-semibold bg-gradient-to-r from-primary/95 via-primary to-accent hover:brightness-110 shadow-glow"
              >
                Choose My Faction
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
