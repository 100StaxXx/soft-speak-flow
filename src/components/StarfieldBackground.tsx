import { useEffect, useState } from "react";

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  animationDelay: number;
  animationDuration: number;
}

interface Constellation {
  id: string;
  points: { x: number; y: number }[];
  x: number;
  y: number;
  opacity: number;
}

export const StarfieldBackground = () => {
  const [stars, setStars] = useState<Star[]>([]);
  const [constellations, setConstellations] = useState<Constellation[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    // Generate 80 random stars
    const generatedStars: Star[] = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1, // 1-3px
      opacity: Math.random() * 0.5 + 0.3, // 0.3-0.8
      animationDelay: Math.random() * 3,
      animationDuration: Math.random() * 2 + 2, // 2-4s
    }));

    setStars(generatedStars);

    // Zodiac constellation patterns (simplified)
    const zodiacPatterns = [
      { id: 'aries', points: [{x:0,y:0},{x:15,y:-5},{x:25,y:5},{x:20,y:15}] },
      { id: 'taurus', points: [{x:0,y:10},{x:10,y:0},{x:20,y:0},{x:30,y:10},{x:15,y:20}] },
      { id: 'gemini', points: [{x:0,y:0},{x:0,y:25},{x:15,y:25},{x:15,y:0}] },
      { id: 'cancer', points: [{x:10,y:0},{x:0,y:10},{x:5,y:20},{x:15,y:15},{x:20,y:5}] },
      { id: 'leo', points: [{x:0,y:15},{x:10,y:5},{x:20,y:0},{x:25,y:10},{x:15,y:20}] },
      { id: 'virgo', points: [{x:0,y:0},{x:5,y:15},{x:15,y:20},{x:20,y:10},{x:25,y:0}] },
    ];

    // Generate 3-4 random constellations
    const generatedConstellations: Constellation[] = Array.from({ length: 4 }, (_, i) => {
      const pattern = zodiacPatterns[Math.floor(Math.random() * zodiacPatterns.length)];
      return {
        id: `${pattern.id}-${i}`,
        points: pattern.points,
        x: Math.random() * 80 + 10, // Keep away from edges
        y: Math.random() * 80 + 10,
        opacity: Math.random() * 0.2 + 0.15, // 0.15-0.35
      };
    });

    setConstellations(generatedConstellations);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Deep space gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--deep-space))] via-[hsl(var(--midnight))] to-[hsl(var(--obsidian))]" />
      
      {/* Nebula gradients */}
      <div className="absolute inset-0 opacity-30">
        <div 
          className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px] bg-gradient-to-br from-[hsl(var(--nebula-pink))] to-transparent"
          style={{ animation: prefersReducedMotion ? 'none' : 'nebula-shift 20s ease-in-out infinite' }}
        />
        <div 
          className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[100px] bg-gradient-to-tr from-[hsl(var(--celestial-blue))] to-transparent"
          style={{ animation: prefersReducedMotion ? 'none' : 'nebula-shift 25s ease-in-out infinite reverse' }}
        />
        <div 
          className="absolute top-1/2 left-1/2 w-[400px] h-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px] bg-gradient-to-br from-[hsl(var(--cosmic-glow))] to-transparent"
          style={{ animation: prefersReducedMotion ? 'none' : 'nebula-shift 30s ease-in-out infinite' }}
        />
      </div>

      {/* Zodiac constellations */}
      {constellations.map((constellation) => (
        <svg
          key={constellation.id}
          className="absolute"
          style={{
            left: `${constellation.x}%`,
            top: `${constellation.y}%`,
            width: '120px',
            height: '120px',
            opacity: constellation.opacity,
          }}
        >
          {/* Constellation lines */}
          {constellation.points.map((point, i) => {
            if (i === 0) return null;
            const prevPoint = constellation.points[i - 1];
            return (
              <line
                key={`line-${i}`}
                x1={prevPoint.x * 3}
                y1={prevPoint.y * 3}
                x2={point.x * 3}
                y2={point.y * 3}
                stroke="rgba(255, 255, 255, 0.4)"
                strokeWidth="1"
              />
            );
          })}
          {/* Constellation stars */}
          {constellation.points.map((point, i) => (
            <circle
              key={`star-${i}`}
              cx={point.x * 3}
              cy={point.y * 3}
              r="2"
              fill="white"
              opacity="0.6"
            />
          ))}
        </svg>
      ))}

      {/* Twinkling stars */}
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animation: prefersReducedMotion 
              ? 'none' 
              : `twinkle ${star.animationDuration}s ease-in-out ${star.animationDelay}s infinite`,
            boxShadow: `0 0 ${star.size * 2}px rgba(255, 255, 255, ${star.opacity})`,
          }}
        />
      ))}

      {/* Occasional shooting star */}
      {!prefersReducedMotion && (
        <div
          className="absolute w-[2px] h-[2px] bg-white rounded-full"
          style={{
            animation: 'shooting-star 3s ease-out 5s infinite',
            boxShadow: '0 0 4px 2px rgba(255, 255, 255, 0.8)',
          }}
        />
      )}
    </div>
  );
};
