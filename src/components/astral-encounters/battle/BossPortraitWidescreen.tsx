import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skull } from 'lucide-react';

interface BossPortraitWidescreenProps {
  imageUrl?: string;
  name: string;
  hpPercent: number;
  isDefeated: boolean;
}

export const BossPortraitWidescreen = memo(function BossPortraitWidescreen({
  imageUrl,
  name,
  hpPercent,
  isDefeated,
}: BossPortraitWidescreenProps) {
  // Determine crack level based on HP
  const crackLevel = useMemo(() => {
    if (isDefeated) return 4;
    if (hpPercent <= 25) return 3;
    if (hpPercent <= 50) return 2;
    if (hpPercent <= 75) return 1;
    return 0;
  }, [hpPercent, isDefeated]);

  // Generate crack SVG paths for widescreen format
  const crackPaths = useMemo(() => {
    const paths: string[] = [];
    
    if (crackLevel >= 1) {
      paths.push('M50,0 L48,25 L52,50 L47,75 L50,100');
      paths.push('M25,0 L28,30 L22,60');
    }
    if (crackLevel >= 2) {
      paths.push('M0,50 L20,48 L40,52 L60,49 L80,51 L100,50');
      paths.push('M75,0 L72,35 L78,70');
    }
    if (crackLevel >= 3) {
      paths.push('M10,0 L15,40 L8,80 L12,100');
      paths.push('M90,0 L85,45 L92,90');
      paths.push('M0,25 L30,28 L60,24 L100,27');
      paths.push('M0,75 L25,72 L50,78 L75,74 L100,76');
    }
    
    return paths;
  }, [crackLevel]);

  return (
    <div className="relative w-full aspect-[2.5/1] max-h-[140px] overflow-hidden rounded-xl">
      {/* Main Image Container */}
      <motion.div
        className={`
          relative w-full h-full
          ${isDefeated ? 'grayscale' : ''}
        `}
        animate={isDefeated ? {
          scale: [1, 0.98, 1.02, 0.95],
          opacity: [1, 1, 0.8, 0],
        } : {}}
        transition={{ duration: 0.8 }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-950 via-purple-900 to-purple-700 flex items-center justify-center">
            <div className="flex flex-col items-center gap-1.5">
              <Skull className="w-10 h-10 text-purple-200/85" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-200/70">
                Adversary
              </span>
            </div>
          </div>
        )}

        {/* Cinematic gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/30 via-transparent to-background/30" />

        {/* Damage overlay - gets darker and redder as HP drops */}
        <motion.div
          className="absolute inset-0 bg-red-900"
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: isDefeated ? 0.7 : Math.max(0, (100 - hpPercent) / 150)
          }}
          transition={{ duration: 0.3 }}
        />

        {/* Low HP pulse effect */}
        <AnimatePresence>
          {hpPercent <= 25 && !isDefeated && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="absolute inset-0 bg-red-500/40"
            />
          )}
        </AnimatePresence>

        {/* Vignette effect for boss drama */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.5) 100%)',
          }}
        />
      </motion.div>

      {/* Crack Overlay SVG */}
      <AnimatePresence>
        {crackLevel > 0 && (
          <motion.svg
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {crackPaths.map((path, index) => (
              <motion.path
                key={index}
                d={path}
                fill="none"
                stroke="rgba(0,0,0,0.9)"
                strokeWidth="1.5"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ 
                  duration: 0.4, 
                  delay: index * 0.08,
                  ease: 'easeOut'
                }}
              />
            ))}
            {/* White highlight for crack depth */}
            {crackPaths.map((path, index) => (
              <motion.path
                key={`highlight-${index}`}
                d={path}
                fill="none"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="0.8"
                strokeLinecap="round"
                transform="translate(0.5, 0.5)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.6 }}
                transition={{ 
                  duration: 0.4, 
                  delay: index * 0.08 + 0.1,
                  ease: 'easeOut'
                }}
              />
            ))}
          </motion.svg>
        )}
      </AnimatePresence>

      {/* Shatter fragments on defeat */}
      <AnimatePresence>
        {isDefeated && (
          <>
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-3 h-3 bg-purple-500/50 rounded-sm"
                style={{
                  left: `${(i % 4) * 25 + 12}%`,
                  top: `${Math.floor(i / 4) * 33 + 16}%`,
                }}
                initial={{ scale: 1, opacity: 1 }}
                animate={{ 
                  x: (Math.random() - 0.5) * 150,
                  y: (Math.random() - 0.5) * 100 + 50,
                  scale: 0,
                  opacity: 0,
                  rotate: Math.random() * 360,
                }}
                transition={{ 
                  duration: 0.7,
                  delay: 0.1 + i * 0.03,
                  ease: 'easeOut'
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Border glow effect */}
      <div className="absolute inset-0 rounded-xl border border-purple-500/30 pointer-events-none" />
      <motion.div 
        className="absolute inset-0 rounded-xl pointer-events-none"
        animate={hpPercent <= 25 && !isDefeated ? {
          boxShadow: [
            'inset 0 0 15px rgba(239,68,68,0.2)',
            'inset 0 0 25px rgba(239,68,68,0.4)',
            'inset 0 0 15px rgba(239,68,68,0.2)',
          ]
        } : {
          boxShadow: 'inset 0 0 15px rgba(147,51,234,0.2)'
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    </div>
  );
});
