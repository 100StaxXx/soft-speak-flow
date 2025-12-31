import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Repeat, CheckCircle2 } from "lucide-react";
import Confetti from "react-confetti";

interface CampaignCreatedAnimationProps {
  isVisible: boolean;
  campaignTitle: string;
  habits: Array<{ title: string }>;
  onComplete: () => void;
}

export function CampaignCreatedAnimation({
  isVisible,
  campaignTitle,
  habits,
  onComplete,
}: CampaignCreatedAnimationProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [phase, setPhase] = useState<'title' | 'habits' | 'flyout'>('title');

  useEffect(() => {
    if (!isVisible) {
      setPhase('title');
      setShowConfetti(false);
      return;
    }

    // Phase timing
    const titleTimer = setTimeout(() => setPhase('habits'), 800);
    const confettiTimer = setTimeout(() => setShowConfetti(true), 1200);
    const flyoutTimer = setTimeout(() => setPhase('flyout'), 2500 + habits.length * 200);
    const completeTimer = setTimeout(onComplete, 3500 + habits.length * 200);

    return () => {
      clearTimeout(titleTimer);
      clearTimeout(confettiTimer);
      clearTimeout(flyoutTimer);
      clearTimeout(completeTimer);
    };
  }, [isVisible, habits.length, onComplete]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm"
        onClick={onComplete}
      >
        {/* Confetti */}
        {showConfetti && (
          <Confetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={false}
            numberOfPieces={150}
            gravity={0.3}
            colors={['#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']}
          />
        )}

        {/* Animated background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary/20 blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-6 px-6 max-w-md mx-auto">
          {/* Campaign Title */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 12, stiffness: 200 }}
            className="text-center"
          >
            <motion.div
              className="flex items-center justify-center gap-2 mb-2"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Sparkles className="w-6 h-6 text-stardust-gold" />
              <span className="text-sm font-medium text-stardust-gold uppercase tracking-wider">
                Campaign Created!
              </span>
              <Sparkles className="w-6 h-6 text-stardust-gold" />
            </motion.div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary via-purple-500 to-accent bg-clip-text text-transparent">
              {campaignTitle}
            </h2>
          </motion.div>

          {/* Habits List */}
          <AnimatePresence>
            {phase !== 'title' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full space-y-2"
              >
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-sm text-muted-foreground mb-3"
                >
                  Cosmiq Rituals added to Today's Agenda
                </motion.p>

                {habits.map((habit, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -30, scale: 0.9 }}
                    animate={
                      phase === 'flyout'
                        ? {
                            opacity: 0,
                            x: -100,
                            y: 200,
                            scale: 0.5,
                            transition: { delay: index * 0.1, duration: 0.4 },
                          }
                        : {
                            opacity: 1,
                            x: 0,
                            scale: 1,
                            transition: { delay: index * 0.15, type: "spring", damping: 15 },
                          }
                    }
                    className="flex items-center gap-3 p-3 rounded-xl bg-card/80 border border-accent/30 backdrop-blur-sm"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                      <Repeat className="w-4 h-4 text-accent" />
                    </div>
                    <span className="flex-1 text-sm font-medium truncate">
                      {habit.title}
                    </span>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: index * 0.15 + 0.3, type: "spring" }}
                    >
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    </motion.div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Badge count */}
          {phase === 'habits' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: habits.length * 0.15 + 0.3 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 border border-accent/40"
            >
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-accent">
                {habits.length} Cosmiq Ritual{habits.length !== 1 ? 's' : ''} Ready
              </span>
            </motion.div>
          )}

          {/* Tap to dismiss hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 2 }}
            className="text-xs text-muted-foreground"
          >
            Tap anywhere to continue
          </motion.p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
