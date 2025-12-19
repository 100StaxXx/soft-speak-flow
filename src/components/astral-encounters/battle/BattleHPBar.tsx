import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Skull } from 'lucide-react';

interface BattleHPBarProps {
  currentHP: number;
  maxHP: number;
  isPlayer: boolean;
  label?: string;
  showNumbers?: boolean;
}

export const BattleHPBar = memo(function BattleHPBar({
  currentHP,
  maxHP,
  isPlayer,
  label,
  showNumbers = true,
}: BattleHPBarProps) {
  const [displayHP, setDisplayHP] = useState(currentHP);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const hpPercent = Math.max(0, (currentHP / maxHP) * 100);
  const isDefeated = currentHP <= 0;
  const isLowHP = hpPercent < 25;
  const isCriticalHP = hpPercent < 10;
  
  // Animate HP changes
  useEffect(() => {
    if (currentHP !== displayHP) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayHP(currentHP);
        setIsAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentHP, displayHP]);
  
  // Get bar color based on HP level
  const getBarColor = () => {
    if (isDefeated) return 'bg-gray-500';
    if (isPlayer) {
      if (isCriticalHP) return 'bg-red-600 animate-pulse';
      if (isLowHP) return 'bg-orange-500';
      return 'bg-green-500';
    } else {
      // Adversary - purple/red theme
      if (isCriticalHP) return 'bg-purple-400';
      if (isLowHP) return 'bg-purple-500';
      return 'bg-purple-600';
    }
  };
  
  const getGlowColor = () => {
    if (isDefeated) return '';
    if (isPlayer) {
      if (isCriticalHP) return 'shadow-[0_0_10px_rgba(220,38,38,0.6)]';
      if (isLowHP) return 'shadow-[0_0_8px_rgba(249,115,22,0.5)]';
      return 'shadow-[0_0_6px_rgba(34,197,94,0.4)]';
    } else {
      return 'shadow-[0_0_8px_rgba(147,51,234,0.5)]';
    }
  };
  
  return (
    <div className={`flex items-center gap-2 ${isPlayer ? 'flex-row' : 'flex-row-reverse'}`}>
      {/* Icon */}
      <div className={`flex-shrink-0 ${isDefeated ? 'opacity-50' : ''}`}>
        {isDefeated ? (
          <Skull className="w-4 h-4 text-gray-400" />
        ) : (
          <Heart 
            className={`w-4 h-4 ${isPlayer ? 'text-green-500' : 'text-purple-500'} ${
              isLowHP && !isDefeated ? 'animate-pulse' : ''
            }`} 
            fill={isPlayer ? 'rgb(34,197,94)' : 'rgb(147,51,234)'}
          />
        )}
      </div>
      
      {/* HP Bar Container */}
      <div className="flex-1 flex flex-col gap-0.5">
        {/* Label */}
        {label && (
          <span className={`text-[10px] font-medium ${
            isPlayer ? 'text-left' : 'text-right'
          } text-muted-foreground truncate`}>
            {label}
          </span>
        )}
        
        {/* Bar */}
        <div 
          className={`relative h-4 rounded-full overflow-hidden bg-muted/50 border border-border/50 ${getGlowColor()}`}
        >
          {/* Background glow for low HP */}
          <AnimatePresence>
            {isLowHP && !isDefeated && isPlayer && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, repeat: Infinity }}
                className="absolute inset-0 bg-red-500/20"
              />
            )}
          </AnimatePresence>
          
          {/* HP Fill */}
          <motion.div
            className={`absolute inset-y-0 ${isPlayer ? 'left-0' : 'right-0'} ${getBarColor()}`}
            initial={false}
            animate={{ 
              width: `${hpPercent}%`,
            }}
            transition={{ 
              duration: 0.4, 
              ease: [0.4, 0, 0.2, 1] 
            }}
          >
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
          </motion.div>
          
          {/* Damage flash */}
          <AnimatePresence>
            {isAnimating && currentHP < displayHP && (
              <motion.div
                initial={{ opacity: 0.8 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 bg-red-500/40"
              />
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* HP Numbers */}
      {showNumbers && (
        <div className={`flex-shrink-0 min-w-[50px] ${isPlayer ? 'text-right' : 'text-left'}`}>
          <motion.span
            key={currentHP}
            initial={{ scale: 1.2, color: currentHP < displayHP ? '#ef4444' : '#22c55e' }}
            animate={{ scale: 1, color: 'inherit' }}
            className="text-xs font-mono font-bold text-foreground"
          >
            {Math.max(0, currentHP)}
          </motion.span>
          <span className="text-xs font-mono text-muted-foreground">/{maxHP}</span>
        </div>
      )}
    </div>
  );
});
