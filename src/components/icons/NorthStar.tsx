interface NorthStarProps {
  className?: string;
  size?: number;
}

export const NorthStar = ({ className, size = 24 }: NorthStarProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Main 4-pointed star */}
    <path d="M12 2L12 22" />
    <path d="M2 12L22 12" />
    {/* Diagonal rays */}
    <path d="M4.93 4.93L19.07 19.07" />
    <path d="M19.07 4.93L4.93 19.07" />
    {/* Center diamond accent */}
    <path d="M12 8L14 12L12 16L10 12Z" fill="currentColor" strokeWidth="0" />
  </svg>
);
