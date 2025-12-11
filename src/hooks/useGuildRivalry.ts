import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocuments, getDocument, setDocument, deleteDocument, timestampToISO } from "@/lib/firebase/firestore";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface GuildRivalry {
  id: string;
  epic_id: string;
  user_id: string;
  rival_id: string;
  created_at: string;
  rival?: {
    email: string | null;
  };
}

export const useGuildRivalry = (epicId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's rivalry in this epic
  const { data: rivalry, isLoading } = useQuery<GuildRivalry | null>({
    queryKey: ["guild-rivalry", epicId, user?.uid],
    queryFn: async () => {
      if (!epicId || !user) return null;

      const rivalries = await getDocuments<GuildRivalry>(
        "guild_rivalries",
        [
          ["epic_id", "==", epicId],
          ["user_id", "==", user.uid],
        ]
      );

      if (rivalries.length === 0) return null;

      const rivalryData = rivalries[0];
      
      // Fetch rival profile
      const rival = await getDocument<{ email: string | null }>("profiles", rivalryData.rival_id);

      return {
        ...rivalryData,
        created_at: timestampToISO(rivalryData.created_at as any) || rivalryData.created_at || new Date().toISOString(),
        rival: rival || undefined,
      };
    },
    enabled: !!epicId && !!user,
  });

  // Set a rival
  const setRival = useMutation({
    mutationFn: async (rivalId: string) => {
      if (!user || !epicId) throw new Error("Not authenticated or no epic");

      // Prevent self-rivalry
      if (rivalId === user.uid) {
        throw new Error("You cannot set yourself as a rival");
      }

      // Upsert rivalry (replace if exists)
      const rivalryId = `${epicId}_${user.uid}`;
      const rivalryData = {
        id: rivalryId,
        epic_id: epicId,
        user_id: user.uid,
        rival_id: rivalId,
      };

      await setDocument("guild_rivalries", rivalryId, rivalryData, false);

      return rivalryData as GuildRivalry;
    },
    onSuccess: () => {
      toast.success("Rival set! ⚔️ Let the competition begin!");
      queryClient.invalidateQueries({ queryKey: ["guild-rivalry", epicId] });
    },
    onError: (error) => {
      toast.error("Failed to set rival");
      console.error("Rivalry error:", error);
    },
  });

  // Remove rivalry
  const removeRival = useMutation({
    mutationFn: async () => {
      if (!user || !epicId) throw new Error("Not authenticated or no epic");

      const rivalries = await getDocuments(
        "guild_rivalries",
        [
          ["epic_id", "==", epicId],
          ["user_id", "==", user.uid],
        ]
      );

      for (const rivalry of rivalries) {
        await deleteDocument("guild_rivalries", rivalry.id);
      }
    },
    onSuccess: () => {
      toast.success("Rivalry ended");
      queryClient.invalidateQueries({ queryKey: ["guild-rivalry", epicId] });
    },
    onError: (error) => {
      toast.error("Failed to remove rival");
      console.error("Remove rivalry error:", error);
    },
  });

  return {
    rivalry,
    rivalId: rivalry?.rival_id || null,
    isLoading,
    setRival,
    removeRival,
    isSettingRival: setRival.isPending,
  };
};
