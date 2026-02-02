import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MarqueeTextProps {
  text: string;
  className?: string;
  speed?: number; // pixels per second
  pauseDuration?: number; // ms to pause at start/end
  initialDelay?: number; // ms to pause before first scroll
}

export function MarqueeText({ 
  text, 
  className,
  speed = 30,
  pauseDuration = 2000,
  initialDelay = 3000
}: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [scrollDistance, setScrollDistance] = useState(0);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const textWidth = textRef.current.scrollWidth;
        const overflow = textWidth > containerWidth;
        setIsOverflowing(overflow);
        if (overflow) {
          setScrollDistance(textWidth - containerWidth + 20);
        }
      }
    };
    
    // Delay initial check to allow layout to settle
    const timeoutId = setTimeout(checkOverflow, 100);
    
    // Use ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(checkOverflow);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [text]);

  // Calculate durations
  const scrollDuration = scrollDistance / speed;
  const totalDuration = (initialDelay / 1000) + scrollDuration + (pauseDuration * 2 / 1000);
  
  // Calculate time proportions for the animation keyframes
  const initialPauseProportion = (initialDelay / 1000) / totalDuration;
  const scrollProportion = (scrollDuration / 2) / totalDuration;
  const endPauseProportion = (pauseDuration / 1000) / totalDuration;

  return (
    <div ref={containerRef} className={cn("overflow-hidden", className)}>
      <motion.span
        ref={textRef}
        className="whitespace-nowrap inline-block"
        animate={isOverflowing ? {
          x: [0, 0, -scrollDistance, -scrollDistance, 0, 0],
        } : { x: 0 }}
        transition={isOverflowing ? {
          duration: totalDuration,
          times: [
            0,
            initialPauseProportion,
            initialPauseProportion + scrollProportion,
            initialPauseProportion + scrollProportion + endPauseProportion,
            initialPauseProportion + scrollProportion * 2 + endPauseProportion,
            1
          ],
          repeat: Infinity,
          ease: "linear",
        } : { duration: 0 }}
      >
        {text}
      </motion.span>
    </div>
  );
}
