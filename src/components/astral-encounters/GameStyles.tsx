// Shared polished UI styles for all Astral Encounters mini-games
// Apple-quality design system with glass morphism, refined animations, and premium feel

export const gameStyles = `
  /* === GLOBAL GAME STYLES === */
  
  /* Premium glass container */
  .game-container {
    background: linear-gradient(
      145deg,
      rgba(0, 0, 0, 0.8) 0%,
      rgba(15, 15, 35, 0.95) 50%,
      rgba(25, 15, 45, 0.9) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 
      0 25px 50px -12px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.05),
      0 0 0 1px rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  
  /* Premium card surface */
  .game-surface {
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.03) 0%,
      rgba(255, 255, 255, 0.01) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: 
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      0 10px 40px -10px rgba(0, 0, 0, 0.5);
  }
  
  /* === ANIMATIONS === */
  
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  
  @keyframes pulse-glow {
    0%, 100% { 
      box-shadow: 0 0 20px currentColor, 0 0 40px currentColor;
      opacity: 1;
    }
    50% { 
      box-shadow: 0 0 30px currentColor, 0 0 60px currentColor;
      opacity: 0.8;
    }
  }
  
  @keyframes rotate-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes scale-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.08); }
  }
  
  @keyframes breathe {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.02); }
  }
  
  @keyframes success-burst {
    0% { transform: scale(0); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0.8; }
    100% { transform: scale(2); opacity: 0; }
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
    20%, 40%, 60%, 80% { transform: translateX(3px); }
  }
  
  @keyframes twinkle {
    0%, 100% { opacity: 0.2; transform: scale(0.8); }
    50% { opacity: 0.9; transform: scale(1.1); }
  }
  
  @keyframes ring-expand {
    0% { transform: scale(1); opacity: 0.8; }
    100% { transform: scale(2); opacity: 0; }
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  /* === UTILITY CLASSES === */
  
  .animate-shimmer {
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.1) 50%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: shimmer 2s ease-in-out infinite;
  }
  
  .animate-float {
    animation: float 2s ease-in-out infinite;
  }
  
  .animate-pulse-glow {
    animation: pulse-glow 1.5s ease-in-out infinite;
  }
  
  .animate-rotate-slow {
    animation: rotate-slow 8s linear infinite;
  }
  
  .animate-scale-pulse {
    animation: scale-pulse 0.8s ease-in-out infinite;
  }
  
  .animate-breathe {
    animation: breathe 3s ease-in-out infinite;
  }
  
  .animate-shake {
    animation: shake 0.4s ease-in-out;
  }
  
  .animate-ring-expand {
    animation: ring-expand 0.6s ease-out forwards;
  }
  
  /* GPU acceleration */
  .gpu-accelerated {
    transform: translateZ(0);
    backface-visibility: hidden;
    perspective: 1000px;
    will-change: transform, opacity;
  }
  
  /* Premium button */
  .game-button {
    background: linear-gradient(
      135deg,
      hsl(var(--primary)) 0%,
      hsl(var(--primary) / 0.8) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 
      0 4px 15px hsl(var(--primary) / 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    transition: all 0.2s ease;
  }
  
  .game-button:hover {
    transform: translateY(-1px);
    box-shadow: 
      0 6px 20px hsl(var(--primary) / 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.25);
  }
  
  .game-button:active {
    transform: translateY(0) scale(0.98);
  }
  
  /* Premium progress bar */
  .progress-bar-premium {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.02) 0%,
      rgba(255, 255, 255, 0.05) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
  }
  
  .progress-fill-premium {
    background: linear-gradient(
      90deg,
      hsl(var(--primary)) 0%,
      hsl(var(--accent)) 50%,
      hsl(var(--primary)) 100%
    );
    background-size: 200% 100%;
    box-shadow: 
      0 0 15px hsl(var(--primary) / 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  
  /* Stat pill */
  .stat-pill {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  
  /* Score badge */
  .score-badge {
    background: linear-gradient(
      135deg,
      rgba(168, 85, 247, 0.2) 0%,
      rgba(168, 85, 247, 0.1) 100%
    );
    border: 1px solid rgba(168, 85, 247, 0.3);
    box-shadow: 0 0 20px rgba(168, 85, 247, 0.2);
  }
  
  .combo-badge {
    background: linear-gradient(
      135deg,
      rgba(250, 204, 21, 0.2) 0%,
      rgba(251, 191, 36, 0.1) 100%
    );
    border: 1px solid rgba(250, 204, 21, 0.4);
    box-shadow: 0 0 20px rgba(250, 204, 21, 0.3);
  }
  
  /* Feedback overlays */
  .feedback-perfect {
    background: linear-gradient(
      135deg,
      rgba(250, 204, 21, 0.15) 0%,
      rgba(251, 191, 36, 0.1) 100%
    );
    border: 2px solid rgba(250, 204, 21, 0.5);
    box-shadow: 
      0 0 30px rgba(250, 204, 21, 0.4),
      inset 0 0 30px rgba(250, 204, 21, 0.1);
  }
  
  .feedback-good {
    background: linear-gradient(
      135deg,
      rgba(34, 197, 94, 0.15) 0%,
      rgba(34, 197, 94, 0.1) 100%
    );
    border: 2px solid rgba(34, 197, 94, 0.5);
    box-shadow: 
      0 0 30px rgba(34, 197, 94, 0.4),
      inset 0 0 30px rgba(34, 197, 94, 0.1);
  }
  
  .feedback-miss {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.15) 0%,
      rgba(239, 68, 68, 0.1) 100%
    );
    border: 2px solid rgba(239, 68, 68, 0.5);
    box-shadow: 
      0 0 30px rgba(239, 68, 68, 0.4),
      inset 0 0 30px rgba(239, 68, 68, 0.1);
  }
  
  /* Orb styles */
  .orb-fire { background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); }
  .orb-water { background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%); }
  .orb-earth { background: linear-gradient(135deg, #22c55e 0%, #10b981 100%); }
  .orb-light { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); }
  .orb-dark { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
  .orb-cosmic { background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%); }
  
  /* Touch optimization */
  .touch-target {
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    -webkit-user-select: none;
  }
  
  /* Nebula effect */
  .nebula-bg {
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(ellipse at 20% 20%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(34, 211, 238, 0.06) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 50%, rgba(236, 72, 153, 0.04) 0%, transparent 50%);
    pointer-events: none;
  }
`;

// Reusable style wrapper component
export const GameStyleWrapper = ({ children }: { children: React.ReactNode }) => (
  <>
    <style>{gameStyles}</style>
    {children}
  </>
);
