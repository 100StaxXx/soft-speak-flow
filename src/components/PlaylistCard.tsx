import { Music, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Playlist {
  id: string;
  title: string;
  description?: string;
  is_premium?: boolean;
}

interface PlaylistCardProps {
  playlist: Playlist;
}

export const PlaylistCard = ({ playlist }: PlaylistCardProps) => {
  const navigate = useNavigate();
  const { id, title, description, is_premium } = playlist;

  return (
    <div
      onClick={() => navigate(`/playlist/${id}`)}
      className="bg-gradient-to-br from-cream-glow to-petal-pink/20 rounded-3xl p-6 shadow-soft border border-petal-pink/20 cursor-pointer hover:shadow-medium transition-all hover:scale-105"
    >
      {is_premium && (
        <div className="mb-3">
          <span className="bg-gradient-to-r from-gold-accent to-soft-mauve text-white text-xs font-medium px-3 py-1 rounded-full">
            Premium
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        <div className="bg-gradient-to-br from-blush-rose/20 to-lavender-mist/20 p-3 rounded-2xl">
          <Music className="h-6 w-6 text-blush-rose" />
        </div>
      </div>
      <h3 className="font-display text-xl text-warm-charcoal mb-2">{title}</h3>
      {description && (
        <p className="text-warm-charcoal/70 text-sm mb-3 line-clamp-2">{description}</p>
      )}
    </div>
  );
};
