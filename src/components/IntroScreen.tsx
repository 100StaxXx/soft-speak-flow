import { useEffect, useState } from "react";

interface IntroScreenProps {
  onComplete: () => void;
}

export const IntroScreen = ({ onComplete }: IntroScreenProps) => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onComplete, 500);
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 bg-obsidian flex items-center justify-center animate-fade-out">
      <div className="flex flex-col items-center gap-8">
        <div className="w-16 h-16 rounded-full border-2 border-royal-gold animate-pulse-gold" />
        <h1 className="text-4xl font-black text-pure-white tracking-tight animate-breathe">
          Breathe.
        </h1>
      </div>
    </div>
  );
};
