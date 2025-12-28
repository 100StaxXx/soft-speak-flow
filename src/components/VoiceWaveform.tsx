import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface VoiceWaveformProps {
  isActive: boolean;
  className?: string;
  barCount?: number;
}

export function VoiceWaveform({ isActive, className, barCount = 5 }: VoiceWaveformProps) {
  const [heights, setHeights] = useState<number[]>(Array(barCount).fill(4));

  useEffect(() => {
    if (!isActive) {
      setHeights(Array(barCount).fill(4));
      return;
    }

    const interval = setInterval(() => {
      setHeights(prev => prev.map(() => 
        isActive ? 4 + Math.random() * 16 : 4
      ));
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, barCount]);

  return (
    <div className={cn("flex items-center justify-center gap-0.5", className)}>
      {heights.map((height, i) => (
        <motion.div
          key={i}
          className="w-0.5 bg-destructive rounded-full"
          initial={{ height: 4 }}
          animate={{ height }}
          transition={{ 
            duration: 0.1, 
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
