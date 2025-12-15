// Shared polished UI styles for all Astral Encounters mini-games
// Premium Apple-quality design system with glass morphism, refined animations, and cosmic aesthetic

export const gameStyles = `
  /* === GLOBAL GAME STYLES === */
  
  /* Premium glass container with depth */
  .game-container {
    background: linear-gradient(
      165deg,
      rgba(0, 0, 0, 0.9) 0%,
      rgba(10, 10, 30, 0.95) 30%,
      rgba(20, 10, 40, 0.92) 70%,
      rgba(5, 5, 25, 0.95) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 
      0 30px 60px -15px rgba(0, 0, 0, 0.7),
      0 0 80px -20px rgba(168, 85, 247, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      inset 0 -1px 0 rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(24px) saturate(150%);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
  }
  
  /* Premium card surface with subtle texture */
  .game-surface {
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.04) 0%,
      rgba(255, 255, 255, 0.01) 50%,
      rgba(0, 0, 0, 0.02) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 
      inset 0 1px 0 rgba(255, 255, 255, 0.06),
      inset 0 -1px 0 rgba(0, 0, 0, 0.1),
      0 12px 45px -10px rgba(0, 0, 0, 0.6);
    border-radius: 16px;
  }
  
  /* === COSMIC ANIMATIONS === */
  
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  
  @keyframes cosmic-float {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    25% { transform: translateY(-3px) rotate(1deg); }
    75% { transform: translateY(2px) rotate(-1deg); }
  }
  
  @keyframes pulse-glow {
    0%, 100% { 
      box-shadow: 0 0 20px currentColor, 0 0 40px currentColor;
      opacity: 1;
    }
    50% { 
      box-shadow: 0 0 35px currentColor, 0 0 70px currentColor;
      opacity: 0.85;
    }
  }
  
  @keyframes cosmic-rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes scale-breathe {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.06); }
  }
  
  @keyframes cosmic-breathe {
    0%, 100% { opacity: 0.6; transform: scale(1); filter: brightness(1); }
    50% { opacity: 1; transform: scale(1.03); filter: brightness(1.15); }
  }
  
  @keyframes success-burst {
    0% { transform: scale(0); opacity: 1; filter: brightness(2); }
    50% { transform: scale(1.5); opacity: 0.8; filter: brightness(1.5); }
    100% { transform: scale(2.5); opacity: 0; filter: brightness(1); }
  }
  
  @keyframes cosmic-shake {
    0%, 100% { transform: translateX(0) rotate(0deg); }
    10%, 50%, 90% { transform: translateX(-3px) rotate(-0.5deg); }
    30%, 70% { transform: translateX(3px) rotate(0.5deg); }
  }
  
  @keyframes twinkle-pulse {
    0%, 100% { opacity: 0.15; transform: scale(0.7); filter: blur(0.5px); }
    50% { opacity: 0.95; transform: scale(1.15); filter: blur(0px); }
  }
  
  @keyframes ring-expand {
    0% { transform: scale(1); opacity: 0.9; filter: blur(0px); }
    100% { transform: scale(2.2); opacity: 0; filter: blur(2px); }
  }
  
  @keyframes cosmic-spin {
    from { transform: rotate(0deg); filter: hue-rotate(0deg); }
    to { transform: rotate(360deg); filter: hue-rotate(20deg); }
  }
  
  @keyframes stardust-trail {
    0% { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(0.3) translateY(-10px); }
  }
  
  @keyframes aurora-wave {
    0%, 100% { opacity: 0.3; transform: translateX(-10%) skewX(-5deg); }
    50% { opacity: 0.6; transform: translateX(10%) skewX(5deg); }
  }
  
  /* === UTILITY CLASSES === */
  
  .animate-shimmer {
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.15) 50%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: shimmer 2.5s ease-in-out infinite;
  }
  
  .animate-cosmic-float {
    animation: cosmic-float 3s ease-in-out infinite;
  }
  
  .animate-pulse-glow {
    animation: pulse-glow 2s ease-in-out infinite;
  }
  
  .animate-cosmic-rotate {
    animation: cosmic-rotate 10s linear infinite;
  }
  
  .animate-scale-breathe {
    animation: scale-breathe 1s ease-in-out infinite;
  }
  
  .animate-cosmic-breathe {
    animation: cosmic-breathe 3.5s ease-in-out infinite;
  }
  
  .animate-cosmic-shake {
    animation: cosmic-shake 0.4s ease-in-out;
  }
  
  .animate-ring-expand {
    animation: ring-expand 0.7s ease-out forwards;
  }
  
  .animate-stardust {
    animation: stardust-trail 1.5s ease-out forwards;
  }
  
  /* GPU acceleration */
  .gpu-accelerated {
    transform: translateZ(0);
    backface-visibility: hidden;
    perspective: 1000px;
    will-change: transform, opacity;
  }
  
  /* Premium button with cosmic glow */
  .game-button {
    background: linear-gradient(
      135deg,
      hsl(var(--primary)) 0%,
      hsl(var(--primary) / 0.85) 50%,
      hsl(var(--accent)) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 
      0 6px 20px hsl(var(--primary) / 0.4),
      0 0 40px hsl(var(--primary) / 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.25),
      inset 0 -1px 0 rgba(0, 0, 0, 0.1);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .game-button:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 
      0 8px 25px hsl(var(--primary) / 0.5),
      0 0 50px hsl(var(--primary) / 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  
  .game-button:active {
    transform: translateY(0) scale(0.98);
  }
  
  /* Premium progress bar with animated gradient */
  .progress-bar-premium {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.03) 0%,
      rgba(255, 255, 255, 0.06) 50%,
      rgba(255, 255, 255, 0.03) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 
      inset 0 2px 6px rgba(0, 0, 0, 0.4),
      0 1px 0 rgba(255, 255, 255, 0.05);
    border-radius: 999px;
  }
  
  .progress-fill-premium {
    background: linear-gradient(
      90deg,
      hsl(var(--primary)) 0%,
      hsl(var(--accent)) 50%,
      hsl(var(--primary)) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 2s linear infinite;
    box-shadow: 
      0 0 20px hsl(var(--primary) / 0.6),
      0 0 40px hsl(var(--primary) / 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.35);
    border-radius: 999px;
  }
  
  /* Stat pill with glass effect */
  .stat-pill {
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.06) 0%,
      rgba(255, 255, 255, 0.02) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 
      0 4px 15px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }
  
  /* Score badge with cosmic glow */
  .score-badge {
    background: linear-gradient(
      135deg,
      rgba(168, 85, 247, 0.25) 0%,
      rgba(168, 85, 247, 0.1) 100%
    );
    border: 1px solid rgba(168, 85, 247, 0.4);
    box-shadow: 
      0 0 25px rgba(168, 85, 247, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }
  
  .combo-badge {
    background: linear-gradient(
      135deg,
      rgba(250, 204, 21, 0.25) 0%,
      rgba(251, 191, 36, 0.1) 100%
    );
    border: 1px solid rgba(250, 204, 21, 0.5);
    box-shadow: 
      0 0 25px rgba(250, 204, 21, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }
  
  /* Feedback overlays with premium styling */
  .feedback-perfect {
    background: linear-gradient(
      135deg,
      rgba(250, 204, 21, 0.2) 0%,
      rgba(251, 191, 36, 0.08) 100%
    );
    border: 2px solid rgba(250, 204, 21, 0.6);
    box-shadow: 
      0 0 40px rgba(250, 204, 21, 0.5),
      0 0 80px rgba(250, 204, 21, 0.25),
      inset 0 0 40px rgba(250, 204, 21, 0.15);
  }
  
  .feedback-good {
    background: linear-gradient(
      135deg,
      rgba(34, 197, 94, 0.2) 0%,
      rgba(34, 197, 94, 0.08) 100%
    );
    border: 2px solid rgba(34, 197, 94, 0.6);
    box-shadow: 
      0 0 40px rgba(34, 197, 94, 0.5),
      0 0 80px rgba(34, 197, 94, 0.25),
      inset 0 0 40px rgba(34, 197, 94, 0.15);
  }
  
  .feedback-miss {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.2) 0%,
      rgba(239, 68, 68, 0.08) 100%
    );
    border: 2px solid rgba(239, 68, 68, 0.6);
    box-shadow: 
      0 0 40px rgba(239, 68, 68, 0.5),
      0 0 80px rgba(239, 68, 68, 0.25),
      inset 0 0 40px rgba(239, 68, 68, 0.15);
  }
  
  /* Premium orb styles with depth */
  .orb-fire { 
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 50%, #ff4757 100%);
    box-shadow: 0 0 20px rgba(255, 107, 107, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
  }
  .orb-water { 
    background: linear-gradient(135deg, #4facfe 0%, #00cec9 50%, #0984e3 100%);
    box-shadow: 0 0 20px rgba(79, 172, 254, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
  }
  .orb-earth { 
    background: linear-gradient(135deg, #00b894 0%, #55a630 50%, #2d6a4f 100%);
    box-shadow: 0 0 20px rgba(0, 184, 148, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
  }
  .orb-light { 
    background: linear-gradient(135deg, #ffd93d 0%, #ff9f1c 50%, #f9a825 100%);
    box-shadow: 0 0 20px rgba(255, 217, 61, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.4);
  }
  .orb-dark { 
    background: linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #6366f1 100%);
    box-shadow: 0 0 20px rgba(168, 85, 247, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
  }
  .orb-cosmic { 
    background: linear-gradient(135deg, #f472b6 0%, #ec4899 50%, #e11d48 100%);
    box-shadow: 0 0 20px rgba(244, 114, 182, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.3);
  }
  
  /* Touch optimization */
  .touch-target {
    min-height: 48px;
    min-width: 48px;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    -webkit-user-select: none;
  }
  
  /* Premium nebula background effect */
  .nebula-bg {
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(ellipse at 15% 15%, rgba(139, 92, 246, 0.12) 0%, transparent 55%),
      radial-gradient(ellipse at 85% 85%, rgba(34, 211, 238, 0.08) 0%, transparent 55%),
      radial-gradient(ellipse at 50% 50%, rgba(236, 72, 153, 0.06) 0%, transparent 55%),
      radial-gradient(ellipse at 25% 75%, rgba(251, 191, 36, 0.04) 0%, transparent 45%);
    pointer-events: none;
    animation: aurora-wave 8s ease-in-out infinite;
  }
  
  /* Cosmic vignette overlay */
  .cosmic-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at center,
      transparent 0%,
      transparent 50%,
      rgba(0, 0, 0, 0.4) 100%
    );
    pointer-events: none;
  }
  
  /* Star particle styles */
  .star-particle {
    position: absolute;
    border-radius: 50%;
    background: white;
    animation: twinkle-pulse var(--twinkle-duration, 2s) ease-in-out infinite;
    animation-delay: var(--twinkle-delay, 0s);
  }
  
  /* Game arena with premium border */
  .game-arena {
    position: relative;
    background: linear-gradient(
      165deg,
      rgba(0, 0, 0, 0.9) 0%,
      rgba(10, 10, 30, 0.95) 50%,
      rgba(20, 10, 40, 0.9) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    overflow: hidden;
    box-shadow:
      0 30px 60px -15px rgba(0, 0, 0, 0.7),
      0 0 0 1px rgba(255, 255, 255, 0.05),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }
  
  /* Cosmic text glow */
  .cosmic-text {
    text-shadow: 
      0 0 10px currentColor,
      0 0 20px currentColor,
      0 0 40px currentColor;
  }
  
  /* Success celebration effect */
  .celebration-burst::after {
    content: '';
    position: absolute;
    inset: -50%;
    background: radial-gradient(
      circle,
      rgba(250, 204, 21, 0.3) 0%,
      transparent 60%
    );
    animation: success-burst 0.8s ease-out forwards;
  }
`;

// Reusable style wrapper component with enhanced styles
export const GameStyleWrapper = ({ children }: { children: React.ReactNode }) => (
  <>
    <style>{gameStyles}</style>
    {children}
  </>
);
