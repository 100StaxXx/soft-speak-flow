import { motion } from "framer-motion";
import { X, MapPin, Calendar, Share2, Sparkles } from "lucide-react";
import { CompanionPostcard } from "@/hooks/useCompanionPostcards";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

interface PostcardFullscreenProps {
  postcard: CompanionPostcard;
  onClose: () => void;
}

export const PostcardFullscreen = ({ postcard, onClose }: PostcardFullscreenProps) => {
  const handleShare = async () => {
    const shareText = `📸 My companion visited ${postcard.location_name}! ✨ #Cosmiq`;
    
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title: `Cosmic Postcard - ${postcard.location_name}`,
          text: shareText,
          url: postcard.image_url,
          dialogTitle: "Share your cosmic postcard",
        });
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      // Web fallback
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Cosmic Postcard - ${postcard.location_name}`,
            text: shareText,
            url: postcard.image_url,
          });
        } catch (err) {
          console.error("Share failed:", err);
        }
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${postcard.image_url}`);
        toast.success("Copied to clipboard!");
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col"
      onClick={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 safe-area-top">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/10"
        >
          <X className="w-6 h-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            handleShare();
          }}
          className="text-white hover:bg-white/10"
        >
          <Share2 className="w-5 h-5" />
        </Button>
      </div>

      {/* Image Container */}
      <div 
        className="flex-1 flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="relative w-full max-w-md"
        >
          {/* Postcard Frame */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20">
            <img
              src={postcard.image_url}
              alt={postcard.location_name}
              className="w-full aspect-[4/3] object-cover"
            />
            
            {/* Milestone Badge */}
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-bold text-white">
                {postcard.milestone_percent}% Milestone
              </span>
            </div>
          </div>

          {/* Info Card */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4 p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white mb-1">
                  {postcard.location_name}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  {postcard.location_description}
                </p>
              </div>
            </div>

            {/* Caption */}
            {postcard.caption && (
              <p className="mt-3 text-sm text-white/80 italic border-l-2 border-primary/50 pl-3">
                "{postcard.caption}"
              </p>
            )}

            {/* Date */}
            <div className="mt-4 flex items-center gap-2 text-white/50 text-xs">
              <Calendar className="w-3.5 h-3.5" />
              <span>Captured on {format(new Date(postcard.generated_at), "MMMM d, yyyy")}</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
};
