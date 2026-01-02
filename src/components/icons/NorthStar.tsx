interface NorthStarProps {
  className?: string;
  size?: number;
}

export const NorthStar = ({ className, size = 24 }: NorthStarProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    {/* Cardinal points (N, S, E, W) - Bold elongated triangles */}
    <path d="M12 0.5L14 10L12 12L10 10Z" />
    <path d="M12 23.5L10 14L12 12L14 14Z" />
    <path d="M23.5 12L14 14L12 12L14 10Z" />
    <path d="M0.5 12L10 10L12 12L10 14Z" />
    
    {/* Ordinal points (NE, SE, SW, NW) - Thinner diagonal triangles */}
    <path d="M20.1 3.9L13.4 10.6L12 12L13.4 11L14 10.6Z" opacity="0.9" />
    <path d="M20.1 20.1L13.4 13.4L12 12L13.4 13L14 13.4Z" opacity="0.9" />
    <path d="M3.9 20.1L10.6 13.4L12 12L10.6 13L10 13.4Z" opacity="0.9" />
    <path d="M3.9 3.9L10.6 10.6L12 12L10.6 11L10 10.6Z" opacity="0.9" />
    
    {/* Center accent circle */}
    <circle cx="12" cy="12" r="1.5" />
  </svg>
);
