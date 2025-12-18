import { motion } from "framer-motion";
import { X, MapPin, Calendar, Share2, Sparkles, BookOpen, Search, Quote, Users } from "lucide-react";
import { CompanionPostcard } from "@/hooks/useCompanionPostcards";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

interface PostcardFullscreenProps {
  postcard: CompanionPostcard;
  onClose: () => void;
}

export const PostcardFullscreen = ({ postcard, onClose }: PostcardFullscreenProps) => {
  const hasNarrativeContent = !!(postcard.chapter_title || postcard.story_content || postcard.clue_text || postcard.prophecy_line);

  const handleShare = async () => {
    const shareText = postcard.chapter_title 
      ? `📖 Chapter ${postcard.chapter_number}: "${postcard.chapter_title}" - ${postcard.location_name} ✨ #Cosmiq`
      : `📸 My companion visited ${postcard.location_name}! ✨ #Cosmiq`;
    
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title: postcard.chapter_title || `Cosmic Postcard - ${postcard.location_name}`,
          text: shareText,
          url: postcard.image_url,
          dialogTitle: "Share your cosmic postcard",
        });
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      if (navigator.share) {
        try {
          await navigator.share({
            title: postcard.chapter_title || `Cosmic Postcard - ${postcard.location_name}`,
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

      <ScrollArea className="flex-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center p-4 pb-8">
          {/* Chapter Header */}
          {postcard.chapter_title && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-4"
            >
              <div className="flex items-center justify-center gap-2 text-primary mb-1">
                <BookOpen className="w-4 h-4" />
                <span className="text-sm font-medium">Chapter {postcard.chapter_number}</span>
              </div>
              <h2 className="text-xl font-bold text-white">{postcard.chapter_title}</h2>
            </motion.div>
          )}

          {/* Image Container */}
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
                  {postcard.milestone_percent}%
                </span>
              </div>

              {/* Finale Badge */}
              {postcard.is_finale && (
                <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-yellow-500/80 backdrop-blur-sm">
                  <span className="text-sm font-bold text-black">✨ FINALE</span>
                </div>
              )}
            </div>

            {/* Location Info */}
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
            </motion.div>

            {/* Story Content */}
            {postcard.story_content && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="mt-4 p-4 bg-white/5 border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-white">Story</span>
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                    {postcard.story_content}
                  </p>
                </Card>
              </motion.div>
            )}

            {/* Mystery Clue */}
            {postcard.clue_text && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="mt-4 p-4 bg-purple-500/10 border-purple-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Search className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-300">Mystery Clue</span>
                  </div>
                  <p className="text-sm text-white/80 italic">
                    "{postcard.clue_text}"
                  </p>
                </Card>
              </motion.div>
            )}

            {/* Prophecy Fragment */}
            {postcard.prophecy_line && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="mt-4 p-4 bg-amber-500/10 border-amber-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Quote className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-amber-300">Prophecy Fragment</span>
                  </div>
                  <p className="text-sm text-white/80 italic font-serif">
                    "{postcard.prophecy_line}"
                  </p>
                </Card>
              </motion.div>
            )}

            {/* Featured Characters */}
            {postcard.characters_featured && postcard.characters_featured.length > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-medium text-cyan-300">Featured Characters</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {postcard.characters_featured.map((character, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary"
                      className="bg-cyan-500/20 text-cyan-200 border-cyan-500/30"
                    >
                      {character}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Caption (legacy support) */}
            {postcard.caption && !hasNarrativeContent && (
              <p className="mt-4 text-sm text-white/80 italic border-l-2 border-primary/50 pl-3">
                "{postcard.caption}"
              </p>
            )}

            {/* Date */}
            <div className="mt-4 flex items-center justify-center gap-2 text-white/50 text-xs">
              <Calendar className="w-3.5 h-3.5" />
              <span>Captured on {format(new Date(postcard.generated_at), "MMMM d, yyyy")}</span>
            </div>
          </motion.div>
        </div>
      </ScrollArea>
    </motion.div>
  );
};
