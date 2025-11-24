import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useXPToast } from "@/contexts/XPContext";

export const useEpics = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showXPToast } = useXPToast();

  // Fetch all epics for the user
  const { data: epics, isLoading } = useQuery({
    queryKey: ["epics", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("epics")
        .select(`
          *,
          epic_habits(
            habit_id,
            habits(id, title, difficulty)
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Create new epic
  const createEpic = useMutation({
    mutationFn: async (epicData: {
      title: string;
      description?: string;
      target_days: number;
      habit_ids: string[];
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Create the epic
      const { data: epic, error: epicError } = await supabase
        .from("epics")
        .insert({
          user_id: user.id,
          title: epicData.title,
          description: epicData.description,
          target_days: epicData.target_days,
          xp_reward: Math.floor(epicData.target_days * 10), // 10 XP per day
        })
        .select()
        .single();

      if (epicError) throw epicError;

      // Link habits to epic
      if (epicData.habit_ids.length > 0) {
        const { error: linkError } = await supabase
          .from("epic_habits")
          .insert(
            epicData.habit_ids.map((habit_id) => ({
              epic_id: epic.id,
              habit_id,
            }))
          );

        if (linkError) throw linkError;
      }

      return epic;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      toast.success("Epic quest created! 🎯", {
        description: "Your companion is excited for this legendary journey!",
      });
    },
    onError: (error) => {
      console.error("Failed to create epic:", error);
      toast.error("Failed to create epic");
    },
  });

  // Complete/abandon epic
  const updateEpicStatus = useMutation({
    mutationFn: async ({
      epicId,
      status,
    }: {
      epicId: string;
      status: "completed" | "abandoned";
    }) => {
      // Get epic details for XP reward
      const { data: epic, error: fetchError } = await supabase
        .from("epics")
        .select("xp_reward, title, progress_percentage")
        .eq("id", epicId)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from("epics")
        .update({
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", epicId);

      if (error) throw error;

      return { epic, status };
    },
    onSuccess: ({ epic, status }) => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      
      if (status === "completed") {
        // Award epic completion XP
        showXPToast(epic.xp_reward, `Epic "${epic.title}" Completed!`);
        toast.success("Epic Completed! 🏆", {
          description: `You've conquered the ${epic.title} epic! Your companion grows stronger!`,
        });
      } else {
        toast("Epic abandoned", {
          description: "You can always start a new epic when ready.",
        });
      }
    },
    onError: (error) => {
      console.error("Failed to update epic:", error);
      toast.error("Failed to update epic status");
    },
  });

  // Add habit to epic
  const addHabitToEpic = useMutation({
    mutationFn: async ({
      epicId,
      habitId,
    }: {
      epicId: string;
      habitId: string;
    }) => {
      const { error } = await supabase
        .from("epic_habits")
        .insert({ epic_id: epicId, habit_id: habitId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      toast.success("Habit linked to epic! ⚔️");
    },
    onError: (error) => {
      console.error("Failed to link habit:", error);
      toast.error("Failed to link habit to epic");
    },
  });

  // Remove habit from epic
  const removeHabitFromEpic = useMutation({
    mutationFn: async ({
      epicId,
      habitId,
    }: {
      epicId: string;
      habitId: string;
    }) => {
      const { error } = await supabase
        .from("epic_habits")
        .delete()
        .eq("epic_id", epicId)
        .eq("habit_id", habitId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      toast("Habit removed from epic");
    },
    onError: (error) => {
      console.error("Failed to remove habit:", error);
      toast.error("Failed to remove habit from epic");
    },
  });

  const activeEpics = epics?.filter((e) => e.status === "active") || [];
  const completedEpics = epics?.filter((e) => e.status === "completed") || [];

  return {
    epics: epics || [],
    activeEpics,
    completedEpics,
    isLoading,
    createEpic: createEpic.mutate,
    isCreating: createEpic.isPending,
    updateEpicStatus: updateEpicStatus.mutate,
    addHabitToEpic: addHabitToEpic.mutate,
    removeHabitFromEpic: removeHabitFromEpic.mutate,
  };
};
