import { Crown } from "lucide-react";

export const PremiumBadge = () => {
  return (
    <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-gold-accent to-soft-mauve text-white text-xs font-medium px-3 py-1 rounded-full shadow-soft">
      <Crown className="h-3 w-3" />
      <span>Premium</span>
    </div>
  );
};
