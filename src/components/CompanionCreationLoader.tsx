import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Sparkles } from "lucide-react";

const CREATION_MESSAGES = [
  "Preparing the summoning ritual...",
  "Weaving magical essence...",
  "Shaping elemental energy...",
  "Your companion is taking form...",
  "Adding final touches...",
  "Almost there...",
];

const CREATION_TIPS = [
  "Each companion is uniquely crafted for you",
  "Your choices shape their appearance and personality",
  "They'll grow and evolve as you complete quests",
];

const PROGRESS_UPDATE_INTERVAL_MS = 1_000;
const LONG_WAIT_THRESHOLD_MS = 90_000;
const INITIAL_PROGRESS = 3;
const FINAL_PROGRESS_CAP = 99;
const POST_120_SECONDS_PROGRESS_PER_SECOND = 0.08;

const lerp = (start: number, end: number, ratio: number): number =>
  start + ((end - start) * ratio);

export const getCompanionCreationProgress = (elapsedMs: number): number => {
  const elapsedSeconds = Math.max(0, elapsedMs / 1000);

  if (elapsedSeconds <= 30) {
    return lerp(INITIAL_PROGRESS, 32, elapsedSeconds / 30);
  }

  if (elapsedSeconds <= 60) {
    return lerp(32, 50, (elapsedSeconds - 30) / 30);
  }

  if (elapsedSeconds <= 90) {
    return lerp(50, 64, (elapsedSeconds - 60) / 30);
  }

  if (elapsedSeconds <= 120) {
    return lerp(64, 74, (elapsedSeconds - 90) / 30);
  }

  const post120Progress =
    74 + ((elapsedSeconds - 120) * POST_120_SECONDS_PROGRESS_PER_SECOND);
  return Math.min(post120Progress, FINAL_PROGRESS_CAP);
};

/**
 * Full-screen loading experience for companion creation
 * Shows animated progress and rotating messages to keep users engaged
 */
export const CompanionCreationLoader = () => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const startTimeRef = useRef(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [progress, setProgress] = useState(INITIAL_PROGRESS);
  const takingLongerThanExpected = elapsedMs >= LONG_WAIT_THRESHOLD_MS;

  // Cycle messages every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % CREATION_MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Cycle tips every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % CREATION_TIPS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Simulate progress over time (visual comfort only)
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setElapsedMs(elapsed);
      setProgress((prev) => Math.max(prev, getCompanionCreationProgress(elapsed)));
    }, PROGRESS_UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-background flex items-center justify-center px-4 pt-safe pb-safe"
    >
      <div className="max-w-md w-full text-center space-y-8">
        {/* Cosmic pulse animation */}
        <motion.div
          className="relative mx-auto w-24 h-24"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Outer ring */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary/30"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          {/* Middle ring */}
          <motion.div
            className="absolute inset-3 rounded-full border-2 border-primary/50"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 2.5,
              delay: 0.3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          {/* Inner core */}
          <motion.div
            className="absolute inset-6 rounded-full bg-gradient-to-br from-primary to-purple-500"
            animate={{
              scale: [1, 1.15, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          {/* Sparkle overlay */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="w-6 h-6 text-primary-foreground absolute top-0" />
          </motion.div>
        </motion.div>

        {/* Rotating message */}
        <div className="space-y-2">
          <motion.p
            key={messageIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-lg font-medium text-foreground"
          >
            {CREATION_MESSAGES[messageIndex]}
          </motion.p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2 px-4">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
        </div>

        {/* Time expectation */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Your companion is being brought to life.
          </p>
          <p className="text-sm text-muted-foreground">
            Usually ready within 30-90 seconds.
          </p>
          {takingLongerThanExpected && (
            <p className="text-sm text-muted-foreground">
              Taking longer than expected. We&apos;re still working on it.
            </p>
          )}
        </div>

        <motion.div
          key={tipIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 bg-muted/30 rounded-xl border border-border/50"
        >
          <p className="text-sm text-muted-foreground">
            <span className="text-primary">💡</span> {CREATION_TIPS[tipIndex]}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};
