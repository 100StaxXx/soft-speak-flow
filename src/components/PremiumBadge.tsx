import { Crown } from "lucide-react";

export const PremiumBadge = () => {
  return (
    <div className="inline-flex items-center gap-1.5 bg-royal-gold text-obsidian text-xs font-black px-3 py-1 rounded uppercase tracking-wide shadow-soft">
      <Crown className="h-3 w-3" />
      <span>Pro</span>
    </div>
  );
};
