import { useQuery } from "@tanstack/react-query";
import { getDocuments } from "@/lib/firebase/firestore";
import { useAuth } from "./useAuth";

export const useUnreadGuildStories = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["unread-guild-stories", user?.uid],
    queryFn: async () => {
      if (!user?.uid) return 0;

      // Get all epics user is member of or owns
      const [ownedEpics, memberEpics] = await Promise.all([
        getDocuments<{ id: string }>("epics", [["user_id", "==", user.uid]]),
        getDocuments<{ epic_id: string }>("epic_members", [["user_id", "==", user.uid]]),
      ]);

      const epicIds = new Set<string>();
      ownedEpics.forEach(e => epicIds.add(e.id));
      memberEpics.forEach(m => epicIds.add(m.epic_id));

      if (epicIds.size === 0) return 0;

      // Get all guild stories for these epics
      const allStoriesPromises = Array.from(epicIds).map(epicId =>
        getDocuments<{ id: string }>("guild_stories", [["epic_id", "==", epicId]])
      );
      const allStoriesArrays = await Promise.all(allStoriesPromises);
      const allStories = allStoriesArrays.flat();

      if (allStories.length === 0) return 0;

      // Get read stories for this user
      const readStories = await getDocuments<{ story_id: string }>(
        "guild_story_reads",
        [["user_id", "==", user.uid]]
      );

      const readStoryIds = new Set(readStories.map(r => r.story_id));
      const unreadCount = allStories.filter(s => !readStoryIds.has(s.id)).length;

      return unreadCount;
    },
    enabled: !!user?.uid,
    staleTime: 30 * 1000, // 30 seconds
  });
};
