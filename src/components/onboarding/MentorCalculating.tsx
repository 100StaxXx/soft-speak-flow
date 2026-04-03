import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { OnboardingStageShell } from "./OnboardingStageShell";

const LOADING_MESSAGES = [
  "Reading the oath-scrolls...",
  "Listening for your best guide...",
  "Matching your answers to the right voice...",
  "Opening the chamber of guides...",
  "Preparing your introduction...",
];

export const MentorCalculating = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <OnboardingStageShell
      width="sm"
      accent="38 88% 70%"
      eyebrow="Guide Alignment"
      title="Reading The Ledger"
      description="We&apos;re comparing your answers against the voice, discipline, and energy of every guide in the chamber."
      bodyClassName="mx-auto w-full max-w-2xl"
    >
      <div className="onb-stage-panel p-8 text-center sm:p-10">
        <div className="relative mx-auto mb-8 h-48 w-48">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-2 w-2 rounded-full bg-white/80"
              style={{
                top: "50%",
                left: "50%",
              }}
              animate={{
                x: Math.cos((i * Math.PI * 2) / 8) * 80,
                y: Math.sin((i * Math.PI * 2) / 8) * 80,
                scale: [1, 1.5, 1],
                opacity: [0.35, 1, 0.35],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
            />
          ))}

          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="onb-stage-emblem h-24 w-24">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-10 w-10 text-[#ffe2a3]" />
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            className="absolute inset-0 rounded-full border border-[#f3cd84]/18"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-4 rounded-full border border-[#f3cd84]/10"
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
        </div>

        <motion.p
          key={messageIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="font-cinzel text-xl text-[#fff4df]/84"
        >
          {LOADING_MESSAGES[messageIndex]}
        </motion.p>

        <div className="mt-6 flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-2 w-2 rounded-full bg-white/65"
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.35, 1, 0.35],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </div>
    </OnboardingStageShell>
  );
};
