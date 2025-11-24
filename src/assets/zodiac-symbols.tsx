import { type ZodiacSign } from "@/utils/zodiacCalculator";

// SVG constellation-style zodiac symbols inspired by astronomical charts
export const ZodiacSymbols: Record<ZodiacSign, JSX.Element> = {
  aries: (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Ram constellation */}
      <path d="M 30,70 Q 35,50 40,45 Q 45,35 50,30 Q 55,35 60,45 Q 65,50 70,70" 
            stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="40" cy="45" r="2" fill="currentColor" />
      <circle cx="50" cy="30" r="2" fill="currentColor" />
      <circle cx="60" cy="45" r="2" fill="currentColor" />
      <path d="M 35,55 Q 30,45 25,35" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M 65,55 Q 70,45 75,35" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  ),
  taurus: (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Bull constellation */}
      <circle cx="50" cy="50" r="15" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M 35,35 Q 30,25 25,20" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M 65,35 Q 70,25 75,20" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="42" cy="50" r="2" fill="currentColor" />
      <circle cx="58" cy="50" r="2" fill="currentColor" />
    </svg>
  ),
  gemini: (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Twins constellation */}
      <line x1="35" y1="20" x2="35" y2="80" stroke="currentColor" strokeWidth="2" />
      <line x1="65" y1="20" x2="65" y2="80" stroke="currentColor" strokeWidth="2" />
      <line x1="35" y1="30" x2="65" y2="30" stroke="currentColor" strokeWidth="1.5" />
      <line x1="35" y1="70" x2="65" y2="70" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="35" cy="25" r="3" fill="currentColor" />
      <circle cx="65" cy="25" r="3" fill="currentColor" />
    </svg>
  ),
  cancer: (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Crab constellation */}
      <path d="M 30,50 Q 40,45 50,50 Q 60,55 70,50" 
            stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="35" cy="45" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="65" cy="45" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M 27,45 Q 20,40 15,35" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M 73,45 Q 80,40 85,35" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  ),
  leo: (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Lion constellation */}
      <circle cx="35" cy="35" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M 45,40 Q 55,35 65,40 Q 70,50 70,60 Q 65,70 55,75" 
            stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="35" cy="35" r="2" fill="currentColor" />
      <circle cx="65" cy="40" r="2" fill="currentColor" />
      <circle cx="70" cy="60" r="2" fill="currentColor" />
    </svg>
  ),
  virgo: (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Maiden constellation */}
      <path d="M 30,20 L 30,70 Q 35,75 40,70 L 40,40" 
            stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M 50,20 L 50,70 Q 55,75 60,70 L 60,40" 
            stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M 70,40 Q 75,50 80,60" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="30" cy="25" r="2" fill="currentColor" />
      <circle cx="50" cy="25" r="2" fill="currentColor" />
    </svg>
  ),
  libra: (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Scales constellation */}
      <line x1="20" y1="50" x2="80" y2="50" stroke="currentColor" strokeWidth="2" />
      <line x1="50" y1="30" x2="50" y2="50" stroke="currentColor" strokeWidth="2" />
      <rect x="25" y="50" width="20" height="15" stroke="currentColor" strokeWidth="2" fill="none" />
      <rect x="55" y="50" width="20" height="15" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="50" cy="30" r="3" fill="currentColor" />
    </svg>
  ),
  scorpio: (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Scorpion constellation */}
      <path d="M 30,50 Q 40,45 50,50 Q 60,55 70,50 Q 75,60 80,70" 
            stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M 75,70 L 85,75 L 80,80" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="35" cy="48" r="2" fill="currentColor" />
      <circle cx="50" cy="50" r="2" fill="currentColor" />
      <circle cx="65" cy="48" r="2" fill="currentColor" />
    </svg>
  ),
  sagittarius: (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Archer constellation */}
      <line x1="20" y1="80" x2="80" y2="20" stroke="currentColor" strokeWidth="2" />
      <path d="M 70,20 L 80,20 L 80,30" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="40" y1="60" x2="30" y2="70" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="50" r="2" fill="currentColor" />
      <circle cx="65" cy="35" r="2" fill="currentColor" />
    </svg>
  ),
  capricorn: (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Goat constellation */}
      <path d="M 40,30 Q 45,25 50,30 Q 55,40 60,50 Q 65,60 70,70" 
            stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M 60,50 Q 50,55 40,60 Q 35,65 30,70" 
            stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="50" cy="30" r="2" fill="currentColor" />
      <circle cx="60" cy="50" r="2" fill="currentColor" />
    </svg>
  ),
  aquarius: (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Water bearer constellation */}
      <path d="M 20,40 Q 30,35 40,40 Q 50,45 60,40 Q 70,35 80,40" 
            stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M 20,55 Q 30,50 40,55 Q 50,60 60,55 Q 70,50 80,55" 
            stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="30" cy="37" r="2" fill="currentColor" />
      <circle cx="50" cy="45" r="2" fill="currentColor" />
      <circle cx="70" cy="37" r="2" fill="currentColor" />
    </svg>
  ),
  pisces: (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Fish constellation */}
      <path d="M 30,30 Q 25,50 30,70" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M 70,30 Q 75,50 70,70" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="30" y1="50" x2="70" y2="50" stroke="currentColor" strokeWidth="2" />
      <circle cx="30" cy="30" r="2" fill="currentColor" />
      <circle cx="30" cy="70" r="2" fill="currentColor" />
      <circle cx="70" cy="30" r="2" fill="currentColor" />
      <circle cx="70" cy="70" r="2" fill="currentColor" />
    </svg>
  ),
};
