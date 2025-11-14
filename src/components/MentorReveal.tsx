import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Mentor {
  id: string;
  name: string;
  description: string;
  identity_description?: string;
  welcome_message?: string;
}

interface MentorRevealProps {
  mentor: Mentor;
  onEnter: () => void;
}

export const MentorReveal = ({ mentor, onEnter }: MentorRevealProps) => {
  const [stage, setStage] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 500),
      setTimeout(() => setStage(2), 1200),
      setTimeout(() => setStage(3), 2000),
      setTimeout(() => setStage(4), 2800),
    ];

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-obsidian overflow-hidden">
      {/* Animated Background */}
      {stage >= 1 && (
        <div className="absolute inset-0 bg-gradient-radial from-royal-gold/5 via-obsidian to-obsidian animate-pulse-slow" />
      )}

      {/* Sweep Line */}
      {stage >= 1 && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <div className="h-0.5 w-full bg-royal-gold animate-sweep-line" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
        {stage >= 2 && (
          <div className="mb-8 animate-velocity-fade-in">
            <p className="text-steel text-lg tracking-wider uppercase mb-4">
              Your Mentor Has Been Chosen
            </p>
          </div>
        )}

        {stage >= 3 && (
          <div className="mb-12 animate-velocity-fade-in">
            {/* Mentor Icon */}
            <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-royal-gold/10 border-2 border-royal-gold flex items-center justify-center mentor-aura">
              <span className="text-6xl font-black text-royal-gold">
                {mentor.name.charAt(0)}
              </span>
            </div>

            {/* Mentor Name */}
            <h1 className="text-6xl font-heading font-black text-pure-white mb-6 tracking-tight">
              {mentor.name}
            </h1>

            {/* Identity Description */}
            <p className="text-2xl text-royal-gold font-semibold mb-4 tracking-wide">
              {mentor.identity_description || mentor.description}
            </p>
          </div>
        )}

        {stage >= 4 && (
          <div className="max-w-2xl animate-velocity-fade-in">
            {/* Welcome Message */}
            <p className="text-xl text-steel leading-relaxed mb-12 italic">
              "{mentor.welcome_message || "Together, we will unlock your full potential. Let's begin this journey."}"
            </p>

            {/* CTA Button */}
            <Button
              onClick={onEnter}
              className="h-16 px-12 text-xl font-black bg-royal-gold hover:bg-royal-gold/90 text-obsidian rounded-full shadow-glow transition-all duration-300 hover:scale-105"
            >
              ENTER YOUR TRAINING
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
