import { memo } from "react";

interface TreasureMapProps {
  size?: number;
  className?: string;
}

export const TreasureMap = memo(({ size = 24, className = "" }: TreasureMapProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Rolled scroll/map shape */}
    <path d="M4 4c0-1 1-2 2-2h12c1 0 2 1 2 2v16c0 1-1 2-2 2H6c-1 0-2-1-2-2V4z" />
    
    {/* Scroll curl left */}
    <path d="M4 4c0-1.5-1.5-2-2.5-1.5S0 4 0 5c0 .5.5 1 1 1h3" />
    
    {/* Scroll curl right */}
    <path d="M20 20c0 1.5 1.5 2 2.5 1.5S24 20 24 19c0-.5-.5-1-1-1h-3" />
    
    {/* Dotted path on map */}
    <path d="M8 8l2 2" strokeDasharray="2 2" />
    <path d="M10 10l3-1" strokeDasharray="2 2" />
    <path d="M13 9l2 3" strokeDasharray="2 2" />
    
    {/* X marks the spot */}
    <path d="M14 14l2 2" />
    <path d="M16 14l-2 2" />
  </svg>
));

TreasureMap.displayName = "TreasureMap";
