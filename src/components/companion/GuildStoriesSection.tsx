import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { generateGuildStory } from "@/lib/firebase/functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Sparkles, Loader2, Users, ChevronDown, ChevronUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GuildStoryChapter } from "@/components/GuildStoryChapter";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GuildStory {
  id: string;
  epic_id: string;
  chapter_number: number;
  chapter_title: string;
  intro_line: string;
  main_story: string;
  companion_spotlights: {
    user_id: string;
    companion_name: string;
    role_played: string;
  }[];
  climax_moment: string;
  bond_lesson: string;
  next_hook: string | null;
  trigger_type: string;
  generated_at: string;
  created_at: string;
}

interface EpicWithStories {
  id: string;
  title: string;
  memberCount: number;
  stories: GuildStory[];
}

export const GuildStoriesSection = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEpicId, setSelectedEpicId] = useState<string | null>(null);
  const [showAllStories, setShowAllStories] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Fetch all epics the user is a member of with their stories
  const { data: epicsWithStories, isLoading } = useQuery<EpicWithStories[]>({
    queryKey: ["user-guild-stories", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get epics where user is owner or member
      const { data: ownedEpics } = await supabase
        .from("epics")
        .select("id, title")
        .eq("user_id", user.id)
        .eq("status", "active");

      const { data: memberEpics } = await supabase
        .from("epic_members")
        .select("epic_id, epics(id, title)")
        .eq("user_id", user.id);

      const allEpicIds = new Set<string>();
      const epicMap = new Map<string, { id: string; title: string }>();

      ownedEpics?.forEach(epic => {
        allEpicIds.add(epic.id);
        epicMap.set(epic.id, epic);
      });

      memberEpics?.forEach(m => {
        if (m.epics) {
          const epic = m.epics as { id: string; title: string };
          allEpicIds.add(epic.id);
          epicMap.set(epic.id, epic);
        }
      });

      if (allEpicIds.size === 0) return [];

      // Fetch stories and member counts for all epics in parallel
      const epicIdsArray = Array.from(allEpicIds);
      
      const results = await Promise.all(
        epicIdsArray.map(async (epicId) => {
          const epic = epicMap.get(epicId);
          if (!epic) return null;

          const [{ data: stories }, { count: memberCount }] = await Promise.all([
            supabase
              .from("guild_stories")
              .select("*")
              .eq("epic_id", epicId)
              .order("chapter_number", { ascending: true }),
            supabase
              .from("epic_members")
              .select("*", { count: "exact", head: true })
              .eq("epic_id", epicId),
          ]);

          return {
            id: epic.id,
            title: epic.title,
            memberCount: memberCount || 0,
            stories: (stories || []) as GuildStory[],
          };
        })
      );

      // Filter out null results
      return results.filter((r): r is EpicWithStories => r !== null);
    },
    enabled: !!user?.id,
  });

  // Mark story as read
  const markStoryAsRead = useMutation({
    mutationFn: async (storyId: string) => {
      if (!user?.id) return;

      const { error } = await supabase
        .from("guild_story_reads")
        .upsert({
          user_id: user.id,
          story_id: storyId,
        }, {
          onConflict: 'user_id,story_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unread-guild-stories"] });
    },
  });

  const selectedEpic = epicsWithStories?.find(e => e.id === selectedEpicId);

  // Mark stories as read when viewing
  useEffect(() => {
    if (!selectedEpic || !user?.id) return;

    // Mark all stories for the selected epic as read
    selectedEpic.stories.forEach(story => {
      markStoryAsRead.mutate(story.id);
    });
  }, [selectedEpicId, selectedEpic?.stories.length]);

  // Generate new guild story
  const generateStory = useMutation({
    mutationFn: async (epicId: string) => {
      if (!user) throw new Error("Not authenticated");

      toast.loading("Weaving your companions' tale...", { id: "guild-story-gen" });

      const data = await generateGuildStory({
        guildId: epicId,
      });

      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error((data as { error: string }).error);
      }

      return (data as { story: GuildStory }).story;
    },
    onSuccess: () => {
      toast.dismiss("guild-story-gen");
      toast.success("📖 New guild adventure unlocked!");
      queryClient.invalidateQueries({ queryKey: ["user-guild-stories"] });
    },
    onError: (error) => {
      toast.dismiss("guild-story-gen");
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to generate story. Please try again."
      );
    },
  });

  const latestStory = selectedEpic?.stories?.[selectedEpic.stories.length - 1];
  const canGenerateStory = selectedEpic && selectedEpic.memberCount >= 2;

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

  if (!epicsWithStories || epicsWithStories.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Guild Chronicles</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          Join or create an epic to unlock guild stories featuring multiple companions!
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-4"
      >
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Guild Chronicles</h3>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-4">
          {/* Epic Selector */}
          <Select
            value={selectedEpicId || ""}
            onValueChange={(value) => setSelectedEpicId(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an epic to view stories" />
            </SelectTrigger>
            <SelectContent>
              {epicsWithStories.map((epic) => (
                <SelectItem key={epic.id} value={epic.id}>
                  {epic.title} ({epic.stories.length} {epic.stories.length === 1 ? "chapter" : "chapters"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedEpic && (
            <>
              {/* Latest Story or Empty State */}
              {latestStory ? (
                <div className="space-y-3">
                  <GuildStoryChapter story={latestStory} />
                  {selectedEpic.stories.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllStories(true)}
                      className="w-full"
                    >
                      View All Chapters ({selectedEpic.stories.length})
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 space-y-3">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No stories written yet for this epic
                  </p>
                </div>
              )}

              {/* Generate Button */}
              <Button
                onClick={() => generateStory.mutate(selectedEpic.id)}
                disabled={!canGenerateStory || generateStory.isPending}
                className="w-full"
              >
                {generateStory.isPending ? (
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
                  Need at least 2 members to generate guild stories
                </p>
              )}
            </>
          )}

          {/* All Stories Dialog */}
          <Dialog open={showAllStories} onOpenChange={setShowAllStories}>
            <DialogContent className="max-w-3xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>{selectedEpic?.title} - All Chapters</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-6">
                  {selectedEpic?.stories.map((story) => (
                    <GuildStoryChapter key={story.id} story={story} />
                  ))}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </Card>
  );
};
