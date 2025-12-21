/**
 * GuildPresenceIndicator Component
 * Shows online status indicator for guild members
 */

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface GuildPresenceIndicatorProps {
  isOnline: boolean;
  status?: 'online' | 'away' | 'busy';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const GuildPresenceIndicator = ({
  isOnline,
  status = 'online',
  size = 'md',
  className,
}: GuildPresenceIndicatorProps) => {
  if (!isOnline) return null;

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
  };

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={cn(
        "rounded-full border-2 border-background",
        sizeClasses[size],
        statusColors[status],
        className
      )}
    >
      <motion.div
        className={cn(
          "absolute inset-0 rounded-full",
          statusColors[status]
        )}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [1, 0, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  );
};
