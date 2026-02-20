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
import { getEvolutionTheme, type EvoTheme, type ParticleStyle } from "@/config/evolutionThemes";
import { logger } from "@/utils/logger";

interface CompanionEvolutionProps {
  isEvolving: boolean;
  newStage: number;
  newImageUrl: string;
  mentorSlug?: string;
  userId?: string;
  element?: string;
  onComplete: () => void;
}

// 4-phase emotional arc
type EvolutionPhase = 'anticipation' | 'impact' | 'reveal' | 'settle';
const log = logger.scope('CompanionEvolution');

// Convergence particles - spawn in ring, drift inward
const ConvergenceParticles = ({ 
  phase, 
  particleStyle 
}: { 
  phase: EvolutionPhase; 
  particleStyle: ParticleStyle;
}) => {
  const particles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      angle: (i / 12) * Math.PI * 2,
      startRadius: 180,
    })), []
  );

  if (phase === 'settle') return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={`absolute w-2 h-2 evo-particle evo-particle-${particleStyle}`}
          initial={{
            x: Math.cos(p.angle) * p.startRadius,
            y: Math.sin(p.angle) * p.startRadius,
            opacity: 0.3,
            scale: 1,
          }}
          animate={{
            x: phase === 'impact' ? 0 : Math.cos(p.angle) * 60,
            y: phase === 'impact' ? 0 : Math.sin(p.angle) * 60,
            opacity: phase === 'impact' ? 0 : 0.7,
            scale: phase === 'impact' ? 0.2 : 0.8,
          }}
          transition={{
            duration: phase === 'impact' ? 0.6 : 1.2,
            ease: [0.25, 0.1, 0.25, 1],
          }}
        />
      ))}
    </div>
  );
};

