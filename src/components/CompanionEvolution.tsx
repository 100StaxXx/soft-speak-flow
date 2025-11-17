import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { haptics } from "@/utils/haptics";
import { Sparkles, Zap, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playEvolutionStart, playEvolutionSuccess, playSparkle } from "@/utils/soundEffects";

interface CompanionEvolutionProps {
  isEvolving: boolean;
  newStage: number;
  newImageUrl: string;
  mentorSlug?: string;
  userId?: string;
  onComplete: () => void;
}

export const CompanionEvolution = ({ 
  isEvolving, 
  newStage, 
  newImageUrl,
  mentorSlug,
  userId,
  onComplete 
}: CompanionEvolutionProps) => {
  const [stage, setStage] = useState(0);
  const [voiceLine, setVoiceLine] = useState<string>("");
  const [isLoadingVoice, setIsLoadingVoice] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isEvolving) return;

    // Play evolution start sound
    playEvolutionStart();

    // Generate AI voice line
    const generateVoice = async () => {
      if (!mentorSlug || !userId) {
        setIsLoadingVoice(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('generate-evolution-voice', {
          body: { mentorSlug, newStage, userId }
        });

        if (error) throw error;

        if (data?.voiceLine) {
          setVoiceLine(data.voiceLine);
        }

        if (data?.audioContent) {
          const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
          audioRef.current = audio;
        }

        setIsLoadingVoice(false);
      } catch (error) {
        console.error('Failed to generate evolution voice:', error);
        setIsLoadingVoice(false);
      }
    };

    generateVoice();

    const timers = [
      setTimeout(() => {
        setStage(1);
        haptics.medium();
        playSparkle();
        // First wave of confetti
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7, x: 0.3 },
          colors: ['#A76CFF', '#C084FC', '#E879F9'],
        });
      }, 500),
      setTimeout(() => {
        setStage(2);
        haptics.heavy();
        playSparkle();
        // Play voice if available
        if (audioRef.current && !isLoadingVoice) {
          audioRef.current.play().catch(err => console.error('Audio play failed:', err));
        }
        // MASSIVE confetti burst
        confetti({
          particleCount: 200,
          spread: 120,
          origin: { y: 0.6 },
          colors: ['#A76CFF', '#C084FC', '#E879F9', '#FFD700', '#FFA500'],
          ticks: 500,
          gravity: 0.6,
          scalar: 1.8,
        });
        // Side bursts
        setTimeout(() => {
          confetti({
            particleCount: 100,
            spread: 80,
            origin: { y: 0.7, x: 0.2 },
            colors: ['#A76CFF', '#E879F9'],
          });
          confetti({
            particleCount: 100,
            spread: 80,
            origin: { y: 0.7, x: 0.8 },
            colors: ['#C084FC', '#FFD700'],
          });
        }, 200);
      }, 1500),
      setTimeout(() => {
        setStage(3);
        haptics.success();
        playEvolutionSuccess();
        // Third massive burst
        confetti({
          particleCount: 250,
          spread: 140,
          origin: { y: 0.5 },
          colors: ['#A76CFF', '#C084FC', '#E879F9', '#FFD700', '#FFA500'],
          ticks: 600,
          gravity: 0.5,
          scalar: 2,
        });
      }, 2500),
      setTimeout(() => {
        setStage(4);
        // Final sparkle burst
        confetti({
          particleCount: 50,
          spread: 50,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FFA500'],
          shapes: ['star'],
          scalar: 1.2,
        });
      }, 3500),
      setTimeout(() => {
        setStage(0);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        onComplete();
      }, 5500),
    ];

    return () => {
      timers.forEach(clearTimeout);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isEvolving, isLoadingVoice, onComplete]);

  if (!isEvolving) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-gradient-to-br from-background via-primary/20 to-background backdrop-blur-md flex items-center justify-center overflow-hidden"
      >
        {/* Animated background glow */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/20 to-primary/20"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Particle effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-primary/60 rounded-full"
              initial={{
                x: Math.random() * window.innerWidth,
                y: window.innerHeight + 50,
              }}
              animate={{
                y: -50,
                x: Math.random() * window.innerWidth,
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        <div className="flex flex-col items-center gap-8 max-w-md text-center px-6 relative z-10">
          {stage >= 1 && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="relative"
            >
              <Sparkles className="absolute -top-6 -left-6 w-8 h-8 text-primary animate-pulse" />
              <Sparkles className="absolute -top-6 -right-6 w-8 h-8 text-accent animate-pulse" />
              <Zap className="absolute -bottom-6 -left-6 w-8 h-8 text-primary animate-pulse" />
              <Zap className="absolute -bottom-6 -right-6 w-8 h-8 text-accent animate-pulse" />
              
              <motion.div
                className="w-40 h-40 rounded-2xl overflow-hidden border-4 border-primary shadow-2xl"
                animate={{
                  boxShadow: [
                    "0 0 20px rgba(var(--primary), 0.5)",
                    "0 0 60px rgba(var(--primary), 0.8)",
                    "0 0 20px rgba(var(--primary), 0.5)",
                  ],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                }}
              >
                {stage >= 2 && (
                  <motion.img
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    src={newImageUrl}
                    alt="Evolved companion"
                    className="w-full h-full object-cover"
                  />
                )}
              </motion.div>
            </motion.div>
          )}

          {stage >= 3 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <motion.h1
                className="text-5xl font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent"
                animate={{
                  backgroundPosition: ["0%", "100%", "0%"],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                }}
                style={{
                  backgroundSize: "200% 200%",
                }}
              >
                EVOLUTION!
              </motion.h1>
              <p className="text-2xl font-bold text-foreground">
                Your companion evolved to Stage {newStage}!
              </p>
            </motion.div>
          )}

          {stage >= 4 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-lg text-muted-foreground"
            >
              Your journey continues...
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
