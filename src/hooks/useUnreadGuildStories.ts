import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useUnreadGuildStories = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["unread-guild-stories", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      // Get all epics user is member of or owns
      const { data: ownedEpics } = await supabase
        .from("epics")
        .select("id")
        .eq("user_id", user.id);

      const { data: memberEpics } = await supabase
        .from("epic_members")
        .select("epic_id")
        .eq("user_id", user.id);

      const epicIds = new Set<string>();
      ownedEpics?.forEach(e => epicIds.add(e.id));
      memberEpics?.forEach(m => epicIds.add(m.epic_id));

      if (epicIds.size === 0) return 0;

      // Get all guild stories for these epics
      const { data: allStories } = await supabase
        .from("guild_stories")
        .select("id")
        .in("epic_id", Array.from(epicIds));

      if (!allStories || allStories.length === 0) return 0;

      // Get read stories for this user
      const { data: readStories } = await supabase
        .from("guild_story_reads")
        .select("story_id")
        .eq("user_id", user.id);

      const readStoryIds = new Set(readStories?.map(r => r.story_id) || []);
      const unreadCount = allStories.filter(s => !readStoryIds.has(s.id)).length;

      return unreadCount;
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
  });
};
