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
        className="fixed inset-0 z-[9999] bg-gradient-to-br from-black via-primary/30 to-black flex items-center justify-center overflow-hidden"
      >
        {/* Intense animated background glow */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-primary/40 via-accent/40 to-primary/40"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.4, 0.8, 0.4],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* More particle effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(40)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 bg-primary/80 rounded-full"
              style={{
                boxShadow: "0 0 10px currentColor, 0 0 20px currentColor"
              }}
              initial={{
                x: Math.random() * window.innerWidth,
                y: window.innerHeight + 50,
              }}
              animate={{
                y: -50,
                x: Math.random() * window.innerWidth,
                scale: [0, 1.5, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1.5 + Math.random() * 1.5,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        {/* Radial light rays */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(circle, rgba(167, 108, 255, 0.3) 0%, transparent 70%)"
          }}
          animate={{
            scale: [1, 1.8, 1],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        <div className="flex flex-col items-center gap-12 max-w-2xl text-center px-6 relative z-10">
          {stage >= 1 && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 150, damping: 12 }}
              className="relative"
            >
              {/* Dramatic corner effects */}
              <Sparkles className="absolute -top-12 -left-12 w-16 h-16 text-primary animate-pulse" 
                style={{ filter: "drop-shadow(0 0 10px currentColor)" }} />
              <Sparkles className="absolute -top-12 -right-12 w-16 h-16 text-accent animate-pulse" 
                style={{ filter: "drop-shadow(0 0 10px currentColor)" }} />
              <Zap className="absolute -bottom-12 -left-12 w-16 h-16 text-primary animate-pulse" 
                style={{ filter: "drop-shadow(0 0 10px currentColor)" }} />
              <Zap className="absolute -bottom-12 -right-12 w-16 h-16 text-accent animate-pulse" 
                style={{ filter: "drop-shadow(0 0 10px currentColor)" }} />
              
              {/* Rotating ring effect */}
              <motion.div
                className="absolute inset-0 rounded-3xl border-4 border-primary/50"
                animate={{
                  rotate: [0, 360],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  rotate: { duration: 4, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                }}
                style={{
                  filter: "blur(2px)",
                  boxShadow: "0 0 40px rgba(167, 108, 255, 0.8)"
                }}
              />

              <motion.div
                className="w-64 h-64 rounded-3xl overflow-hidden border-8 border-primary shadow-2xl relative"
                animate={{
                  boxShadow: [
                    "0 0 40px rgba(167, 108, 255, 0.6)",
                    "0 0 100px rgba(167, 108, 255, 1), 0 0 150px rgba(192, 132, 252, 0.8)",
                    "0 0 40px rgba(167, 108, 255, 0.6)",
                  ],
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                }}
              >
                {/* Animated shimmer overlay */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{
                    x: ["-100%", "100%"],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
                
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
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 150, damping: 15 }}
              className="space-y-6"
            >
              <motion.h1
                className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary"
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
                  textShadow: "0 0 30px rgba(167, 108, 255, 0.8), 0 0 60px rgba(192, 132, 252, 0.6)"
                }}
              >
                Evolution!
              </motion.h1>
              
              <motion.p
                className="text-3xl md:text-4xl font-bold text-white"
                style={{
                  textShadow: "0 0 20px rgba(255, 255, 255, 0.8)"
                }}
                animate={{
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
              >
                Your Companion has Evolved!
              </motion.p>

              {stage >= 4 && voiceLine && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="max-w-lg mx-auto"
                >
                  <div className="relative p-8 rounded-2xl bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20 border-2 border-primary/50 backdrop-blur-sm"
                    style={{
                      boxShadow: "0 0 40px rgba(167, 108, 255, 0.4)"
                    }}
                  >
                    <Volume2 className="absolute top-3 right-3 w-6 h-6 text-primary animate-pulse" />
                    <p className="text-xl md:text-2xl text-white font-medium italic leading-relaxed"
                      style={{
                        textShadow: "0 0 10px rgba(255, 255, 255, 0.5)"
                      }}
                    >
                      "{voiceLine}"
                    </p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
