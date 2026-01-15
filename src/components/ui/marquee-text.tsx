import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MarqueeTextProps {
  text: string;
  className?: string;
  speed?: number; // pixels per second
  pauseDuration?: number; // ms to pause at start/end
}

export function MarqueeText({ 
  text, 
  className,
  speed = 30,
  pauseDuration = 2000 
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
          setScrollDistance(textWidth - containerWidth + 20); // +20 for padding
        }
      }
    };
    
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [text]);

  const duration = scrollDistance / speed;

  if (!isOverflowing) {
    return (
      <div ref={containerRef} className={cn("overflow-hidden", className)}>
        <span ref={textRef} className="whitespace-nowrap">{text}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("overflow-hidden", className)}>
      <motion.span
        ref={textRef}
        className="whitespace-nowrap inline-block"
        animate={{
          x: [0, -scrollDistance, -scrollDistance, 0, 0],
        }}
        transition={{
          duration: duration + (pauseDuration * 2 / 1000),
          times: [0, 0.4, 0.5, 0.9, 1], // pause at ends
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {text}
      </motion.span>
    </div>
  );
}
