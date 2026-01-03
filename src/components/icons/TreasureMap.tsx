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
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Scroll/parchment shape */}
    <path d="M4 4c0-1 1-2 2-2h12c1 0 2 1 2 2v16c0 1-1 2-2 2H6c-1 0-2-1-2-2V4z" />
    
    {/* Rolled top edge */}
    <path d="M4 5c0-1.5 1-2.5 2-2.5s2 1 2 2.5" />
    <path d="M20 5c0-1.5-1-2.5-2-2.5s-2 1-2 2.5" />
    
    {/* Dotted path to treasure */}
    <path d="M8 10l2 2" strokeDasharray="2 2" />
    <path d="M10 12l3 1" strokeDasharray="2 2" />
    <path d="M13 13l2 2" strokeDasharray="2 2" />
    
    {/* X marks the spot */}
    <path d="M14 14l3 3" strokeWidth={2.5} />
    <path d="M17 14l-3 3" strokeWidth={2.5} />
  </svg>
));

TreasureMap.displayName = 'TreasureMap';
