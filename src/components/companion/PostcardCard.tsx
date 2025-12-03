import { motion } from "framer-motion";
import { MapPin, Calendar } from "lucide-react";
import { CompanionPostcard } from "@/hooks/useCompanionPostcards";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface PostcardCardProps {
  postcard: CompanionPostcard;
  onClick: () => void;
}

const milestoneColors: Record<number, string> = {
  25: "from-blue-500/20 to-cyan-500/20 border-blue-500/30",
  50: "from-purple-500/20 to-pink-500/20 border-purple-500/30",
  75: "from-orange-500/20 to-yellow-500/20 border-orange-500/30",
  100: "from-yellow-400/20 to-amber-500/20 border-yellow-500/30",
};

export const PostcardCard = ({ postcard, onClick }: PostcardCardProps) => {
  const colorClass = milestoneColors[postcard.milestone_percent] || milestoneColors[25];

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative w-full aspect-[4/3] rounded-xl overflow-hidden",
        "bg-gradient-to-br border",
        colorClass,
        "group cursor-pointer"
      )}
    >
      {/* Image */}
      <img
        src={postcard.image_url}
        alt={postcard.location_name}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Milestone Badge */}
      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm">
        <span className="text-xs font-bold text-white">
          {postcard.milestone_percent}%
        </span>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div className="flex items-center gap-1 mb-1">
          <MapPin className="w-3 h-3 text-primary" />
          <span className="text-xs font-medium text-white truncate">
            {postcard.location_name}
          </span>
        </div>
        <div className="flex items-center gap-1 text-white/60">
          <Calendar className="w-3 h-3" />
          <span className="text-[10px]">
            {format(new Date(postcard.generated_at), "MMM d, yyyy")}
          </span>
        </div>
      </div>

      {/* Hover shine effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-tr from-white/0 via-white/10 to-white/0" />
    </motion.button>
  );
};