// Hatching overlay for first evolution (Egg → Hatchling)
const HatchingOverlay = ({ phase, show }: { phase: EvolutionPhase; show: boolean }) => {
  if (!show) return null;

  const isDrawing = phase === 'anticipation' || phase === 'impact';
  const isFlashing = phase === 'impact';

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
      {/* Egg silhouette vignette */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0.6 }}
        animate={{ opacity: phase === 'reveal' || phase === 'settle' ? 0 : 0.4 }}
        transition={{ duration: 0.5 }}
        style={{
          background: 'radial-gradient(ellipse 60% 70% at 50% 50%, transparent 40%, hsl(45, 50%, 15%) 100%)',
        }}
      />

      {/* Crack lines SVG */}
      <svg className="absolute w-full h-full" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
        <motion.path
          d="M200 100 L210 150 L195 180 L205 220 L190 280"
          fill="none"
          stroke="hsl(50, 100%, 80%)"
          strokeWidth="3"
          className={isDrawing ? "evo-crack-path drawing" : "evo-crack-path"}
          initial={{ opacity: 0 }}
          animate={{ opacity: isDrawing ? 1 : 0 }}
          style={{ filter: "drop-shadow(0 0 8px hsl(50, 100%, 70%))" }}
        />
        <motion.path
          d="M200 100 L185 155 L200 190 L180 240 L195 300"
          fill="none"
          stroke="hsl(50, 100%, 80%)"
          strokeWidth="2"
          className={isDrawing ? "evo-crack-path drawing delay-100" : "evo-crack-path"}
          initial={{ opacity: 0 }}
          animate={{ opacity: isDrawing ? 1 : 0 }}
          style={{ filter: "drop-shadow(0 0 6px hsl(50, 100%, 70%))" }}
        />
        <motion.path
          d="M200 100 L220 140 L210 200 L230 260"
          fill="none"
          stroke="hsl(50, 100%, 80%)"
          strokeWidth="2"
          className={isDrawing ? "evo-crack-path drawing delay-150" : "evo-crack-path"}
          initial={{ opacity: 0 }}
          animate={{ opacity: isDrawing ? 1 : 0 }}
          style={{ filter: "drop-shadow(0 0 6px hsl(50, 100%, 70%))" }}
        />
      </svg>

      {/* Light spill seam flash */}
      {isFlashing && (
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-48 evo-seam-flash"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, hsl(50, 100%, 90%) 50%, transparent 100%)',
          }}
        />
      )}

      {/* Shell fragments fly outward at impact */}
      {phase === 'impact' && (
        <div className="absolute inset-0 flex items-center justify-center">
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-4 bg-gradient-to-br from-amber-100 to-amber-200 rounded-sm"
              initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }}
              animate={{
                x: Math.cos((i / 8) * Math.PI * 2) * 140,
                y: Math.sin((i / 8) * Math.PI * 2) * 110 + 40,
                rotate: Math.random() * 360,
                opacity: 0,
                scale: 0.3,
              }}
              transition={{
                duration: 1,
                ease: "easeOut",
                delay: i * 0.02,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CompanionEvolutionContent = ({ 
  isEvolving, 
  newStage, 
  newImageUrl,
  mentorSlug,
  userId,
  element,
  onComplete 
}: CompanionEvolutionProps) => {
  const [phase, setPhase] = useState<EvolutionPhase>('anticipation');
  const [voiceLine, setVoiceLine] = useState<string>("");
  const [isLoadingVoice, setIsLoadingVoice] = useState(true);
  const [canDismiss, setCanDismiss] = useState(false);
  const [showEmergencyExit, setShowEmergencyExit] = useState(false);
  const [imagePreloaded, setImagePreloaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const emergencyTimeoutRef = useRef<number | null>(null);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  // First evolution detection (Egg → Stage 1)
  const isFirstEvolution = newStage === 1;
  
  // Get theme based on element and evolution type
  const theme: EvoTheme = useMemo(() => 
    getEvolutionTheme(element, isFirstEvolution), 
    [element, isFirstEvolution]
  );

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
        log.error('Error cleaning up audio', { error });
      } finally {
        audioRef.current = null;
      }
    }
  }, []);

  // Preload image before starting animation
  useEffect(() => {
    if (!isEvolving || !newImageUrl) return;

    setImagePreloaded(false);
    
    const img = new Image();
    img.src = newImageUrl;
    img.onload = () => setImagePreloaded(true);
    img.onerror = () => setImagePreloaded(true); // Fallback on error
    
    // Fallback timeout - start after 2s even if not loaded
    const timeout = setTimeout(() => setImagePreloaded(true), 2000);
    
    return () => clearTimeout(timeout);
  }, [isEvolving, newImageUrl]);

  // Main animation sequence - only starts after image preloaded
  useEffect(() => {
    if (!isEvolving || !imagePreloaded) return;

    let isMounted = true;

    // Reset state
    setPhase('anticipation');
    setCanDismiss(false);

    playEvolutionStart();
    haptics.light();

    // Generate AI voice line
    const generateVoice = async () => {
      if (!mentorSlug || !userId) {
        if (isMounted) setIsLoadingVoice(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('generate-evolution-voice', {
          body: { mentorSlug, newStage, userId, isFirstEvolution }
        });

        if (error) throw error;
        if (!isMounted) return;

        if (data?.voiceLine) setVoiceLine(data.voiceLine);
        if (data?.audioContent) {
          audioRef.current = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        }
        setIsLoadingVoice(false);
      } catch (error) {
        log.error('Failed to generate evolution voice', { error });
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
        log.info('Evolution modal timeout reached, showing emergency exit');
        setShowEmergencyExit(true);
      }
    }, 15000);

    timersRef.current = [];
    
    // 4-PHASE TIMELINE (total ~4.5s)
    // Phase 1: Anticipation (0 - 1.2s) - already set
    
    // Phase 2: Impact (1.2s)
    timersRef.current.push(setTimeout(() => {
      if (!isMounted) return;
      setPhase('impact');
      haptics.heavy();
      
      // Add pulse effect to container
      if (containerRef.current && !prefersReducedMotion) {
        containerRef.current.classList.add('animate-evolution-pulse-hit');
        setTimeout(() => {
          containerRef.current?.classList.remove('animate-evolution-pulse-hit');
        }, 600);
      }
    }, 1200));

    // Phase 3: Reveal (2.2s)
    timersRef.current.push(setTimeout(() => {
      if (!isMounted) return;
      setPhase('reveal');
      playEvolutionSuccess();
      
      // Play voice
      if (audioRef.current && !isLoadingVoice && !globalAudio.getMuted()) {
        audioRef.current.play().catch((error) => log.error('Audio play failed', { error }));
      }
      
      // Confetti 100ms AFTER reveal starts (not during)
      if (!prefersReducedMotion) {
        setTimeout(() => {
          confetti({
            particleCount: theme.confettiParticleCount,
            spread: theme.confettiSpread,
            origin: { y: 0.5 },
            colors: theme.confettiColors,
            ticks: 400,
            gravity: theme.confettiGravity,
            scalar: isFirstEvolution ? 1.8 : 1.5,
          });
          
          haptics.medium();
          
          // Secondary bursts
          setTimeout(() => {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.7, x: 0.25 },
              colors: theme.confettiColors.slice(0, 2),
            });
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.7, x: 0.75 },
              colors: theme.confettiColors.slice(2),
            });
          }, 200);
        }, 100);
      }
    }, 2200));

    // Phase 4: Settle (3.6s)
    timersRef.current.push(setTimeout(() => {
      if (!isMounted) return;
      setPhase('settle');
      
      // Enable dismiss after settle begins
      setTimeout(() => {
        if (isMounted) setCanDismiss(true);
      }, 800);
    }, 3600));

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
  }, [isEvolving, imagePreloaded, isLoadingVoice, mentorSlug, userId, newStage, cleanupAudio, prefersReducedMotion, isFirstEvolution, theme]);

  const handleDismiss = (e: React.MouseEvent) => {
    if (!canDismiss) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    cleanupAudio();
    log.debug('Dispatching evolution events and closing modal');
    window.dispatchEvent(new CustomEvent('companion-evolved'));
    window.dispatchEvent(new CustomEvent('evolution-complete'));
    window.dispatchEvent(new CustomEvent('evolution-modal-closed'));
    
    onComplete();
  };

  const handleEmergencyExit = () => {
    log.info('Emergency exit triggered');
    cleanupAudio();
    if (emergencyTimeoutRef.current) {
      clearTimeout(emergencyTimeoutRef.current);
      emergencyTimeoutRef.current = null;
    }
    window.dispatchEvent(new CustomEvent('evolution-modal-closed'));
    onComplete();
  };

  if (!isEvolving) return null;

  // Waiting for image preload
  if (!imagePreloaded) {
    return (
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-primary text-xl font-medium"
        >
          Preparing evolution...
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
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
          className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden gpu-layer evo-card ${canDismiss ? 'cursor-pointer' : ''}`}
          onClick={handleDismiss}
          onTouchStart={(e) => !canDismiss && e.preventDefault()}
          data-particles={theme.particleStyle}
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
            ['--evo-glow-a' as string]: theme.glowA,
            ['--evo-glow-b' as string]: theme.glowB,
          }}
        >
          {/* Vignette overlay */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
            }}
          />

          {/* Animated background glow - theme aware */}
          {(phase === 'reveal' || phase === 'settle') && !prefersReducedMotion && (
            <motion.div 
              className="absolute inset-0 will-change-transform evo-glow"
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
            />
          )}

          {/* Convergence particles - theme aware */}
          {!prefersReducedMotion && (
            <ConvergenceParticles phase={phase} particleStyle={theme.particleStyle} />
          )}

          {/* Hatching overlay for first evolution */}
          {isFirstEvolution && <HatchingOverlay phase={phase} show={phase !== 'settle'} />}

          <div className="flex flex-col items-center justify-center gap-6 max-w-4xl w-full px-6 relative z-10">
            {/* Prophetic text - Anticipation phase */}
            <AnimatePresence mode="wait">
              {phase === 'anticipation' && (
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
                      textShadow: `0 0 30px hsl(${theme.glowA}), 0 0 60px hsl(${theme.glowB} / 0.6)`
                    }}
                  >
                    {isFirstEvolution ? "Something Stirs Within..." : "Evolution Awakens..."}
                  </h2>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Companion image - Reveal & Settle phases */}
            <AnimatePresence>
              {(phase === 'reveal' || phase === 'settle') && (
                <motion.div
                  key="companion-wrapper"
                  initial={{ opacity: 0, scale: 0.92, filter: 'blur(12px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  transition={{ 
                    duration: 1,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                  className="relative flex items-center justify-center will-change-transform"
                  style={{
                    width: '100%',
                    maxWidth: '600px',
                    height: '55vh',
                    maxHeight: '450px',
                  }}
                >
                  {/* Pulsing glow - theme aware */}
                  <motion.div 
                    className="absolute inset-0 will-change-transform"
                    animate={phase === 'settle' ? {
                      scale: [1, 1.08, 1],
                      opacity: [0.4, 0.6, 0.4],
                    } : {}}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    style={{
                      background: `radial-gradient(circle, hsl(${theme.glowA} / 0.35) 0%, transparent 70%)`,
                      filter: 'blur(30px)',
                    }}
                  />

                  {/* Corner sparkles */}
                  <Sparkles className="absolute -top-4 -left-4 w-10 h-10 text-primary animate-pulse will-change-transform" style={{ filter: "drop-shadow(0 0 12px currentColor)" }} />
                  <Sparkles className="absolute -top-4 -right-4 w-10 h-10 text-accent animate-pulse will-change-transform" style={{ filter: "drop-shadow(0 0 12px currentColor)", animationDelay: '0.2s' }} />
                  <Sparkles className="absolute -bottom-4 -left-4 w-10 h-10 text-accent animate-pulse will-change-transform" style={{ filter: "drop-shadow(0 0 12px currentColor)", animationDelay: '0.4s' }} />
                  <Sparkles className="absolute -bottom-4 -right-4 w-10 h-10 text-primary animate-pulse will-change-transform" style={{ filter: "drop-shadow(0 0 12px currentColor)", animationDelay: '0.6s' }} />

                  {/* Image container with breathing animation in settle phase */}
                  <motion.div
                    className="relative rounded-2xl overflow-hidden will-change-transform"
                    animate={phase === 'settle' ? {
                      scale: [1, 1.01, 1],
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
                      border: `3px solid hsl(${theme.glowA} / 0.6)`,
                      boxShadow: `0 0 40px hsl(${theme.glowA} / 0.4), inset 0 0 30px hsl(${theme.glowB} / 0.1)`,
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

                    {/* Image - only fades in, no separate scale animation */}
                    <img
                      src={newImageUrl}
                      alt="Evolved companion"
                      className="w-full h-full object-cover transition-opacity duration-300"
                      style={{ opacity: imageLoaded ? 1 : 0 }}
                      loading="eager"
                      onLoad={() => setImageLoaded(true)}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Evolution announcement - Reveal & Settle */}
            <AnimatePresence>
              {(phase === 'reveal' || phase === 'settle') && (
                <motion.div
                  key="announcement"
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 150, damping: 18, delay: 0.2 }}
                  className="text-center space-y-3 will-change-transform"
                >
                  <motion.h1
                    className="text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight"
                    style={{
                      background: isFirstEvolution
                        ? 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)'
                        : `linear-gradient(135deg, hsl(${theme.glowA}), hsl(${theme.glowB}), hsl(${theme.glowA}))`,
                      backgroundSize: '200% 200%',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      filter: `drop-shadow(0 0 20px hsl(${theme.glowA} / 0.6))`,
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
                    {isFirstEvolution ? "Hatched!" : "Evolved!"}
                  </motion.h1>
                  
                  <p
                    id="evolution-description"
                    className="text-lg sm:text-xl md:text-2xl font-semibold text-white/90"
                    style={{
                      textShadow: "0 0 15px rgba(255, 255, 255, 0.5)"
                    }}
                  >
                    {isFirstEvolution
                      ? "Your companion has emerged!"
                      : "Your companion grows stronger!"}
                  </p>

                  {/* Voice line - Settle phase */}
                  {phase === 'settle' && voiceLine && (
                    <motion.div
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.3, duration: 0.4 }}
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
              {canDismiss && !showEmergencyExit && (
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
