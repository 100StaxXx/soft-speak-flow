import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { haptics } from "@/utils/haptics";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playEvolutionStart, playEvolutionSuccess } from "@/utils/soundEffects";
import { pauseAmbientForEvent, resumeAmbientAfterEvent } from "@/utils/ambientMusic";
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
const EvolutionParticles = ({ count = 20 }: { count?: number }) => {
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
            background: 'radial-gradient(circle, hsl(var(--primary)) 40%, hsl(var(--accent)) 100%)',
            boxShadow: '0 0 12px hsl(var(--primary))',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const emergencyTimeoutRef = useRef<number | null>(null);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

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

    pauseAmbientForEvent();
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
        if (isMounted) {
          setVoiceLine("Your companion has evolved to a new stage!");
          setIsLoadingVoice(false);
        }
      }
    };

    generateVoice();

    // Emergency timeout - reduced to 15 seconds
    emergencyTimeoutRef.current = window.setTimeout(() => {
      if (isMounted) {
        console.warn('Evolution modal timeout reached, showing emergency exit');
        setShowEmergencyExit(true);
      }
    }, 15000);

    timersRef.current = [];
    
    // Optimized timing sequence - faster overall
    // Stage 1: Prophetic text (0.4s)
    timersRef.current.push(setTimeout(() => {
      setAnimationStage(1);
      haptics.light();
    }, 400));
    
    // Stage 2: Text fades (1.2s)
    timersRef.current.push(setTimeout(() => {
      setAnimationStage(2);
      haptics.medium();
    }, 1200));
    
    // Stage 3: Image appears with shake (1.6s)
    timersRef.current.push(setTimeout(() => {
      setAnimationStage(3);
      shake();
      haptics.heavy();
      playEvolutionStart();
    }, 1600));
    
    // Stage 4: Glow intensifies (2s)
    timersRef.current.push(setTimeout(() => {
      setAnimationStage(4);
    }, 2000));

    // Stage 5: Evolution title + confetti (3s)
    timersRef.current.push(setTimeout(() => {
      setAnimationStage(5);
      shake();
      haptics.success();
      playEvolutionSuccess();
      
      if (audioRef.current && !isLoadingVoice && !globalAudio.getMuted()) {
        audioRef.current.play().catch(err => console.error('Audio play failed:', err));
      }

      // Reduced confetti for performance
      if (!prefersReducedMotion) {
        confetti({
          particleCount: 150,
          spread: 120,
          origin: { y: 0.5 },
          colors: ['#A76CFF', '#C084FC', '#E879F9', '#FFD700'],
          ticks: 400,
          gravity: 0.6,
          scalar: 1.5,
        });
        
        timersRef.current.push(setTimeout(() => {
          confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.7, x: 0.2 },
            colors: ['#A76CFF', '#E879F9'],
          });
          confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.7, x: 0.8 },
            colors: ['#C084FC', '#FFD700'],
          });
        }, 150));
      }
    }, 3000));

    // Stage 6: Voice line (3.5s)
    timersRef.current.push(setTimeout(() => {
      setAnimationStage(6);
      // Enable dismiss after 3s delay (total ~6.5s)
      timersRef.current.push(setTimeout(() => {
        setCanDismiss(true);
      }, 3000));
    }, 3500));

    return () => {
      isMounted = false;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (emergencyTimeoutRef.current) {
        clearTimeout(emergencyTimeoutRef.current);
        emergencyTimeoutRef.current = null;
      }
      cleanupAudio();
      resumeAmbientAfterEvent();
    };
  }, [isEvolving, isLoadingVoice, mentorSlug, userId, newStage, cleanupAudio, prefersReducedMotion]);

  const handleDismiss = (e: React.MouseEvent) => {
    if (!canDismiss) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    setAnimationStage(0);
    setCanDismiss(false);
    cleanupAudio();
    resumeAmbientAfterEvent();
    
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
    resumeAmbientAfterEvent();
    window.dispatchEvent(new CustomEvent('evolution-modal-closed'));
    onComplete();
  };

  const handleExitComplete = () => {
    console.log('[CompanionEvolution] Exit animation complete');
    setShowContinueButton(true);
  };

  if (!isEvolving) return null;

  const isStage0 = newStage === 0;
  const isStage1 = newStage === 1;

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {isEvolving && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          role="alertdialog"
          aria-labelledby="evolution-title"
          aria-describedby="evolution-description"
          className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden gpu-layer ${canDismiss ? 'cursor-pointer' : ''}`}
          onClick={handleDismiss}
          onTouchStart={(e) => !canDismiss && e.preventDefault()}
          style={{ 
            pointerEvents: 'auto', 
            touchAction: canDismiss ? 'auto' : 'none',
            background: 'radial-gradient(circle at center, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.95) 70%, black 100%)',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)',
          }}
        >
          {/* Animated background glow - CSS animation for performance */}
          {animationStage >= 3 && !prefersReducedMotion && (
            <div 
              className="absolute inset-0 animate-evolution-glow will-change-transform"
              style={{
                background: 'radial-gradient(circle at center, hsl(var(--primary) / 0.2) 0%, transparent 60%)'
              }}
            />
          )}

          {/* CSS-only particles for performance */}
          {animationStage >= 3 && !prefersReducedMotion && <EvolutionParticles count={20} />}

          <div className="flex flex-col items-center justify-center gap-6 max-w-4xl w-full px-6 relative z-10">
            {/* Prophetic text overlay - Stage 1 */}
            {animationStage === 1 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.6 }}
                className="text-center will-change-transform"
              >
                <h2 
                  id="evolution-title"
                  className="text-3xl sm:text-4xl md:text-6xl font-black text-white tracking-wider"
                  style={{
                    textShadow: "0 0 30px hsl(var(--primary)), 0 0 60px hsl(var(--accent) / 0.6)"
                  }}
                >
                  {isStage0 ? "A Vision of Your Destiny..." : isStage1 ? "Your Companion Emerges..." : "Evolution Awakens..."}
                </h2>
              </motion.div>
            )}

            {/* Companion image - Stages 3+ */}
            {animationStage >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 80, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ 
                  type: "spring",
                  stiffness: 120,
                  damping: 18,
                }}
                className="relative flex items-center justify-center will-change-transform"
                style={{
                  width: '100%',
                  maxWidth: '700px',
                  height: '60vh',
                  maxHeight: '500px',
                }}
              >
                {/* Pulsing glow - CSS animation */}
                <div 
                  className="absolute inset-0 animate-evolution-pulse will-change-transform"
                  style={{
                    background: 'radial-gradient(circle, hsl(var(--primary) / 0.3) 0%, transparent 70%)',
                    filter: 'blur(30px)',
                  }}
                />

                {/* Corner sparkles */}
                <Sparkles className="absolute -top-6 -left-6 w-12 h-12 text-primary animate-pulse will-change-transform" style={{ filter: "drop-shadow(0 0 15px currentColor)" }} />
                <Sparkles className="absolute -top-6 -right-6 w-12 h-12 text-accent animate-pulse will-change-transform" style={{ filter: "drop-shadow(0 0 15px currentColor)", animationDelay: '0.2s' }} />
                <Sparkles className="absolute -bottom-6 -left-6 w-12 h-12 text-accent animate-pulse will-change-transform" style={{ filter: "drop-shadow(0 0 15px currentColor)", animationDelay: '0.4s' }} />
                <Sparkles className="absolute -bottom-6 -right-6 w-12 h-12 text-primary animate-pulse will-change-transform" style={{ filter: "drop-shadow(0 0 15px currentColor)", animationDelay: '0.6s' }} />

                {/* The companion image */}
                <motion.div
                  className="relative rounded-2xl overflow-hidden animate-evolution-border-glow will-change-transform"
                  style={{
                    width: '100%',
                    height: '100%',
                    maxWidth: '600px',
                    border: '4px solid hsl(var(--primary) / 0.5)',
                  }}
                >
                  {/* Shimmer overlay - CSS animation */}
                  {!prefersReducedMotion && (
                    <div className="absolute inset-0 animate-evolution-shimmer pointer-events-none z-10" />
                  )}

                  <motion.img
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    src={newImageUrl}
                    alt="Evolved companion"
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </motion.div>
              </motion.div>
            )}

            {/* Evolution announcement - Stage 5+ */}
            {animationStage >= 5 && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 18 }}
                className="text-center space-y-4 will-change-transform"
              >
                <motion.h1
                  className="text-4xl sm:text-5xl md:text-7xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary animate-gradient-text"
                  style={{
                    backgroundSize: "200% 200%",
                    textShadow: "0 0 30px hsl(var(--primary)), 0 0 60px hsl(var(--accent) / 0.6)"
                  }}
                >
                  {isStage0 ? "Destiny Sealed!" : isStage1 ? "Born!" : "Evolution!"}
                </motion.h1>
                
                <p
                  id="evolution-description"
                  className="text-xl sm:text-2xl md:text-3xl font-bold text-white animate-subtle-pulse"
                  style={{
                    textShadow: "0 0 20px rgba(255, 255, 255, 0.8)"
                  }}
                >
                  {isStage0 
                    ? "Your Champion Awaits Within" 
                    : isStage1
                    ? "Your Companion Has Hatched!"
                    : "Your Companion Has Evolved!"}
                </p>

                {/* Voice line - Stage 6 */}
                {animationStage >= 6 && voiceLine && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                    className="max-w-xl mx-auto mt-4"
                  >
                    <div 
                      className="relative p-6 rounded-xl bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20 border border-primary/40 backdrop-blur-sm"
                      style={{
                        boxShadow: "0 0 30px hsl(var(--primary) / 0.4)"
                      }}
                    >
                      <p className="text-lg sm:text-xl text-white font-medium italic leading-relaxed"
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

            {/* Tap to continue indicator - with safe area */}
            {canDismiss && !showContinueButton && !showEmergencyExit && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="absolute left-1/2 transform -translate-x-1/2"
                style={{ 
                  bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))'
                }}
              >
                <p className="text-white/80 text-base sm:text-lg font-medium animate-pulse">
                  Tap anywhere to continue ✨
                </p>
              </motion.div>
            )}

            {/* Emergency exit button - with safe area */}
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

            {/* Continue button - with safe area */}
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
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-bold text-lg sm:text-xl px-10 py-3 rounded-full shadow-2xl hover:shadow-primary/50 transition-all duration-300 animate-pulse border-2 border-white/20"
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
