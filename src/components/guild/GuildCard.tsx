/**
 * Enhanced GuildCard Component
 * Glossy glass-morphism with particles, shimmer, and animated borders
 */

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CommunityWithMembership } from "@/hooks/useCommunity";
import { GuildEmblem, EmblemIcon } from "./GuildEmblem";
import { GuildBanner, type BannerStyle } from "./GuildBanner";
import { GuildParticles } from "./GuildParticles";
import { Badge } from "@/components/ui/badge";
import { Users, Crown, Shield, Globe, Lock, Sparkles } from "lucide-react";

interface GuildCardProps {
  community: CommunityWithMembership & {
    banner_style?: string;
    emblem_icon?: string;
    frame_style?: string;
    glow_effect?: string;
    particle_effect?: string;
  };
  isSelected?: boolean;
  onClick?: () => void;
  memberCount?: number;
}

export const GuildCard = ({ community, isSelected, onClick, memberCount }: GuildCardProps) => {
  const {
    banner_style = 'cosmic',
    emblem_icon = 'shield',
    frame_style: _frame_style = 'ornate',
    glow_effect = 'pulse',
    particle_effect = 'stars',
  } = community;

  const getRoleIcon = () => {
    switch (community.role) {
      case 'owner':
        return <Crown className="h-3 w-3" />;
      case 'admin':
        return <Shield className="h-3 w-3" />;
      default:
        return <Sparkles className="h-3 w-3" />;
    }
  };

  const getRoleLabel = () => {
    switch (community.role) {
      case 'owner':
        return 'Guild Master';
      case 'admin':
        return 'Officer';
      default:
        return 'Member';
    }
  };

  const getRoleBadgeClass = () => {
    switch (community.role) {
      case 'owner':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'admin':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default:
        return 'bg-primary/20 text-primary border-primary/30';
    }
  };

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-2xl cursor-pointer",
        "guild-glass-intense",
        isSelected && "ring-2 ring-primary shadow-[0_0_30px_hsl(var(--primary)/0.4)]"
      )}
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      style={{
        '--guild-color': community.theme_color,
      } as React.CSSProperties}
    >
      {/* Animated Banner Background */}
      <GuildBanner 
        style={banner_style as BannerStyle} 
        color={community.theme_color}
        className="h-16"
      />
      
      {/* Particle Effects Layer */}
      {particle_effect !== 'none' && (
        <GuildParticles effect={particle_effect} color={community.theme_color} />
      )}
      
      {/* Shimmer Overlay */}
      <div className="guild-shimmer-overlay" />
      
      {/* Content */}
      <div className="relative p-4 -mt-6 z-10">
        <div className="flex items-start gap-4">
          {/* Emblem */}
          <GuildEmblem
            icon={emblem_icon as EmblemIcon}
            color={community.theme_color}
            size="lg"
            glowEffect={glow_effect}
          />
          
          {/* Info */}
          <div className="flex-1 min-w-0 pt-2">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-lg truncate text-foreground">
                {community.name}
              </h3>
              {community.is_public ? (
                <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>
            
            {community.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                {community.description}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                variant="outline" 
                className={cn("text-xs gap-1 border", getRoleBadgeClass())}
              >
                {getRoleIcon()}
                {getRoleLabel()}
              </Badge>
              
              {memberCount !== undefined && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {memberCount} {memberCount === 1 ? 'member' : 'members'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Glossy top edge highlight */}
      <div 
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${community.theme_color}60, transparent)`,
        }}
      />
    </motion.div>
  );
};

// Public guild card for discover tab
interface PublicGuildCardProps {
  community: {
    id: string;
    name: string;
    description: string | null;
    theme_color: string;
    is_public: boolean;
    banner_style?: string;
    emblem_icon?: string;
    particle_effect?: string;
  };
  onClick?: () => void;
  isJoining?: boolean;
}

export const PublicGuildCard = ({ community, onClick, isJoining }: PublicGuildCardProps) => {
  const {
    banner_style = 'cosmic',
    emblem_icon = 'shield',
    particle_effect = 'stars',
  } = community;

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-2xl cursor-pointer",
        "guild-glass",
        isJoining && "opacity-70 pointer-events-none"
      )}
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      style={{
        '--guild-color': community.theme_color,
      } as React.CSSProperties}
    >
      {/* Banner */}
      <GuildBanner 
        style={banner_style as BannerStyle} 
        color={community.theme_color}
        className="h-12"
      />
      
      {/* Particles */}
      {particle_effect !== 'none' && (
        <GuildParticles effect={particle_effect} color={community.theme_color} intensity="low" />
      )}
      
      {/* Shimmer */}
      <div className="guild-shimmer-overlay" />
      
      {/* Content */}
      <div className="relative p-4 -mt-4 z-10">
        <div className="flex items-center gap-3">
          <GuildEmblem
            icon={emblem_icon as EmblemIcon}
            color={community.theme_color}
            size="md"
            animated={false}
          />
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{community.name}</h3>
            {community.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {community.description}
              </p>
            )}
          </div>

          <Badge variant="secondary" className="flex-shrink-0 gap-1">
            <Globe className="h-3 w-3" />
            Join
          </Badge>
        </div>
      </div>
    </motion.div>
  );
};

export default GuildCard;
