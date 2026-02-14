import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PhaseSegment {
  name: string;
  progress: number; // 0-100 within this phase
  isComplete: boolean;
  isCurrent: boolean;
}

interface PhaseProgressRingProps {
  phases: PhaseSegment[];
  overallProgress: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeConfig = {
  sm: { outer: 64, stroke: 6, inner: 40, fontSize: 'text-xs' },
  md: { outer: 80, stroke: 8, inner: 52, fontSize: 'text-sm' },
  lg: { outer: 100, stroke: 10, inner: 68, fontSize: 'text-base' },
};

export function PhaseProgressRing({
  phases,
  overallProgress,
  size = 'md',
  className,
}: PhaseProgressRingProps) {
  const { outer, stroke, fontSize } = sizeConfig[size];
  const radius = (outer - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = outer / 2;

  // Calculate segment angles (each phase gets equal space)
  const segments = useMemo(() => {
    if (phases.length === 0) return [];
    
    const gapAngle = 4; // degrees between segments
    const totalGapAngle = gapAngle * phases.length;
    const availableAngle = 360 - totalGapAngle;
    const segmentAngle = availableAngle / phases.length;
    
    let currentAngle = -90; // Start from top
    
    return phases.map((phase, index) => {
      const startAngle = currentAngle;
      const endAngle = startAngle + segmentAngle;
      currentAngle = endAngle + gapAngle;
      
      // Calculate arc path
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      
      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);
      
      const largeArc = segmentAngle > 180 ? 1 : 0;
      
      return {
        ...phase,
        path: `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        segmentAngle,
        index,
      };
    });
  }, [phases, radius, center]);

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={outer}
        height={outer}
        viewBox={`0 0 ${outer} ${outer}`}
        className="transform -rotate-90"
      >
        {/* Background rings for each segment */}
        {segments.map((segment) => (
          <path
            key={`bg-${segment.index}`}
            d={segment.path}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        ))}
        
        {/* Progress for each segment */}
        {segments.map((segment) => {
          const segmentLength = (segment.segmentAngle / 360) * circumference;
          const progressLength = (segment.progress / 100) * segmentLength;
          
          return (
            <motion.path
              key={`progress-${segment.index}`}
              d={segment.path}
              fill="none"
              stroke={
                segment.isCurrent
                  ? 'hsl(var(--primary))'
                  : segment.isComplete
                  ? 'hsl(var(--primary) / 0.7)'
                  : 'hsl(var(--muted-foreground) / 0.3)'
              }
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${progressLength} ${segmentLength - progressLength}`}
              initial={{ strokeDashoffset: segmentLength }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.8, delay: segment.index * 0.1, ease: 'easeOut' }}
            />
          );
        })}
        
        {/* Current phase indicator dot */}
        {segments.map((segment) => {
          if (!segment.isCurrent) return null;
          
          // Position at the progress point of current segment
          const segmentStartAngle = -90 + segment.index * (360 / phases.length);
          const progressAngle = segmentStartAngle + (segment.progress / 100) * (360 / phases.length);
          const rad = (progressAngle * Math.PI) / 180;
          const dotX = center + radius * Math.cos(rad);
          const dotY = center + radius * Math.sin(rad);
          
          return (
            <motion.circle
              key={`dot-${segment.index}`}
              cx={dotX}
              cy={dotY}
              r={stroke / 2 + 2}
              fill="hsl(var(--primary))"
              className="drop-shadow-[0_0_6px_hsl(var(--primary))]"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.5 }}
            />
          );
        })}
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={cn('font-bold', fontSize)}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          {Math.round(overallProgress)}%
        </motion.span>
        <span className="text-[8px] text-muted-foreground uppercase tracking-wider">
          Complete
        </span>
      </div>
    </div>
  );
}
