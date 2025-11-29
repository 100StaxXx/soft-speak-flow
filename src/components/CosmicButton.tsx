import { ButtonHTMLAttributes, forwardRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ParticleProps {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
}

interface CosmicButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "glow" | "glass";
  children: React.ReactNode;
}

export const CosmicButton = forwardRef<HTMLButtonElement, CosmicButtonProps>(
  ({ variant = "default", className, children, onClick, ...props }, ref) => {
    const [particles, setParticles] = useState<ParticleProps[]>([]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Create particle burst effect on click
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newParticles: ParticleProps[] = Array.from({ length: 6 }, (_, i) => {
        const angle = (i * 60 * Math.PI) / 180;
        const distance = 30 + Math.random() * 20;
        return {
          id: Date.now() + i,
          x,
          y,
          tx: Math.cos(angle) * distance,
          ty: Math.sin(angle) * distance,
        };
      });

      setParticles((prev) => [...prev, ...newParticles]);

      // Clean up particles after animation
      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
      }, 600);

      onClick?.(e);
    };

    const variantStyles = {
      default: "cosmic-button",
      glow: "cosmic-hover",
      glass: "cosmic-glass",
    };

    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={cn(
          "relative overflow-hidden rounded-lg px-6 py-3",
          "font-semibold transition-all duration-300",
          "active:scale-95",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {/* Particle burst effect */}
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute w-1 h-1 rounded-full bg-white pointer-events-none animate-particle-burst"
            style={
              {
                left: particle.x,
                top: particle.y,
                "--tx": `${particle.tx}px`,
                "--ty": `${particle.ty}px`,
                boxShadow: "0 0 4px 1px rgba(255, 255, 255, 0.8)",
              } as React.CSSProperties
            }
          />
        ))}

        {/* Button content */}
        <span className="relative z-10">{children}</span>
      </button>
    );
  }
);

CosmicButton.displayName = "CosmicButton";
