import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';

interface AudioReactiveWaveformProps {
  isActive: boolean;
  className?: string;
  barCount?: number;
}

export function AudioReactiveWaveform({ 
  isActive, 
  className, 
  barCount = 7 
}: AudioReactiveWaveformProps) {
  const { audioLevels, startAnalysing, stopAnalysing, isAnalysing } = useAudioAnalyser(barCount);

  useEffect(() => {
    if (isActive && !isAnalysing) {
      startAnalysing();
    } else if (!isActive && isAnalysing) {
      stopAnalysing();
    }
  }, [isActive, isAnalysing, startAnalysing, stopAnalysing]);

  return (
    <div className={cn("flex items-center justify-center gap-0.5", className)}>
      {audioLevels.map((height, i) => (
        <motion.div
          key={i}
          className="w-0.5 bg-destructive rounded-full"
          initial={{ height: 4 }}
          animate={{ height }}
          transition={{ 
            duration: 0.05, 
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}
