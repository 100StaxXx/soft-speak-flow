import { motion } from "framer-motion";
import { Play, Heart, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FeaturedPepTalkCardProps {
  pepTalk: {
    id: string;
    title: string;
    category: string;
    description?: string | null;
  };
  index: number;
}

export const FeaturedPepTalkCard = ({ pepTalk, index }: FeaturedPepTalkCardProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/pep-talk/${pepTalk.id}`);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    handleClick();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15, duration: 0.5 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      role="button"
      tabIndex={0}
      className="group relative cursor-pointer select-none"
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(var(--graphite))] to-[hsl(var(--charcoal))] p-5 border border-white/5">
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--royal-purple)/0.2)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        />

        <motion.div
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(var(--stardust-gold))] to-[hsl(var(--stardust-gold)/0.7)] flex items-center justify-center shadow-lg"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <Play className="h-4 w-4 text-obsidian ml-0.5" fill="currentColor" />
        </motion.div>

        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 text-xs text-stardust-gold uppercase tracking-wider mb-3">
          <Heart className="h-3 w-3" fill="currentColor" />
          {pepTalk.category}
        </div>

        <h3 className="text-lg font-bold text-pure-white mb-2 line-clamp-2 group-hover:text-stardust-gold transition-colors">
          {pepTalk.title}
        </h3>

        {pepTalk.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {pepTalk.description}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>3-5 min listen</span>
        </div>

        <div className="absolute bottom-0 right-0 w-20 h-20 bg-gradient-to-tl from-[hsl(var(--royal-purple)/0.1)] to-transparent rounded-tl-full" />
      </div>
    </motion.div>
  );
};