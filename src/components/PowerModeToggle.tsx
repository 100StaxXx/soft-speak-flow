import { Zap } from "lucide-react";
import { useState } from "react";

interface PowerModeToggleProps {
  onToggle: (enabled: boolean) => void;
}

export const PowerModeToggle = ({ onToggle }: PowerModeToggleProps) => {
  const [enabled, setEnabled] = useState(false);

  const handleToggle = () => {
    const newState = !enabled;
    setEnabled(newState);
    onToggle(newState);
  };

  return (
    <button
      onClick={handleToggle}
      className={`fixed top-6 right-6 z-40 w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-300 ${
        enabled
          ? "bg-royal-gold text-obsidian shadow-glow"
          : "bg-graphite text-steel border border-steel/20"
      }`}
      aria-label="Toggle Power Mode"
    >
      <Zap className={`h-6 w-6 ${enabled ? "fill-current" : ""}`} strokeWidth={2.5} />
    </button>
  );
};
