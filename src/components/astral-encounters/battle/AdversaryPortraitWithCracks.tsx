import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skull } from 'lucide-react';

interface AdversaryPortraitWithCracksProps {
  imageUrl?: string;
  name: string;
  hpPercent: number;
  isDefeated: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const AdversaryPortraitWithCracks = memo(function AdversaryPortraitWithCracks({
  imageUrl,
  name,
  hpPercent,
  isDefeated,
  size = 'md',
}: AdversaryPortraitWithCracksProps) {
  // Determine crack level based on HP
  const crackLevel = useMemo(() => {
    if (isDefeated) return 4; // Full shatter
    if (hpPercent <= 25) return 3;
    if (hpPercent <= 50) return 2;
    if (hpPercent <= 75) return 1;
    return 0;
  }, [hpPercent, isDefeated]);
  
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
  };
  
  // Generate crack SVG paths based on level
  const crackPaths = useMemo(() => {
    const paths: string[] = [];
    
    if (crackLevel >= 1) {
      paths.push('M50,0 L45,30 L55,50 L48,80 L52,100');
    }
    if (crackLevel >= 2) {
      paths.push('M0,40 L25,45 L50,50 L75,48 L100,45');
      paths.push('M30,0 L35,25 L28,60');
    }
    if (crackLevel >= 3) {
      paths.push('M70,0 L65,35 L72,70 L68,100');
      paths.push('M0,70 L30,65 L60,72 L100,68');
      paths.push('M20,100 L25,70 L18,40');
    }
    
    return paths;
  }, [crackLevel]);
  
  return (
    <div className={`relative ${sizeClasses[size]}`}>
      {/* Portrait Image */}
      <motion.div
        className={`
          relative w-full h-full rounded-lg overflow-hidden
          border-2 border-purple-500/50
          ${isDefeated ? 'grayscale' : ''}
        `}
        animate={isDefeated ? {
          scale: [1, 0.95, 1.05, 0],
          rotate: [0, -5, 5, 0],
          opacity: [1, 1, 1, 0],
        } : {}}
        transition={{ duration: 0.6 }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-950 via-purple-900 to-purple-700 flex items-center justify-center">
            <Skull className="w-7 h-7 text-purple-200/85" />
          </div>
        )}
        
        {/* Damage overlay - gets darker as HP drops */}
        <motion.div
          className="absolute inset-0 bg-red-900"
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: isDefeated ? 0.8 : Math.max(0, (100 - hpPercent) / 200)
          }}
          transition={{ duration: 0.3 }}
        />
        
        {/* Low HP pulse effect */}
        <AnimatePresence>
          {hpPercent <= 25 && !isDefeated && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.2, 0.4, 0.2] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 bg-red-500/30"
            />
          )}
        </AnimatePresence>
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
                stroke="rgba(0,0,0,0.8)"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ 
                  duration: 0.3, 
                  delay: index * 0.1,
                  ease: 'easeOut'
                }}
              />
            ))}
            {/* White highlight for crack effect */}
            {crackPaths.map((path, index) => (
              <motion.path
                key={`highlight-${index}`}
                d={path}
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1"
                strokeLinecap="round"
                transform="translate(1, 1)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.5 }}
                transition={{ 
                  duration: 0.3, 
                  delay: index * 0.1 + 0.1,
                  ease: 'easeOut'
                }}
              />
            ))}
          </motion.svg>
        )}
      </AnimatePresence>
      
      {/* Shatter effect on defeat */}
      <AnimatePresence>
        {isDefeated && (
          <>
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-3 h-3 bg-purple-500/60 rounded-sm"
                initial={{ 
                  x: '50%', 
                  y: '50%',
                  scale: 1,
                  opacity: 1,
                }}
                animate={{ 
                  x: `${50 + (Math.random() - 0.5) * 200}%`,
                  y: `${50 + (Math.random() - 0.5) * 200}%`,
                  scale: 0,
                  opacity: 0,
                  rotate: Math.random() * 360,
                }}
                transition={{ 
                  duration: 0.8,
                  delay: 0.2 + i * 0.05,
                  ease: 'easeOut'
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </div>
  );
});
