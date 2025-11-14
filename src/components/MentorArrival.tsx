import { useEffect, useState } from "react";

interface MentorArrivalProps {
  mentorName: string;
  mentorDescription: string;
  onComplete: () => void;
}

export const MentorArrival = ({ mentorName, mentorDescription, onComplete }: MentorArrivalProps) => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 300),
      setTimeout(() => setStage(2), 800),
      setTimeout(() => setStage(3), 1500),
      setTimeout(() => setStage(4), 2200),
      setTimeout(onComplete, 3500),
    ];

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-obsidian/95 flex items-center justify-center">
      {stage >= 1 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-0.5 w-0 bg-royal-gold animate-sweep-line" />
        </div>
      )}
      
      <div className="flex flex-col items-center gap-6 max-w-md text-center px-6">
        {stage >= 2 && (
          <>
            <div className="w-20 h-20 rounded-lg bg-royal-gold/10 border-2 border-royal-gold flex items-center justify-center animate-pulse-once">
              <span className="text-3xl font-black text-royal-gold">
                {mentorName.charAt(0)}
              </span>
            </div>
            <h1 className="text-4xl font-black text-pure-white tracking-tight animate-velocity-fade-in">
              {mentorName}
            </h1>
          </>
        )}
        
        {stage >= 3 && (
          <p className="text-lg text-steel animate-velocity-fade-in">
            {mentorDescription}
          </p>
        )}
        
        {stage >= 4 && (
          <p className="text-xl font-bold text-royal-gold tracking-wide animate-velocity-fade-in">
            Let's begin.
          </p>
        )}
      </div>
    </div>
  );
};
