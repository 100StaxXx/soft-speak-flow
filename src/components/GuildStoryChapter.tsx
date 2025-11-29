import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Users, Sparkles, Heart } from "lucide-react";
import { GuildStory } from "@/hooks/useGuildStories";

interface GuildStoryChapterProps {
  story: GuildStory;
}

export const GuildStoryChapter = ({ story }: GuildStoryChapterProps) => {
  return (
    <Card className="p-6 space-y-6 bg-gradient-to-br from-primary/5 via-background to-secondary/5 border-primary/20">
      {/* Chapter Header */}
      <div className="text-center space-y-3">
        <Badge variant="outline" className="text-sm">
          Chapter {story.chapter_number}
        </Badge>
        <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          {story.chapter_title}
        </h2>
        <p className="text-lg text-muted-foreground italic">
          "{story.intro_line}"
        </p>
      </div>

      <Separator className="bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      {/* Main Story */}
      <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
        <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
          {story.main_story}
        </div>
      </div>

      {/* Climax Moment Highlight */}
      <Card className="p-4 bg-primary/10 border-primary/30">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
          <div className="space-y-1">
            <p className="font-semibold text-sm text-primary">The Turning Point</p>
            <p className="text-sm text-foreground/80">{story.climax_moment}</p>
          </div>
        </div>
      </Card>

      {/* Companion Spotlights */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>Heroes of This Tale</span>
        </div>
        <div className="grid gap-2">
          {story.companion_spotlights.map((spotlight, idx) => (
            <Card key={idx} className="p-3 bg-secondary/20 border-secondary/30">
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="text-xs">
                  {spotlight.companion_name}
                </Badge>
                <p className="text-sm text-foreground/80 flex-1">
                  {spotlight.role_played}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Bond Lesson */}
      <Card className="p-4 bg-gradient-to-r from-secondary/10 to-primary/10 border-primary/20">
        <div className="flex items-start gap-3">
          <Heart className="w-5 h-5 text-secondary flex-shrink-0 mt-1" />
          <div className="space-y-1">
            <p className="font-semibold text-sm text-secondary">Wisdom Gained</p>
            <p className="text-sm text-foreground/80 italic">{story.bond_lesson}</p>
          </div>
        </div>
      </Card>

      {/* Next Hook */}
      {story.next_hook && (
        <div className="text-center pt-4 border-t border-border/50">
          <p className="text-sm text-muted-foreground italic">
            {story.next_hook}
          </p>
        </div>
      )}
    </Card>
  );
};