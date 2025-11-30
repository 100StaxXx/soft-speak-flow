import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CosmiqCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: "purple" | "pink" | "blue" | "gold";
  intensity?: "subtle" | "medium" | "strong";
}

export const CosmiqCard = ({ 
  children, 
  className,
  glowColor = "purple",
  intensity = "medium"
}: CosmiqCardProps) => {
  const glowColorMap = {
    purple: "hsl(var(--cosmiq-glow))",
    pink: "hsl(var(--nebula-pink))",
    blue: "hsl(var(--celestial-blue))",
    gold: "hsl(var(--stardust-gold))",
  };

  const intensityMap = {
    subtle: "0.1",
    medium: "0.2",
    strong: "0.3",
  };

  return (
    <div
      className={cn(
        "cosmiq-glass relative overflow-hidden rounded-xl p-6",
        "transition-all duration-300",
        "hover:scale-[1.01] active:scale-[0.99]",
        className
      )}
      style={{
        borderColor: `${glowColorMap[glowColor]}/${intensityMap[intensity]}`,
      }}
    >
      {/* Subtle constellation pattern overlay */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="constellation" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="1" fill="white" />
              <circle cx="50" cy="30" r="1" fill="white" />
              <circle cx="80" cy="20" r="1" fill="white" />
              <circle cx="30" cy="70" r="1" fill="white" />
              <circle cx="70" cy="80" r="1" fill="white" />
              <line x1="10" y1="10" x2="50" y2="30" stroke="white" strokeWidth="0.5" opacity="0.3" />
              <line x1="50" y1="30" x2="80" y2="20" stroke="white" strokeWidth="0.5" opacity="0.3" />
              <line x1="30" y1="70" x2="70" y2="80" stroke="white" strokeWidth="0.5" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#constellation)" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};
