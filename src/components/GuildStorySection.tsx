import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { BookOpen, Sparkles, Loader2, Lock } from "lucide-react";
import { useGuildStories } from "@/hooks/useGuildStories";
import { GuildStoryChapter } from "./GuildStoryChapter";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";

interface GuildStorySectionProps {
  epicId: string;
  memberCount: number;
}

export const GuildStorySection = ({ epicId, memberCount }: GuildStorySectionProps) => {
  const { stories, latestStory, isLoading, generateStory, isGenerating } = useGuildStories(epicId);
  const [showAllStories, setShowAllStories] = useState(false);

  const canGenerateStory = memberCount >= 2;

  const handleGenerateStory = () => {
    generateStory.mutate(epicId);
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading guild stories...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Guild Chronicles</h3>
        </div>
        
        {stories && stories.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllStories(true)}
          >
            View All ({stories.length})
          </Button>
        )}
      </div>

      {/* Latest Story or Empty State */}
      {latestStory ? (
        <GuildStoryChapter story={latestStory} />
      ) : (
        <Card className="p-8 text-center space-y-4 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-lg">No Guild Stories Yet</h4>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Create your first collaborative adventure featuring all guild companions working together!
            </p>
          </div>
          {!canGenerateStory && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span>Need at least 2 members to generate guild stories</span>
            </div>
          )}
        </Card>
      )}

      {/* Generate Button */}
      <Button
        onClick={handleGenerateStory}
        disabled={!canGenerateStory || isGenerating}
        className="w-full"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Weaving Your Tale...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            {latestStory ? "Write Next Chapter" : "Create First Story"}
          </>
        )}
      </Button>

      {!canGenerateStory && (
        <p className="text-xs text-center text-muted-foreground">
          Invite more members to unlock guild stories (1 story per 24 hours)
        </p>
      )}

      {/* All Stories Dialog */}
      <Dialog open={showAllStories} onOpenChange={setShowAllStories}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>All Guild Chronicles</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6">
              {stories?.map((story) => (
                <GuildStoryChapter key={story.id} story={story} />
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};