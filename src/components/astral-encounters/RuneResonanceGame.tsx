import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';

interface RuneResonanceGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
}

interface Rune {
  id: number;
  symbol: string;
  rhythm: number; // BPM
  phase: number;
  activated: boolean;
  x: number;
  y: number;
}

const RUNE_SYMBOLS = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ'];

export const RuneResonanceGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
}: RuneResonanceGameProps) => {
  const [runes, setRunes] = useState<Rune[]>([]);
  const [activatedCount, setActivatedCount] = useState(0);
  const [requiredRunes, setRequiredRunes] = useState(4);
  const [mistakes, setMistakes] = useState(0);
  const [maxMistakes, setMaxMistakes] = useState(5);
  const [selectedRune, setSelectedRune] = useState<number | null>(null);
  const [gameComplete, setGameComplete] = useState(false);
  const [showFeedback, setShowFeedback] = useState<{ id: number; success: boolean } | null>(null);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // Soul stat bonus
  const statBonus = companionStats.soul;
  const timingTolerance = 200 + Math.floor(statBonus / 10) * 20; // ms tolerance for rhythm match

  // Initialize runes
  useEffect(() => {
    const settings = {
      easy: { runes: 3, mistakes: 6, rhythms: [60, 80] },
      medium: { runes: 4, mistakes: 5, rhythms: [60, 80, 100] },
      hard: { runes: 5, mistakes: 4, rhythms: [60, 80, 100, 120] },
    };
    const s = settings[difficulty];
    setRequiredRunes(s.runes + Math.floor(questIntervalScale));
    setMaxMistakes(s.mistakes - Math.floor(questIntervalScale));

    const positions = [
      { x: 25, y: 30 }, { x: 75, y: 30 },
      { x: 20, y: 60 }, { x: 50, y: 50 }, { x: 80, y: 60 },
      { x: 35, y: 80 }, { x: 65, y: 80 },
    ];

    const newRunes: Rune[] = [];
    const numRunes = s.runes + Math.floor(questIntervalScale);
    
    for (let i = 0; i < numRunes; i++) {
      newRunes.push({
        id: i,
        symbol: RUNE_SYMBOLS[i % RUNE_SYMBOLS.length],
        rhythm: s.rhythms[i % s.rhythms.length],
        phase: Math.random() * Math.PI * 2,
        activated: false,
        x: positions[i % positions.length].x,
        y: positions[i % positions.length].y,
      });
    }
    setRunes(newRunes);
  }, [difficulty, questIntervalScale]);

  // Animation loop for pulsing runes
  useEffect(() => {
    if (gameComplete) return;

    const animate = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      setRunes(prev => prev.map(rune => ({
        ...rune,
        phase: (rune.phase + delta * (rune.rhythm / 60) * Math.PI * 2) % (Math.PI * 2),
      })));

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gameComplete]);

  // Get rune pulse intensity (0-1)
  const getPulseIntensity = (rune: Rune) => {
    return (Math.sin(rune.phase) + 1) / 2;
  };

  // Check if tap is on rhythm
  const isOnRhythm = (rune: Rune) => {
    const intensity = getPulseIntensity(rune);
    // Must tap when rune is at peak brightness (intensity > 0.8)
    return intensity > 0.75;
  };

  // Handle rune tap
  const handleRuneTap = useCallback((runeId: number) => {
    if (gameComplete) return;
    
    const rune = runes.find(r => r.id === runeId);
    if (!rune || rune.activated) return;

    const onRhythm = isOnRhythm(rune);
    
    if (onRhythm) {
      setRunes(prev => prev.map(r => 
        r.id === runeId ? { ...r, activated: true } : r
      ));
      setActivatedCount(c => c + 1);
      setShowFeedback({ id: runeId, success: true });
    } else {
      setMistakes(m => m + 1);
      setShowFeedback({ id: runeId, success: false });
    }

    setTimeout(() => setShowFeedback(null), 400);
  }, [runes, gameComplete]);

  // Check game end
  useEffect(() => {
    if (activatedCount >= requiredRunes || mistakes >= maxMistakes) {
      setGameComplete(true);
    }
  }, [activatedCount, requiredRunes, mistakes, maxMistakes]);

  // Complete game
  useEffect(() => {
    if (gameComplete) {
      const baseAccuracy = (activatedCount / requiredRunes) * 100;
      const mistakePenalty = (mistakes / maxMistakes) * 30;
      const accuracy = Math.max(0, Math.min(100, Math.round(baseAccuracy - mistakePenalty)));
      const result = accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 40 ? 'partial' : 'fail';
      
      setTimeout(() => {
        onComplete({
          success: accuracy >= 50,
          accuracy,
          result,
        });
      }, 500);
    }
  }, [gameComplete, activatedCount, requiredRunes, mistakes, maxMistakes, onComplete]);

  return (
    <div className="p-4 flex flex-col items-center">
      <h3 className="text-lg font-bold text-foreground mb-2">Rune Resonance</h3>
      <p className="text-sm text-muted-foreground mb-3">
        Tap each rune when it glows brightest
      </p>

      {/* Progress */}
      <div className="flex gap-4 mb-4 text-sm">
        <span className="text-purple-400">Activated: {activatedCount}/{requiredRunes}</span>
        <span className="text-red-400">Mistakes: {mistakes}/{maxMistakes}</span>
      </div>

      {/* Rune arena */}
      <div className="relative w-full max-w-xs h-64 bg-gradient-to-b from-purple-950/30 to-background rounded-lg border border-purple-500/30 overflow-hidden">
        {/* Mystical background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_hsl(271,_91%,_65%,_0.2),_transparent_70%)]" />
        </div>

        {/* Runes */}
        <AnimatePresence>
          {runes.map(rune => {
            const intensity = getPulseIntensity(rune);
            const isAtPeak = intensity > 0.75;
            
            return (
              <motion.button
                key={rune.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center transition-all"
                style={{
                  left: `${rune.x}%`,
                  top: `${rune.y}%`,
                  background: rune.activated 
                    ? 'linear-gradient(135deg, hsl(142, 76%, 46%), hsl(142, 76%, 36%))'
                    : `rgba(168, 85, 247, ${0.2 + intensity * 0.6})`,
                  boxShadow: rune.activated
                    ? '0 0 20px hsl(142, 76%, 46%)'
                    : `0 0 ${10 + intensity * 25}px rgba(168, 85, 247, ${intensity})`,
                  border: `2px solid ${rune.activated ? 'hsl(142, 76%, 46%)' : `rgba(168, 85, 247, ${0.5 + intensity * 0.5})`}`,
                  transform: `translate(-50%, -50%) scale(${0.9 + intensity * 0.2})`,
                }}
                onClick={() => handleRuneTap(rune.id)}
                disabled={rune.activated || gameComplete}
                whileTap={{ scale: 0.9 }}
              >
                <span 
                  className="text-2xl font-bold"
                  style={{
                    color: rune.activated ? 'white' : `rgba(255, 255, 255, ${0.5 + intensity * 0.5})`,
                    textShadow: rune.activated 
                      ? '0 0 10px white' 
                      : `0 0 ${intensity * 15}px rgba(168, 85, 247, ${intensity})`,
                  }}
                >
                  {rune.symbol}
                </span>

                {/* Peak indicator ring */}
                {isAtPeak && !rune.activated && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-white/50"
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: 1.3, opacity: 0 }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                )}

                {/* Feedback */}
                {showFeedback?.id === rune.id && (
                  <motion.div
                    className="absolute inset-0 rounded-full flex items-center justify-center"
                    initial={{ scale: 0.5, opacity: 1 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <span className="text-2xl">
                      {showFeedback.success ? '✨' : '❌'}
                    </span>
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* Central energy */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(271, 91%, 65%, 0.5) 0%, transparent 70%)',
          }}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>

      {/* Instruction */}
      <p className="mt-4 text-xs text-muted-foreground text-center">
        Each rune pulses at its own rhythm. Tap when it's at maximum brightness.
      </p>
    </div>
  );
};
