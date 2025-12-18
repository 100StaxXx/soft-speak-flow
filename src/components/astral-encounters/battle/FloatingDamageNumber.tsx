import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DamageEvent } from '@/types/battleSystem';

interface DamageDisplay {
  id: string;
  event: DamageEvent;
  x: number;
  y: number;
}

interface FloatingDamageNumberProps {
  event: DamageEvent | null;
  // Position can be 'player' or 'adversary' to auto-position, or custom coords
  position?: 'player' | 'adversary' | { x: number; y: number };
}

// Standalone component for single damage numbers
export const FloatingDamageNumber = memo(function FloatingDamageNumber({
  event,
  position = 'adversary',
}: FloatingDamageNumberProps) {
  const [key, setKey] = useState(0);
  
  useEffect(() => {
    if (event) {
      setKey(prev => prev + 1);
    }
  }, [event]);
  
  if (!event) return null;
  
  const isPlayerDamage = event.target === 'player';
  
  // Calculate position
  const getPosition = () => {
    if (typeof position === 'object') {
      return position;
    }
    // Default positions based on target
    if (position === 'player' || isPlayerDamage) {
      return { x: 60, y: 20 };
    }
    return { x: 240, y: 20 };
  };
  
  const pos = getPosition();
  
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={key}
        initial={{ 
          opacity: 1, 
          y: 0, 
          scale: 0.5,
          x: pos.x,
        }}
        animate={{ 
          opacity: 0, 
          y: -40, 
          scale: 1.2,
          x: pos.x + (Math.random() - 0.5) * 20,
        }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="absolute pointer-events-none z-50"
        style={{ top: pos.y }}
      >
        <span className={`
          text-lg font-bold font-mono
          ${isPlayerDamage ? 'text-red-500' : 'text-yellow-400'}
          drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]
        `}>
          {isPlayerDamage ? '-' : '+'}{event.amount}
        </span>
      </motion.div>
    </AnimatePresence>
  );
});

// Container component that manages multiple floating damage numbers
interface DamageNumberContainerProps {
  damageEvents: DamageEvent[];
  className?: string;
}

export const DamageNumberContainer = memo(function DamageNumberContainer({
  damageEvents,
  className = '',
}: DamageNumberContainerProps) {
  const [displays, setDisplays] = useState<DamageDisplay[]>([]);
  
  useEffect(() => {
    if (damageEvents.length === 0) return;
    
    const latestEvent = damageEvents[damageEvents.length - 1];
    const id = `${Date.now()}-${Math.random()}`;
    
    // Position based on target
    const isPlayerDamage = latestEvent.target === 'player';
    const baseX = isPlayerDamage ? 50 : 250;
    const baseY = 30;
    
    const newDisplay: DamageDisplay = {
      id,
      event: latestEvent,
      x: baseX + (Math.random() - 0.5) * 30,
      y: baseY + (Math.random() - 0.5) * 20,
    };
    
    setDisplays(prev => [...prev, newDisplay]);
    
    // Remove after animation
    const timer = setTimeout(() => {
      setDisplays(prev => prev.filter(d => d.id !== id));
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [damageEvents.length]);
  
  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
      <AnimatePresence>
        {displays.map(display => (
          <motion.div
            key={display.id}
            initial={{ 
              opacity: 1, 
              y: display.y, 
              x: display.x,
              scale: 0.5,
            }}
            animate={{ 
              opacity: 0, 
              y: display.y - 50, 
              x: display.x + (Math.random() - 0.5) * 20,
              scale: 1.3,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="absolute pointer-events-none"
          >
            <span className={`
              text-xl font-black font-mono
              ${display.event.target === 'player' 
                ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]' 
                : 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]'
              }
            `}>
              {display.event.target === 'player' ? '-' : '+'}{display.event.amount}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});
