import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { haptics } from "@/utils/haptics";
import { Sparkles, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playEvolutionStart, playEvolutionSuccess, playSparkle } from "@/utils/soundEffects";
import { pauseAmbientForEvent, resumeAmbientAfterEvent } from "@/utils/ambientMusic";

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

    // Pause ambient music for evolution
    pauseAmbientForEvent();

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
          scalar: 1.8,
        });
      }, 3000),
      setTimeout(() => {
        setStage(4);
      }, 3500),
      setTimeout(() => {
        window.dispatchEvent(new Event('evolution-complete'));
        onComplete();
        resumeAmbientAfterEvent();
      }, 6000)
    ];

    return () => {
      timers.forEach(timer => clearTimeout(timer));
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      // Make sure to resume ambient if component unmounts
      resumeAmbientAfterEvent();
    };
  }, [isEvolving, isLoadingVoice, onComplete]);

  if (!isEvolving) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center overflow-hidden px-4"
        style={{ pointerEvents: 'auto', touchAction: 'none' }}
      >
        {/* Centered evolution card */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="relative bg-card border-4 border-primary rounded-2xl p-8 max-w-md w-full shadow-2xl"
          style={{
            boxShadow: "0 0 60px rgba(167, 108, 255, 0.6), 0 0 120px rgba(192, 132, 252, 0.4)"
          }}
        >
          {/* Sparkle decorations */}
          <div className="absolute -top-6 -right-6">
            <Sparkles className="w-12 h-12 text-primary animate-pulse" 
              style={{ filter: "drop-shadow(0 0 10px currentColor)" }} />
          </div>
          <div className="absolute -top-6 -left-6">
            <Sparkles className="w-12 h-12 text-accent animate-pulse" 
              style={{ filter: "drop-shadow(0 0 10px currentColor)" }} />
          </div>
          
          <div className="flex flex-col items-center gap-6 text-center">
            {stage >= 1 && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 150, damping: 12 }}
                className="relative"
              >
                <motion.div
                  className="w-48 h-48 rounded-2xl overflow-hidden border-4 border-primary shadow-xl"
                  animate={{
                    boxShadow: [
                      "0 0 20px rgba(167, 108, 255, 0.6)",
                      "0 0 40px rgba(167, 108, 255, 1)",
                      "0 0 20px rgba(167, 108, 255, 0.6)",
                    ],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                  }}
                >
                  {stage >= 2 && (
                    <motion.img
                      initial={{ scale: 0.3, opacity: 0, rotate: -20 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      transition={{ 
                        delay: 0.3,
                        type: "spring",
                        stiffness: 200,
                        damping: 15
                      }}
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
                transition={{ type: "spring", stiffness: 150, damping: 15 }}
                className="space-y-4"
              >
                <motion.h1
                  className="text-4xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary"
                  animate={{
                    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  style={{
                    backgroundSize: "200% 200%",
                  }}
                >
                  Evolution!
                </motion.h1>
                
                <motion.p
                  className="text-xl font-bold text-foreground"
                  animate={{
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                  }}
                >
                  Your Companion is Evolving!
                </motion.p>

                {stage >= 4 && voiceLine && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mt-4"
                  >
                    <div className="relative p-4 rounded-xl bg-muted/50 border border-primary/30"
                      style={{
                        boxShadow: "0 0 20px rgba(167, 108, 255, 0.2)"
                      }}
                    >
                      <p className="text-sm text-muted-foreground italic leading-relaxed">
                        "{voiceLine}"
                      </p>
                      {audioRef.current && (
                        <button
                          onClick={() => audioRef.current?.play()}
                          className="absolute top-2 right-2 p-1 rounded-full bg-primary/20 hover:bg-primary/30 transition-colors"
                        >
                          <Volume2 className="w-4 h-4 text-primary" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
