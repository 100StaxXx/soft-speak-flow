/**
 * GuildBanner Component
 * Animated gradient banner backgrounds for guilds
 */

import { cn } from "@/lib/utils";

export type BannerStyle = 'cosmic' | 'flames' | 'crystal' | 'lightning' | 'nature' | 'void' | 'aurora' | 'nebula';

interface GuildBannerProps {
  style: BannerStyle;
  color: string;
  className?: string;
  animated?: boolean;
}

export const GuildBanner = ({
  style,
  color,
  className,
  animated = true,
}: GuildBannerProps) => {
  const getBannerClass = () => {
    switch (style) {
      case 'cosmic':
        return 'guild-banner-cosmic';
      case 'flames':
        return 'guild-banner-flames';
      case 'crystal':
        return 'guild-banner-crystal';
      case 'lightning':
        return 'guild-banner-lightning';
      case 'nature':
        return 'guild-banner-nature';
      case 'void':
        return 'guild-banner-void';
      case 'aurora':
        return 'guild-banner-aurora';
      case 'nebula':
        return 'guild-banner-nebula';
      default:
        return 'guild-banner-cosmic';
    }
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        getBannerClass(),
        animated && "animate-guild-banner-flow",
        className
      )}
      style={{
        '--guild-color': color,
      } as React.CSSProperties}
    >
      {/* Aurora wave overlay for cosmic/aurora effects */}
      {(style === 'cosmic' || style === 'aurora') && (
        <div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-aurora-wave"
        />
      )}
      
      {/* Lightning flash for lightning style */}
      {style === 'lightning' && (
        <div 
          className="absolute inset-0 bg-white/20 animate-lightning-flash pointer-events-none"
        />
      )}
      
      {/* Crystal sparkle for crystal style */}
      {style === 'crystal' && (
        <>
          <div className="absolute top-2 left-4 w-2 h-2 bg-white rounded-full animate-crystal-sparkle" style={{ animationDelay: '0s' }} />
          <div className="absolute top-4 right-6 w-1.5 h-1.5 bg-white rounded-full animate-crystal-sparkle" style={{ animationDelay: '0.5s' }} />
          <div className="absolute bottom-3 left-1/3 w-1 h-1 bg-white rounded-full animate-crystal-sparkle" style={{ animationDelay: '1s' }} />
        </>
      )}
      
      {/* Gradient fade at bottom */}
      <div 
        className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/80 to-transparent"
      />
    </div>
  );
};

export default GuildBanner;
