/**
 * GuildOnlineBanner Component
 * Shows how many guild members are currently online
 */

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { GuildMemberPresence } from "@/hooks/useGuildPresence";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface GuildOnlineBannerProps {
  onlineMembers: GuildMemberPresence[];
  isConnected: boolean;
  className?: string;
}

export const GuildOnlineBanner = ({
  onlineMembers,
  isConnected,
  className,
}: GuildOnlineBannerProps) => {
  if (!isConnected || onlineMembers.length === 0) return null;

  const displayMembers = onlineMembers.slice(0, 5);
  const extraCount = onlineMembers.length - 5;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-3 px-4 py-2 rounded-full",
        "bg-green-500/10 border border-green-500/30",
        "backdrop-blur-sm",
        className
      )}
    >
      {/* Pulsing indicator */}
      <div className="relative">
        <div className="h-2 w-2 rounded-full bg-green-500" />
        <motion.div
          className="absolute inset-0 h-2 w-2 rounded-full bg-green-500"
          animate={{
            scale: [1, 2, 1],
            opacity: [1, 0, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
          }}
        />
      </div>

      {/* Stacked avatars */}
      <div className="flex -space-x-2">
        {displayMembers.map((member, index) => (
          <motion.div
            key={member.userId}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <Avatar className="h-6 w-6 border-2 border-background">
              <AvatarImage src={member.companionImageUrl} />
              <AvatarFallback className="text-xs bg-green-500/20">
                {member.displayName?.slice(0, 1).toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
          </motion.div>
        ))}
        {extraCount > 0 && (
          <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
            <span className="text-xs font-medium">+{extraCount}</span>
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex items-center gap-1.5 text-sm">
        <Sparkles className="h-3.5 w-3.5 text-green-400" />
        <span className="text-green-400 font-medium">
          {onlineMembers.length} online
        </span>
      </div>
    </motion.div>
  );
};
