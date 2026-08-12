import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COMPANION_STORY_TONES,
  type CompanionStoryTone,
} from "@/config/companionCatalog";

interface EggSelectionPreludeProps {
  storyTone: CompanionStoryTone;
  speciesName: string;
  onComplete: () => void;
  onBack?: () => void;
}

const PRELUDE_LINES = [
  "Your Path has given today a direction...",
  "Now choose a symbol to grow alongside your practice.",
  "Your companion will make steady progress visible, one day at a time.",
] as const;

const TONE_PRELUDE_COPY: Record<CompanionStoryTone, string> = {
  soft_gentle: "A gentle presence can remind you to meet each day with patience.",
  epic_adventure: "A brave presence can remind you to take the next faithful step.",
  emotional_heartfelt: "A heartfelt presence can remind you to grow with honesty and compassion.",
  dark_intense: "A resolute presence can remind you that difficult seasons do not define you.",
  whimsical_playful: "A playful presence can remind you to notice joy along the way.",
};

export const EggSelectionPrelude = ({
  storyTone,
  speciesName,
  onComplete,
  onBack,
}: EggSelectionPreludeProps) => {
  const [currentLine, setCurrentLine] = useState(0);
  const [showFinalMessage, setShowFinalMessage] = useState(false);
  const [showButton, setShowButton] = useState(false);

  const storyToneMeta = useMemo(
    () => COMPANION_STORY_TONES.find((tone) => tone.value === storyTone) ?? COMPANION_STORY_TONES[0],
    [storyTone],
  );

  const particlePositions = useMemo(
    () =>
      [...Array(8)].map(() => ({
        x: Math.random() * 360 - 180,
        y: Math.random() * 320 - 160,
        left: `${18 + Math.random() * 64}%`,
        top: `${24 + Math.random() * 48}%`,
        duration: 4 + Math.random() * 2.5,
      })),
    [],
  );

  useEffect(() => {
    if (currentLine < PRELUDE_LINES.length) {
      const timer = setTimeout(() => {
        setCurrentLine((value) => value + 1);
      }, 2200);
      return () => clearTimeout(timer);
    }

    const finalTimer = setTimeout(() => {
      setShowFinalMessage(true);
    }, 800);

    return () => clearTimeout(finalTimer);
  }, [currentLine]);

  useEffect(() => {
    if (!showFinalMessage) return;

    const buttonTimer = setTimeout(() => {
      setShowButton(true);
    }, 1500);

    return () => clearTimeout(buttonTimer);
  }, [showFinalMessage]);

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-6 pt-safe-top pb-safe-bottom">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="h-[460px] w-[460px] rounded-full bg-amber-300/10 blur-[120px]" />
      </div>

      {onBack ? (
        <div className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-20">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            className="rounded-full border border-white/10 bg-white/5 px-4 text-white/[0.82] hover:bg-white/10"
          >
            Back
          </Button>
        </div>
      ) : null}

      <div className="relative z-10 max-w-xl text-center space-y-8">
        <div className="min-h-[220px] flex flex-col items-center justify-center space-y-6">
          <AnimatePresence mode="wait">
            {PRELUDE_LINES.map((line, index) =>
              index === currentLine - 1 ? (
                <motion.p
                  key={line}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.8 }}
                  className="text-lg md:text-xl italic leading-relaxed text-white/[0.78]"
                >
                  {line}
                </motion.p>
              ) : null,
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showFinalMessage ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="space-y-4"
              >
                <div className="flex items-center justify-center gap-2 text-amber-200">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-xs font-medium uppercase tracking-[0.34em]">A Living Reminder</span>
                  <Sparkles className="h-5 w-5" />
                </div>

                <h1 className="text-3xl font-semibold text-white md:text-4xl">
                  Choose Your Companion
                </h1>

                <p className="text-base leading-7 text-white/[0.74] md:text-lg">
                  {TONE_PRELUDE_COPY[storyTone]} Your <span className="font-semibold text-white">{speciesName}</span>{" "}
                  will change as your daily practices become consistent. Its personality is{" "}
                  <span className="font-semibold text-white">{storyToneMeta.label}</span>.
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showButton ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-3"
            >
              <Button
                type="button"
                size="lg"
                onClick={onComplete}
                className="px-10 py-6 text-lg"
              >
                Choose My Companion
              </Button>
              <p className="text-sm text-white/[0.48]">
                Form, color, and name come next. You can make it feel like yours.
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {particlePositions.map((particle, index) => (
        <motion.div
          key={index}
          className="absolute h-1 w-1 rounded-full bg-amber-200/50"
          initial={{ x: particle.x, y: particle.y, opacity: 0 }}
          animate={{ y: [null, -100], opacity: [0, 0.8, 0] }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: index * 0.55,
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
