import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { haptics } from "@/utils/haptics";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playEvolutionStart, playEvolutionSuccess } from "@/utils/soundEffects";
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
  const [animationStage, setAnimationStage] = useState(0);
  const [voiceLine, setVoiceLine] = useState<string>("");
  const [isLoadingVoice, setIsLoadingVoice] = useState(true);
  const [canDismiss, setCanDismiss] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEvolving) return;

    let isMounted = true;

    pauseAmbientForEvent();
    playEvolutionStart();

    // Screen shake effect
    const shake = () => {
      if (containerRef.current) {
        containerRef.current.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.style.animation = '';
          }
        }, 500);
      }
    };

    // Generate AI voice line
    const generateVoice = async () => {
      if (!mentorSlug || !userId) {
        if (isMounted) setIsLoadingVoice(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('generate-evolution-voice', {
          body: { mentorSlug, newStage, userId }
        });

        if (error) throw error;
        if (!isMounted) return;

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
        // Set fallback voice line so animation can complete
        if (isMounted) {
          setVoiceLine("Your companion has evolved to a new stage!");
          setIsLoadingVoice(false);
        }
      }
    };

    generateVoice();

    const timers = [
      // Stage 1: Prophetic text appears (0.5s)
      setTimeout(() => {
        setAnimationStage(1);
        haptics.light();
      }, 500),
      
      // Stage 2: Text fades, screen darkens (1.5s)
      setTimeout(() => {
        setAnimationStage(2);
        haptics.medium();
      }, 1500),
      
      // Stage 3: Egg fades in with rumble (2s)
      setTimeout(() => {
        setAnimationStage(3);
        shake();
        haptics.heavy();
        // Deep bass rumble sound
        playEvolutionStart();
      }, 2000),
      
      // Stage 4: Egg fully visible with glow (2.5s)
      setTimeout(() => {
        setAnimationStage(4);
      }, 2500),

      // Stage 5: Show evolution title and confetti (4s)
      setTimeout(() => {
        setAnimationStage(5);
        shake();
        haptics.success();
        playEvolutionSuccess();
        
        // Play voice if available
        if (audioRef.current && !isLoadingVoice) {
          audioRef.current.play().catch(err => console.error('Audio play failed:', err));
        }

        // MASSIVE confetti burst
        confetti({
          particleCount: 250,
          spread: 140,
          origin: { y: 0.5 },
          colors: ['#A76CFF', '#C084FC', '#E879F9', '#FFD700', '#FFA500'],
          ticks: 600,
          gravity: 0.5,
          scalar: 2,
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
      }, 4000),

      // Stage 6: Show voice line (5s)
      setTimeout(() => {
        setAnimationStage(6);
        // Enable dismiss after 5.5s delay
        setTimeout(() => {
          setCanDismiss(true);
        }, 5500);
      }, 5000),
    ];

    return () => {
      isMounted = false;
      timers.forEach(clearTimeout);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      resumeAmbientAfterEvent();
    };
  }, [isEvolving, isLoadingVoice, mentorSlug, userId, newStage]);

  const handleDismiss = (e: React.MouseEvent) => {
    // Prevent any interaction until timer allows it
    if (!canDismiss) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    setAnimationStage(0);
    setCanDismiss(false);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    resumeAmbientAfterEvent();
    
    // Dispatch events immediately to ensure AppWalkthrough receives them
    window.dispatchEvent(new CustomEvent('companion-evolved'));
    window.dispatchEvent(new CustomEvent('evolution-complete'));
    window.dispatchEvent(new CustomEvent('evolution-modal-closed')); // For AppWalkthrough
    
    onComplete();
  };

  if (!isEvolving) return null;

  const isStage0 = newStage === 0; // Stage 0 is egg destiny preview
  const isStage1 = newStage === 1; // Stage 1 is hatchling emerging

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden ${canDismiss ? 'cursor-pointer' : ''}`}
        onClick={handleDismiss}
        onTouchStart={(e) => !canDismiss && e.preventDefault()}
        style={{ 
          pointerEvents: 'auto', 
          touchAction: canDismiss ? 'auto' : 'none',
          background: 'radial-gradient(circle at center, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.95) 70%, black 100%)'
        }}
      >
        {/* Animated background - darker edges */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at center, rgba(167, 108, 255, 0.15) 0%, transparent 60%)'
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: animationStage >= 3 ? [0.15, 0.4, 0.15] : 0,
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Particle system - rising embers matching companion color */}
        {animationStage >= 3 && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: Math.random() * 6 + 2,
                  height: Math.random() * 6 + 2,
                  background: 'radial-gradient(circle, rgba(167, 108, 255, 0.9), rgba(192, 132, 252, 0.6))',
                  boxShadow: "0 0 20px rgba(167, 108, 255, 0.8)",
                  left: `${Math.random() * 100}%`,
                }}
                initial={{
                  y: window.innerHeight + 50,
                  opacity: 0,
                }}
                animate={{
                  y: -100,
                  x: [0, Math.random() * 40 - 20, 0],
                  opacity: [0, 1, 0],
                  scale: [0.5, 1.5, 0.5],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                  ease: "easeOut"
                }}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col items-center justify-center gap-8 max-w-4xl w-full px-6 relative z-10">
          {/* Prophetic text overlay - Stage 1 */}
          {animationStage === 1 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-center"
            >
              <h2 
                className="text-4xl md:text-6xl font-black text-white tracking-wider"
                style={{
                  textShadow: "0 0 40px rgba(167, 108, 255, 0.9), 0 0 80px rgba(192, 132, 252, 0.6)"
                }}
              >
                {isStage0 ? "A Vision of Your Destiny..." : isStage1 ? "Your Companion Emerges..." : "Evolution Awakens..."}
              </h2>
            </motion.div>
          )}

          {/* Egg container - Stages 3+ */}
          {animationStage >= 3 && (
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.5 }}
              animate={{ 
                opacity: 1, 
                y: 0, 
                scale: 1,
              }}
              transition={{ 
                type: "spring",
                stiffness: 100,
                damping: 20,
                mass: 1.5
              }}
              className="relative flex items-center justify-center"
              style={{
                width: '100%',
                maxWidth: '800px',
                height: '70vh',
              }}
            >
              {/* Pulsing glow aura */}
              <motion.div
                className="absolute inset-0"
                style={{
                  background: 'radial-gradient(circle, rgba(167, 108, 255, 0.4) 0%, transparent 70%)',
                  filter: 'blur(40px)',
                }}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.4, 0.8, 0.4],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />

              {/* Stage 1 removed - no light beams */}

              {/* Corner sparkles for extra epicness */}
              <Sparkles 
                className="absolute -top-8 -left-8 w-16 h-16 text-primary animate-pulse" 
                style={{ filter: "drop-shadow(0 0 20px currentColor)" }} 
              />
              <Sparkles 
                className="absolute -top-8 -right-8 w-16 h-16 text-accent animate-pulse" 
                style={{ filter: "drop-shadow(0 0 20px currentColor)", animationDelay: '0.3s' }} 
              />
              <Sparkles 
                className="absolute -bottom-8 -left-8 w-16 h-16 text-accent animate-pulse" 
                style={{ filter: "drop-shadow(0 0 20px currentColor)", animationDelay: '0.6s' }} 
              />
              <Sparkles 
                className="absolute -bottom-8 -right-8 w-16 h-16 text-primary animate-pulse" 
                style={{ filter: "drop-shadow(0 0 20px currentColor)", animationDelay: '0.9s' }} 
              />

              {/* The egg/companion image - MASSIVE */}
              <motion.div
                className="relative rounded-3xl overflow-hidden"
                style={{
                  width: '100%',
                  height: '100%',
                  maxWidth: '700px',
                  boxShadow: '0 0 100px rgba(167, 108, 255, 0.8), 0 0 200px rgba(192, 132, 252, 0.6)',
                  border: '6px solid rgba(167, 108, 255, 0.5)',
                }}
                animate={{
                  boxShadow: [
                    '0 0 100px rgba(167, 108, 255, 0.8)',
                    '0 0 200px rgba(167, 108, 255, 1), 0 0 300px rgba(192, 132, 252, 0.8)',
                    '0 0 100px rgba(167, 108, 255, 0.8)',
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {/* Shimmer overlay */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{
                    x: ["-100%", "100%"],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear",
                    repeatDelay: 1
                  }}
                  style={{ zIndex: 10 }}
                />

                <motion.img
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ 
                    delay: 0.3,
                    type: "spring",
                    stiffness: 100,
                    damping: 15
                  }}
                  src={newImageUrl}
                  alt="Evolved companion"
                  className="w-full h-full object-cover"
                />
              </motion.div>
            </motion.div>
          )}

          {/* Evolution announcement - Stage 5+ */}
          {animationStage >= 5 && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 150, damping: 15 }}
              className="text-center space-y-6"
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
                  textShadow: "0 0 40px rgba(167, 108, 255, 0.9), 0 0 80px rgba(192, 132, 252, 0.7)"
                }}
              >
                {isStage0 ? "Destiny Sealed!" : isStage1 ? "Born!" : "Evolution!"}
              </motion.h1>
              
              <motion.p
                className="text-3xl md:text-4xl font-bold text-white"
                style={{
                  textShadow: "0 0 30px rgba(255, 255, 255, 0.9)"
                }}
                animate={{
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
              >
                {isStage0 
                  ? "Your Champion Awaits Within" 
                  : isStage1
                  ? "Your Companion Has Hatched!"
                  : "Your Companion Has Evolved!"}
              </motion.p>

              {/* Voice line - Stage 6 */}
              {animationStage >= 6 && voiceLine && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="max-w-2xl mx-auto"
                >
                  <div 
                    className="relative p-8 rounded-2xl bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20 border-2 border-primary/50 backdrop-blur-sm"
                    style={{
                      boxShadow: "0 0 50px rgba(167, 108, 255, 0.5)"
                    }}
                  >
                    <p className="text-xl md:text-2xl text-white font-medium italic leading-relaxed"
                      style={{
                        textShadow: "0 0 15px rgba(255, 255, 255, 0.6)"
                      }}
                    >
                      "{voiceLine}"
                    </p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Tap to continue indicator */}
          {canDismiss && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
            >
              <p className="text-white/80 text-lg font-medium animate-pulse">
                Tap anywhere to continue ✨
              </p>
            </motion.div>
          )}
        </div>

        {/* Add shake animation to global styles */}
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
            20%, 40%, 60%, 80% { transform: translateX(4px); }
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
};
