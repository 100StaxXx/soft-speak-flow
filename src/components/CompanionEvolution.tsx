import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { haptics } from "@/utils/haptics";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playEvolutionStart, playEvolutionSuccess } from "@/utils/soundEffects";

import { globalAudio } from "@/utils/globalAudio";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EvolutionErrorFallback } from "@/components/ErrorFallback";

interface CompanionEvolutionProps {
  isEvolving: boolean;
  newStage: number;
  newImageUrl: string;
  mentorSlug?: string;
  userId?: string;
  onComplete: () => void;
}

// CSS-only particles for better performance
const EvolutionParticles = ({ count = 20, isFirstEvolution = false }: { count?: number; isFirstEvolution?: boolean }) => {
  const particles = useMemo(() => 
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: Math.random() * 4 + 2,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 2,
    })), [count]
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full animate-evolution-particle will-change-transform"
          style={{
            width: p.size,
            height: p.size,
            left: p.left,
            bottom: -20,
            background: isFirstEvolution 
              ? 'radial-gradient(circle, hsl(50, 100%, 70%) 40%, hsl(40, 100%, 60%) 100%)'
              : 'radial-gradient(circle, hsl(var(--primary)) 40%, hsl(var(--accent)) 100%)',
            boxShadow: isFirstEvolution 
              ? '0 0 12px hsl(50, 100%, 70%)'
              : '0 0 12px hsl(var(--primary))',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
};

// Egg crack overlay for first evolution
const EggCrackOverlay = ({ stage }: { stage: number }) => {
  if (stage < 2) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: stage >= 2 ? 1 : 0 }}
      className="absolute inset-0 pointer-events-none z-5 flex items-center justify-center"
    >
      {/* Crack lines radiating from center */}
      <svg className="w-full h-full absolute" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
        <motion.path
          d="M200 100 L210 150 L195 180 L205 220 L190 280"
          fill="none"
          stroke="hsl(50, 100%, 80%)"
          strokeWidth="3"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0.8] }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ filter: "drop-shadow(0 0 8px hsl(50, 100%, 70%))" }}
        />
        <motion.path
          d="M200 100 L185 155 L200 190 L180 240 L195 300"
          fill="none"
          stroke="hsl(50, 100%, 80%)"
          strokeWidth="2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0.8] }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          style={{ filter: "drop-shadow(0 0 6px hsl(50, 100%, 70%))" }}
        />
        <motion.path
          d="M200 100 L220 140 L210 200 L230 260"
          fill="none"
          stroke="hsl(50, 100%, 80%)"
          strokeWidth="2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0.8] }}
          transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
          style={{ filter: "drop-shadow(0 0 6px hsl(50, 100%, 70%))" }}
        />
      </svg>
      
      {/* Shell fragment particles */}
      {stage >= 3 && (
        <div className="absolute inset-0">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-4 bg-gradient-to-br from-amber-100 to-amber-200 rounded-sm"
              style={{
                left: '50%',
                top: '40%',
                transformOrigin: 'center',
              }}
              initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }}
              animate={{
                x: (Math.cos((i * Math.PI * 2) / 8) * 150) + (Math.random() - 0.5) * 40,
                y: (Math.sin((i * Math.PI * 2) / 8) * 120) + Math.random() * 100,
                rotate: Math.random() * 360,
                opacity: 0,
                scale: 0.3,
              }}
              transition={{
                duration: 1.2,
                ease: "easeOut",
                delay: i * 0.03,
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};

const CompanionEvolutionContent = ({ 
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
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [showEmergencyExit, setShowEmergencyExit] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const emergencyTimeoutRef = useRef<number | null>(null);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  // First evolution detection (Egg → Stage 1)
  const isFirstEvolution = newStage === 1;
  const isStage0 = newStage === 0;

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => 
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  , []);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = '';
      } catch (error) {
        console.error('Error cleaning up audio:', error);
      } finally {
        audioRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!isEvolving) return;

    let isMounted = true;

    playEvolutionStart();

    // Screen shake effect - use CSS class
    const shake = () => {
      if (containerRef.current && !prefersReducedMotion) {
        containerRef.current.classList.add('animate-evolution-shake');
        const shakeTimer = setTimeout(() => {
          containerRef.current?.classList.remove('animate-evolution-shake');
        }, 500);
        timersRef.current.push(shakeTimer);
      }
    };

    // Generate AI voice line with first evolution context
    const generateVoice = async () => {
      if (!mentorSlug || !userId) {
        if (isMounted) setIsLoadingVoice(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('generate-evolution-voice', {
          body: { 
            mentorSlug, 
            newStage, 
            userId,
            isFirstEvolution // Pass context for special message
          }
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
        if (isMounted) {
          setVoiceLine(isFirstEvolution 
            ? "A new companion has hatched! Your journey together begins now." 
            : "Your companion has evolved to a new stage!"
          );
          setIsLoadingVoice(false);
        }
      }
    };

    generateVoice();

    // Emergency timeout - 15 seconds
    emergencyTimeoutRef.current = window.setTimeout(() => {
      if (isMounted) {
        console.warn('Evolution modal timeout reached, showing emergency exit');
        setShowEmergencyExit(true);
      }
    }, 15000);

    timersRef.current = [];
    
    // Timing adjustments for first evolution (slower, more dramatic)
    const timingMultiplier = isFirstEvolution ? 1.3 : 1;
    
    // Stage 1: Prophetic text
    timersRef.current.push(setTimeout(() => {
      setAnimationStage(1);
      haptics.light();
    }, 400 * timingMultiplier));
    
    // Stage 2: Text fades, prepare for reveal
    timersRef.current.push(setTimeout(() => {
      setAnimationStage(2);
      haptics.medium();
      if (isFirstEvolution) shake(); // Extra shake for crack effect
    }, 1400 * timingMultiplier));
    
    // Stage 3: Image appears with shake
    timersRef.current.push(setTimeout(() => {
      setAnimationStage(3);
      shake();
      haptics.heavy();
      playEvolutionStart();
    }, 2000 * timingMultiplier));
    
    // Stage 4: Glow intensifies
    timersRef.current.push(setTimeout(() => {
      setAnimationStage(4);
    }, 2400 * timingMultiplier));

    // Stage 5: Evolution title + confetti
    timersRef.current.push(setTimeout(() => {
      setAnimationStage(5);
      shake();
      haptics.success();
      playEvolutionSuccess();
      
      if (audioRef.current && !isLoadingVoice && !globalAudio.getMuted()) {
        audioRef.current.play().catch(err => console.error('Audio play failed:', err));
      }

      // Confetti burst with special colors for first evolution
      if (!prefersReducedMotion) {
        const colors = isFirstEvolution 
          ? ['#FFD700', '#FFA500', '#FFFACD', '#FFE4B5', '#F0E68C'] // Golden/warm colors for hatching
          : ['#A76CFF', '#C084FC', '#E879F9', '#FFD700'];
        
        confetti({
          particleCount: isFirstEvolution ? 200 : 150,
          spread: isFirstEvolution ? 140 : 120,
          origin: { y: 0.5 },
          colors,
          ticks: 400,
          gravity: 0.6,
          scalar: isFirstEvolution ? 1.8 : 1.5,
        });
        
        timersRef.current.push(setTimeout(() => {
          confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.7, x: 0.2 },
            colors: colors.slice(0, 2),
          });
          confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.7, x: 0.8 },
            colors: colors.slice(2),
          });
        }, 150));
      }
    }, 3200 * timingMultiplier));

    // Stage 6: Voice line
    timersRef.current.push(setTimeout(() => {
      setAnimationStage(6);
      // Enable dismiss after delay
      timersRef.current.push(setTimeout(() => {
        setCanDismiss(true);
      }, isFirstEvolution ? 4000 : 3000));
    }, 3800 * timingMultiplier));

    return () => {
      isMounted = false;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (emergencyTimeoutRef.current) {
        clearTimeout(emergencyTimeoutRef.current);
        emergencyTimeoutRef.current = null;
      }
      cleanupAudio();
    };
  }, [isEvolving, isLoadingVoice, mentorSlug, userId, newStage, cleanupAudio, prefersReducedMotion, isFirstEvolution]);

  const handleDismiss = (e: React.MouseEvent) => {
    if (!canDismiss) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    setAnimationStage(0);
    setCanDismiss(false);
    cleanupAudio();
    
    console.log('[CompanionEvolution] Dispatching evolution events and closing modal');
    window.dispatchEvent(new CustomEvent('companion-evolved'));
    window.dispatchEvent(new CustomEvent('evolution-complete'));
    window.dispatchEvent(new CustomEvent('evolution-modal-closed'));
    
    onComplete();
  };

  const handleContinue = () => {
    console.log('[CompanionEvolution] Continue button clicked');
    cleanupAudio();
    if (emergencyTimeoutRef.current) {
      clearTimeout(emergencyTimeoutRef.current);
      emergencyTimeoutRef.current = null;
    }
    window.dispatchEvent(new CustomEvent('evolution-modal-closed'));
    setShowContinueButton(false);
    setShowEmergencyExit(false);
    onComplete();
  };

  const handleEmergencyExit = () => {
    console.log('[CompanionEvolution] Emergency exit triggered');
    cleanupAudio();
    if (emergencyTimeoutRef.current) {
      clearTimeout(emergencyTimeoutRef.current);
      emergencyTimeoutRef.current = null;
    }
    setAnimationStage(0);
    setCanDismiss(false);
    setShowEmergencyExit(false);
    window.dispatchEvent(new CustomEvent('evolution-modal-closed'));
    onComplete();
  };

  const handleExitComplete = () => {
    console.log('[CompanionEvolution] Exit animation complete');
    setShowContinueButton(true);
  };

  if (!isEvolving) return null;

  return (
    <AnimatePresence mode="wait" onExitComplete={handleExitComplete}>
      {isEvolving && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          role="alertdialog"
          aria-labelledby="evolution-title"
          aria-describedby="evolution-description"
          className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden gpu-layer ${canDismiss ? 'cursor-pointer' : ''}`}
          onClick={handleDismiss}
          onTouchStart={(e) => !canDismiss && e.preventDefault()}
          style={{ 
            pointerEvents: 'auto', 
            touchAction: canDismiss ? 'auto' : 'none',
            background: isFirstEvolution
              ? 'radial-gradient(circle at center, rgba(50, 40, 0, 0.8) 0%, rgba(0, 0, 0, 0.95) 60%, black 100%)'
              : 'radial-gradient(circle at center, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.95) 70%, black 100%)',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)',
          }}
        >
          {/* Vignette overlay for depth */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
            }}
          />

          {/* Animated background glow */}
          {animationStage >= 3 && !prefersReducedMotion && (
            <motion.div 
              className="absolute inset-0 will-change-transform"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: [0.3, 0.5, 0.3],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                background: isFirstEvolution
                  ? 'radial-gradient(circle at center, hsl(45, 100%, 50%, 0.25) 0%, transparent 60%)'
                  : 'radial-gradient(circle at center, hsl(var(--primary) / 0.2) 0%, transparent 60%)'
              }}
            />
          )}

          {/* CSS-only particles for performance */}
          {animationStage >= 3 && !prefersReducedMotion && (
            <EvolutionParticles count={isFirstEvolution ? 30 : 20} isFirstEvolution={isFirstEvolution} />
          )}

          {/* Egg crack overlay for first evolution */}
          {isFirstEvolution && <EggCrackOverlay stage={animationStage} />}

          <div className="flex flex-col items-center justify-center gap-6 max-w-4xl w-full px-6 relative z-10">
            {/* Prophetic text overlay - Stage 1 */}
            <AnimatePresence mode="wait">
              {animationStage === 1 && (
                <motion.div
                  key="prophetic-text"
                  initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 1.05, filter: 'blur(5px)' }}
                  transition={{ duration: 0.6 }}
                  className="text-center will-change-transform"
                >
                  <h2 
                    id="evolution-title"
                    className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-wider"
                    style={{
                      textShadow: isFirstEvolution
                        ? "0 0 30px hsl(45, 100%, 60%), 0 0 60px hsl(35, 100%, 50%, 0.6)"
                        : "0 0 30px hsl(var(--primary)), 0 0 60px hsl(var(--accent) / 0.6)"
                    }}
                  >
                    {isStage0 ? "A Vision of Your Destiny..." : isFirstEvolution ? "Something Stirs Within..." : "Evolution Awakens..."}
                  </h2>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Companion image - Stages 3+ */}
            <AnimatePresence>
              {animationStage >= 3 && (
                <motion.div
                  key="companion-image"
                  layoutId="evolution-companion"
                  initial={{ opacity: 0, y: 60, scale: 0.7, filter: 'blur(20px)' }}
                  animate={{ 
                    opacity: imageLoaded ? 1 : 0.5, 
                    y: 0, 
                    scale: 1, 
                    filter: 'blur(0px)' 
                  }}
                  transition={{ 
                    type: "spring",
                    stiffness: 100,
                    damping: 20,
                    filter: { duration: 0.8 }
                  }}
                  className="relative flex items-center justify-center will-change-transform"
                  style={{
                    width: '100%',
                    maxWidth: '600px',
                    height: '55vh',
                    maxHeight: '450px',
                  }}
                >
                  {/* Pulsing glow */}
                  <motion.div 
                    className="absolute inset-0 will-change-transform"
                    animate={{
                      scale: [1, 1.15, 1],
                      opacity: [0.4, 0.7, 0.4],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    style={{
                      background: isFirstEvolution
                        ? 'radial-gradient(circle, hsl(45, 100%, 60%, 0.35) 0%, transparent 70%)'
                        : 'radial-gradient(circle, hsl(var(--primary) / 0.3) 0%, transparent 70%)',
                      filter: 'blur(30px)',
                    }}
                  />

                  {/* Corner sparkles */}
                  <Sparkles className="absolute -top-4 -left-4 w-10 h-10 text-primary animate-pulse will-change-transform" style={{ filter: "drop-shadow(0 0 12px currentColor)" }} />
                  <Sparkles className="absolute -top-4 -right-4 w-10 h-10 text-accent animate-pulse will-change-transform" style={{ filter: "drop-shadow(0 0 12px currentColor)", animationDelay: '0.2s' }} />
                  <Sparkles className="absolute -bottom-4 -left-4 w-10 h-10 text-accent animate-pulse will-change-transform" style={{ filter: "drop-shadow(0 0 12px currentColor)", animationDelay: '0.4s' }} />
                  <Sparkles className="absolute -bottom-4 -right-4 w-10 h-10 text-primary animate-pulse will-change-transform" style={{ filter: "drop-shadow(0 0 12px currentColor)", animationDelay: '0.6s' }} />

                  {/* The companion image with subtle scale pulse */}
                  <motion.div
                    className="relative rounded-2xl overflow-hidden will-change-transform"
                    animate={animationStage >= 5 ? {
                      scale: [1, 1.02, 1],
                    } : {}}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      maxWidth: '520px',
                      border: isFirstEvolution 
                        ? '3px solid hsl(45, 100%, 60%, 0.6)'
                        : '3px solid hsl(var(--primary) / 0.5)',
                      boxShadow: isFirstEvolution
                        ? '0 0 40px hsl(45, 100%, 50%, 0.4), inset 0 0 30px hsl(45, 100%, 60%, 0.1)'
                        : '0 0 40px hsl(var(--primary) / 0.4), inset 0 0 30px hsl(var(--primary) / 0.1)',
                    }}
                  >
                    {/* Shimmer overlay */}
                    {!prefersReducedMotion && (
                      <motion.div 
                        className="absolute inset-0 pointer-events-none z-10"
                        animate={{
                          backgroundPosition: ['200% 0%', '-200% 0%'],
                        }}
                        transition={{
                          duration: 2.5,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        style={{
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                          backgroundSize: '200% 100%',
                        }}
                      />
                    )}

                    <motion.img
                      initial={{ scale: 1.1, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.15, duration: 0.5 }}
                      src={newImageUrl}
                      alt="Evolved companion"
                      className="w-full h-full object-cover"
                      loading="eager"
                      onLoad={() => setImageLoaded(true)}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Evolution announcement - Stage 5+ */}
            <AnimatePresence>
              {animationStage >= 5 && (
                <motion.div
                  key="announcement"
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 150, damping: 18 }}
                  className="text-center space-y-3 will-change-transform"
                >
                  <motion.h1
                    className="text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight"
                    style={{
                      background: isFirstEvolution
                        ? 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)'
                        : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))',
                      backgroundSize: '200% 200%',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      textShadow: 'none',
                      filter: 'drop-shadow(0 0 20px hsl(var(--primary) / 0.6))',
                    }}
                    animate={{
                      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  >
                    {isStage0 ? "Destiny Sealed!" : isFirstEvolution ? "Hatched!" : "Evolved!"}
                  </motion.h1>
                  
                  <p
                    id="evolution-description"
                    className="text-lg sm:text-xl md:text-2xl font-semibold text-white/90"
                    style={{
                      textShadow: "0 0 15px rgba(255, 255, 255, 0.5)"
                    }}
                  >
                    {isStage0 
                      ? "Your Champion Awaits Within" 
                      : isFirstEvolution
                      ? "Your companion has emerged!"
                      : "Your companion grows stronger!"}
                  </p>

                  {/* Voice line - Stage 6 with frosted glass card */}
                  {animationStage >= 6 && voiceLine && (
                    <motion.div
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.15, duration: 0.4 }}
                      className="max-w-lg mx-auto mt-5"
                    >
                      <div 
                        className="relative p-5 rounded-xl bg-white/5 border border-white/20 backdrop-blur-md"
                        style={{
                          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)"
                        }}
                      >
                        <p className="text-base sm:text-lg text-white/95 font-medium italic leading-relaxed">
                          "{voiceLine}"
                        </p>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tap to continue indicator */}
            <AnimatePresence>
              {canDismiss && !showContinueButton && !showEmergencyExit && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.2 }}
                  className="absolute left-1/2 transform -translate-x-1/2"
                  style={{ 
                    bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))'
                  }}
                >
                  <motion.p 
                    className="text-white/90 text-base sm:text-lg font-medium"
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    Tap anywhere to continue ✨
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Emergency exit button */}
            {showEmergencyExit && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute z-[10002]"
                style={{
                  top: 'calc(1rem + env(safe-area-inset-top, 0px))',
                  right: 'calc(1rem + env(safe-area-inset-right, 0px))',
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEmergencyExit();
                  }}
                  className="bg-destructive/90 hover:bg-destructive text-destructive-foreground font-bold px-4 py-2 rounded-lg shadow-lg transition-colors"
                  aria-label="Close evolution modal"
                >
                  ✕ Close
                </button>
              </motion.div>
            )}

            {/* Continue button */}
            {showContinueButton && !isEvolving && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="absolute left-1/2 transform -translate-x-1/2"
                style={{ 
                  bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))'
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContinue();
                  }}
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-bold text-lg sm:text-xl px-10 py-3 rounded-full shadow-2xl hover:shadow-primary/50 transition-all duration-300 border-2 border-white/20"
                >
                  <span className="mr-2">✨</span>
                  Continue Your Journey
                  <span className="ml-2">🚀</span>
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const CompanionEvolution = (props: CompanionEvolutionProps) => (
  <ErrorBoundary fallback={<EvolutionErrorFallback onClose={props.onComplete} />}>
    <CompanionEvolutionContent {...props} />
  </ErrorBoundary>
);
