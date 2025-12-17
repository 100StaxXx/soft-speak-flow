import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Sparkles, Users, Quote, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NarrativePostcard } from "@/types/narrativeTypes";

interface ChapterCardProps {
  chapter: NarrativePostcard;
  chapterNumber: number;
}

export const ChapterCard = ({ chapter, chapterNumber }: ChapterCardProps) => {
  return (
    <div className="space-y-6">
      {/* Chapter Header */}
      <div className="text-center space-y-2">
        <Badge variant="outline" className="text-xs">
          {chapter.is_finale ? "🌟 Finale" : `Chapter ${chapterNumber}`}
        </Badge>
        <h2 className="text-2xl font-bold">
          {chapter.chapter_title || chapter.location_name}
        </h2>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span>{chapter.location_name}</span>
        </div>
      </div>

      {/* Chapter Image */}
      {chapter.image_url && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative aspect-[4/3] rounded-xl overflow-hidden border-2 border-primary/20"
        >
          <img
            src={chapter.image_url}
            alt={chapter.location_name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-sm text-white/90 italic">
              {chapter.location_description}
            </p>
          </div>
        </motion.div>
      )}

      {/* Story Content */}
      {chapter.story_content && (
        <Card className="p-6">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap leading-relaxed">
              {chapter.story_content}
            </p>
          </div>
        </Card>
      )}

      {/* Clue / Mystery Hint */}
      {chapter.clue_text && !chapter.location_revealed && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm text-primary mb-1">Mystery Clue</h4>
              <p className="text-sm italic text-foreground/80">{chapter.clue_text}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Prophecy Line */}
      {chapter.prophecy_line && (
        <Card className="p-4 bg-accent/5 border-accent/20">
          <div className="flex items-start gap-3">
            <Quote className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm text-accent mb-1">Prophecy Fragment</h4>
              <p className="text-sm italic text-foreground/80">"{chapter.prophecy_line}"</p>
            </div>
          </div>
        </Card>
      )}

      {/* Featured Characters */}
      {chapter.characters_featured?.length ? (
        <div className="flex items-center gap-2 flex-wrap">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Featured:</span>
          {chapter.characters_featured.map((character, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {character}
            </Badge>
          ))}
        </div>
      ) : null}

      {/* Seeds Planted */}
      {chapter.seeds_planted?.length ? (
        <div className="text-xs text-muted-foreground/60 flex items-center gap-2">
          <Star className="w-3 h-3" />
          <span>Plot threads woven: {chapter.seeds_planted.length}</span>
        </div>
      ) : null}

      {/* Caption */}
      {chapter.caption && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground italic">
            "{chapter.caption}"
          </p>
        </div>
      )}
    </div>
  );
};
