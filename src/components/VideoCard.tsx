import { Play } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface VideoCardProps {
  id: string;
  title: string;
  category?: string;
  thumbnailUrl?: string;
  isPremium?: boolean;
}

export const VideoCard = ({ id, title, category, thumbnailUrl, isPremium }: VideoCardProps) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/video/${id}`)}
      className="group cursor-pointer"
    >
      <div className="relative rounded-3xl overflow-hidden shadow-soft mb-3">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full aspect-video bg-gradient-to-br from-petal-pink/30 to-lavender-mist/30 flex items-center justify-center">
            <Play className="h-12 w-12 text-blush-rose/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
          <div className="bg-white/0 group-hover:bg-white/90 rounded-full p-3 group-hover:scale-110 transition-all">
            <Play className="h-6 w-6 text-blush-rose opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" />
          </div>
        </div>
        {isPremium && (
          <div className="absolute top-3 right-3">
            <span className="bg-gradient-to-r from-gold-accent to-soft-mauve text-white text-xs font-medium px-3 py-1 rounded-full">
              Premium
            </span>
          </div>
        )}
      </div>
      <h3 className="font-medium text-warm-charcoal mb-1">{title}</h3>
      {category && (
        <p className="text-sm text-warm-charcoal/60 capitalize">{category}</p>
      )}
    </div>
  );
};
