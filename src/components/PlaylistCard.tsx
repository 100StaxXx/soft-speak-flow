import { Music } from "lucide-react";
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
      className="bg-graphite rounded-lg p-6 shadow-soft border-2 border-steel/20 hover:border-royal-gold cursor-pointer transition-all hover:shadow-glow"
    >
      {is_premium && (
        <div className="mb-3">
          <span className="bg-royal-gold text-obsidian text-xs font-black px-3 py-1 rounded uppercase tracking-wide">
            Pro
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        <div className="bg-royal-gold/20 p-3 rounded-lg border border-royal-gold">
          <Music className="h-6 w-6 text-royal-gold" />
        </div>
      </div>
      <h3 className="font-heading text-xl text-pure-white mb-2 font-black uppercase tracking-tight">{title}</h3>
      {description && (
        <p className="text-steel text-sm mb-3 line-clamp-2">{description}</p>
      )}
    </div>
  );
};
