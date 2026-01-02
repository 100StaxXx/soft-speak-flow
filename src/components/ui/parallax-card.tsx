import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ParallaxCardProps {
  children: React.ReactNode;
  offset?: number;
  className?: string;
  stiffness?: number;
  damping?: number;
}

export const ParallaxCard = ({ 
  children, 
  offset = 20, 
  stiffness = 100, 
  damping = 30,
  className 
}: ParallaxCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  
  // Transform scroll progress to Y translation
  const yRange = useTransform(scrollYProgress, [0, 1], [offset, -offset]);
  const y = useSpring(yRange, { stiffness, damping });
  
  // Subtle scale effect
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.98, 1, 0.98]);
  const scaleSpring = useSpring(scale, { stiffness: 200, damping: 40 });
  
  // Subtle opacity for depth
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.9, 1, 1, 0.9]);
  
  if (prefersReducedMotion) {
    return <div className={cn(className)}>{children}</div>;
  }
  
  return (
    <motion.div
      ref={ref}
      style={{ y, scale: scaleSpring, opacity }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
};
