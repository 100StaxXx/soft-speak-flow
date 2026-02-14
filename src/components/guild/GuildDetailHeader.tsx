/**
 * GuildDetailHeader Component
 * Cinematic header for guild detail view with parallax banner and animated emblem
 */

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { GuildEmblem, EmblemIcon } from "./GuildEmblem";
import { GuildBanner, BannerStyle } from "./GuildBanner";
import { GuildParticles } from "./GuildParticles";
import { ArrowLeft, LogOut, Settings, Users, Loader2 } from "lucide-react";

interface GuildDetailHeaderProps {
  name: string;
  description?: string | null;
  themeColor: string;
  bannerStyle?: string;
  emblemIcon?: string;
  glowEffect?: string;
  particleEffect?: string;
  isOwner: boolean;
  onBack: () => void;
  onLeave?: () => void;
  onSettings?: () => void;
  isLeaving?: boolean;
  memberCount?: number;
}

export const GuildDetailHeader = ({
  name,
  description,
  themeColor,
  bannerStyle = 'cosmic',
  emblemIcon = 'shield',
  glowEffect = 'pulse',
  particleEffect = 'stars',
  isOwner,
  onBack,
  onLeave,
  onSettings,
  isLeaving,
  memberCount,
}: GuildDetailHeaderProps) => {
  return (
    <div className="relative">
      {/* Banner */}
      <div className="relative h-32 overflow-hidden">
        <GuildBanner
          style={bannerStyle as BannerStyle}
          color={themeColor}
          className="h-full"
        />
        
        {/* Particles */}
        {particleEffect !== 'none' && (
          <GuildParticles 
            effect={particleEffect} 
            color={themeColor}
            intensity="high"
          />
        )}
        
        {/* Navigation Buttons */}
        <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 right-4 flex justify-between z-20">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 backdrop-blur-sm bg-black/20"
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex gap-2">
            {isOwner && onSettings && (
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 backdrop-blur-sm bg-black/20"
                onClick={onSettings}
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}
            
            {!isOwner && onLeave && (
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 backdrop-blur-sm bg-black/20"
                onClick={onLeave}
                disabled={isLeaving}
              >
                {isLeaving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <LogOut className="h-5 w-5" />
                )}
              </Button>
            )}
          </div>
        </div>
        
        {/* Gradient fade */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </div>
      
      {/* Guild Info Card */}
      <div className="relative max-w-2xl mx-auto px-4 -mt-16 z-10">
        <motion.div 
          className="guild-glass-intense rounded-2xl p-5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-start gap-4">
            {/* Large Emblem */}
            <GuildEmblem
              icon={emblemIcon as EmblemIcon}
              color={themeColor}
              size="xl"
              glowEffect={glowEffect}
            />
            
            {/* Guild Info */}
            <div className="flex-1 min-w-0 pt-2">
              <h1 className="text-2xl font-bold text-foreground mb-1">
                {name}
              </h1>
              
              {description && (
                <p className="text-muted-foreground mb-3">
                  {description}
                </p>
              )}
              
              {/* Stats Row */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-sm">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="font-medium">{memberCount ?? '...'}</span>
                  <span className="text-muted-foreground">members</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default GuildDetailHeader;
