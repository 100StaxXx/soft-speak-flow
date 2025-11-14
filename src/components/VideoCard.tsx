import { Play } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Video {
  id: string;
  title: string;
  category?: string;
  thumbnail_url?: string;
  is_premium?: boolean;
}

interface VideoCardProps {
  video: Video;
}

export const VideoCard = ({ video }: VideoCardProps) => {
  const navigate = useNavigate();
  const { id, title, category, thumbnail_url, is_premium } = video;

  return (
    <div
      onClick={() => navigate(`/video/${id}`)}
      className="group cursor-pointer"
    >
      <div className="relative rounded-lg overflow-hidden shadow-soft mb-3 border-2 border-steel/20 hover:border-royal-gold transition-all">
        {thumbnail_url ? (
          <img
            src={thumbnail_url}
            alt={title}
            className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full aspect-video bg-graphite flex items-center justify-center">
            <Play className="h-12 w-12 text-steel/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
          <div className="bg-royal-gold/0 group-hover:bg-royal-gold rounded-lg p-3 group-hover:scale-110 transition-all">
            <Play className="h-6 w-6 text-obsidian opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" />
          </div>
        </div>
        {is_premium && (
          <div className="absolute top-3 right-3">
            <span className="bg-royal-gold text-obsidian text-xs font-black px-3 py-1 rounded uppercase tracking-wide">
              Pro
            </span>
          </div>
        )}
      </div>
      <h3 className="font-semibold text-pure-white mb-1 uppercase tracking-tight">{title}</h3>
      {category && (
        <p className="text-sm text-steel capitalize">{category}</p>
      )}
    </div>
  );
};
