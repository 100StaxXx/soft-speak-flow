import { useEffect, useState } from "react";

interface IntroScreenProps {
  onComplete: () => void;
}

export const IntroScreen = ({ onComplete }: IntroScreenProps) => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    let timer2: NodeJS.Timeout | undefined;
    const timer1 = setTimeout(() => {
      setShow(false);
      timer2 = setTimeout(onComplete, 1500);
    }, 4000);

    return () => {
      clearTimeout(timer1);
      if (timer2) clearTimeout(timer2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-background via-background to-primary/20 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.3),transparent_70%)] animate-pulse" />
      
      <div className="relative flex flex-col items-center gap-6 animate-scale-in">
        {/* Glowing orb */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary via-primary/80 to-accent animate-[spin_3s_linear_infinite]" 
               style={{ 
                 boxShadow: '0 0 60px hsl(var(--primary)/0.6), 0 0 100px hsl(var(--primary)/0.4), inset 0 0 20px hsl(var(--primary)/0.8)' 
               }} 
          />
          <div className="absolute inset-0 w-24 h-24 rounded-full bg-gradient-to-tl from-accent via-primary/60 to-transparent animate-[spin_2s_linear_infinite_reverse]" 
               style={{ 
                 boxShadow: '0 0 40px hsl(var(--accent)/0.5)' 
               }} 
          />
        </div>

        {/* App title with cinematic reveal */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-6xl md:text-7xl font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent tracking-wider"
              style={{
                textShadow: '0 0 30px hsl(var(--primary)/0.5)',
                animation: 'fade-in 2s ease-out, scale-in 1.8s ease-out',
                opacity: 0,
                animationFillMode: 'forwards'
              }}>
            R-EVOLUTION
          </h1>
          <p className="text-lg text-muted-foreground/80 tracking-widest" 
             style={{ 
               animation: 'fade-in 2s ease-out',
               animationDelay: '0.8s', 
               opacity: 0, 
               animationFillMode: 'forwards' 
             }}>
            YOUR JOURNEY BEGINS
          </p>
        </div>
        
        {/* Particle effects */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-primary rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                opacity: Math.random() * 0.6 + 0.2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
