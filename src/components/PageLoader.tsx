import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PageLoaderProps {
  message?: string;
  children?: ReactNode;
}

/**
 * Universal page loader with smooth cosmic animation
 * Use this instead of basic spinners for full-page loading states
 */
export const PageLoader = ({ message = "Loading...", children }: PageLoaderProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-background flex items-center justify-center"
    >
      {children || (
        <div className="text-center space-y-4">
          {/* Cosmic pulse loader */}
          <motion.div
            className="relative mx-auto w-16 h-16"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Outer ring */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-primary/30"
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            {/* Middle ring */}
            <motion.div
              className="absolute inset-2 rounded-full border-2 border-primary/50"
              animate={{ 
                scale: [1, 1.15, 1],
                opacity: [0.5, 0.8, 0.5]
              }}
              transition={{ 
                duration: 2,
                delay: 0.2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            {/* Inner core */}
            <motion.div
              className="absolute inset-4 rounded-full bg-gradient-to-br from-primary to-purple-500"
              animate={{ 
                scale: [1, 1.1, 1],
              }}
              transition={{ 
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </motion.div>
          
          {/* Message with fade */}
          <motion.p
            className="text-muted-foreground text-sm"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {message}
          </motion.p>
        </div>
      )}
    </motion.div>
  );
};

/**
 * Wrapper for smooth content reveal when data loads
 */
export const ContentReveal = ({ 
  children, 
  isLoading,
  skeleton 
}: { 
  children: ReactNode; 
  isLoading: boolean;
  skeleton?: ReactNode;
}) => {
  return (
    <div className="relative">
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {skeleton}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {children}
        </motion.div>
      )}
    </div>
  );
};
