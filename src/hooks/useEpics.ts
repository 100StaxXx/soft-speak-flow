import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocuments, getDocument, setDocument, updateDocument, deleteDocument, timestampToISO } from "@/lib/firebase/firestore";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useXPRewards } from "@/hooks/useXPRewards";

// Type for habits created during epic creation
interface CreatedHabit {
  id: string;
  user_id: string;
  title: string;
  difficulty: string;
  frequency: string;
  custom_days: number[] | null;
}

// Type for epic record
interface CreatedEpic {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_days: number;
  is_public: boolean;
  xp_reward: number;
  invite_code: string;
}

export const useEpics = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { awardCustomXP } = useXPRewards();

  // Fetch all epics for the user
  const { data: epics, isLoading, error: epicsError } = useQuery({
    queryKey: ["epics", user?.uid],
    queryFn: async () => {
      // Double-check user exists (defensive - enabled should prevent this)
      if (!user?.uid) return [];
      
      const epicsData = await getDocuments(
        "epics",
        [["user_id", "==", user.uid]],
        "created_at",
        "desc"
      );

      // Fetch epic habits for each epic
      const epicsWithHabits = await Promise.all(
        epicsData.map(async (epic: any) => {
          const epicHabits = await getDocuments(
            "epic_habits",
            [["epic_id", "==", epic.id]]
          );

          // Fetch habit details for each epic habit
          const habits = await Promise.all(
            epicHabits.map(async (eh: any) => {
              const habit = await getDocument("habits", eh.habit_id);
              return habit ? { ...eh, habits: habit } : null;
            })
          );

          return {
            ...epic,
            epic_habits: habits.filter(Boolean),
            created_at: timestampToISO(epic.created_at as any) || epic.created_at,
            updated_at: timestampToISO(epic.updated_at as any) || epic.updated_at,
            completed_at: timestampToISO(epic.completed_at as any) || epic.completed_at,
          };
        })
      );

      return epicsWithHabits;
    },
    enabled: !!user?.uid,
    staleTime: 3 * 60 * 1000, // 3 minutes - epics don't change frequently
    refetchOnWindowFocus: false,
    retry: 2, // Retry failed requests up to 2 times
  });

  // Create new epic
  const createEpic = useMutation({
    mutationFn: async (epicData: {
      title: string;
      description?: string;
      target_days: number;
      is_public?: boolean;
      theme_color?: string;
      habits: Array<{
        title: string;
        difficulty: string;
        frequency: string;
        custom_days: number[];
      }>;
    }) => {
      if (!user) throw new Error("Not authenticated");

      if (!epicData.habits || epicData.habits.length === 0) {
        throw new Error("Epic must have at least one habit");
      }

      // Validate target_days
      if (epicData.target_days < 1 || epicData.target_days > 365) {
        throw new Error("Target days must be between 1 and 365");
      }

      let createdHabits: CreatedHabit[] = [];
      let createdEpic: CreatedEpic | null = null;

      try {
        // Create habits first
        const habitIds: string[] = [];
        for (const habit of epicData.habits) {
          const habitId = `${user.uid}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          await setDocument("habits", habitId, {
            id: habitId,
            user_id: user.uid,
            title: habit.title,
            difficulty: habit.difficulty,
            frequency: habit.frequency,
            custom_days: habit.custom_days.length > 0 ? habit.custom_days : null,
          }, false);
          habitIds.push(habitId);
        }

        createdHabits = habitIds.map(id => ({ id } as CreatedHabit));

        // Generate unique invite code
        const inviteCode = `EPIC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

        // Create the epic
        const epicId = `${user.uid}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const epic = {
          id: epicId,
          user_id: user.uid,
          title: epicData.title,
          description: epicData.description || null,
          target_days: epicData.target_days,
          is_public: true,
          xp_reward: Math.floor(epicData.target_days * 10),
          invite_code: inviteCode,
          theme_color: epicData.theme_color || 'heroic',
          status: 'active',
        };

        await setDocument("epics", epicId, epic, false);
        createdEpic = epic as CreatedEpic;

        // Link habits to epic
        for (const habitId of habitIds) {
          const linkId = `${epicId}_${habitId}`;
          await setDocument("epic_habits", linkId, {
            id: linkId,
            epic_id: epicId,
            habit_id: habitId,
          }, false);
        }

        return epic as CreatedEpic;
      } catch (error) {
        // Final cleanup in case of any unexpected error
        if (createdEpic) {
          try {
            await deleteDocument("epics", createdEpic.id);
          } catch (delErr) {
            console.error('Failed to cleanup epic:', delErr);
          }
        }
        if (createdHabits.length > 0) {
          for (const habit of createdHabits) {
            try {
              await deleteDocument("habits", habit.id);
            } catch (delErr) {
              console.error('Failed to cleanup habit:', delErr);
            }
          }
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      queryClient.invalidateQueries({ queryKey: ["habits"] });
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
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      // Get epic details for XP reward - verify ownership
      const epic = await getDocument<{
        xp_reward: number;
        title: string;
        progress_percentage: number;
        status: string;
        user_id: string;
      }>("epics", epicId);

      if (!epic) {
        throw new Error("Epic not found");
      }

      if (epic.user_id !== user.uid) {
        throw new Error("You don't have permission to update this epic");
      }

      // Prevent double-completion XP award
      if (epic.status === "completed" && status === "completed") {
        throw new Error("Epic is already completed");
      }

      await updateDocument("epics", epicId, {
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      });

      return { epic, status, wasAlreadyCompleted: epic.status === "completed" };
    },
    onSuccess: async ({ epic, status, wasAlreadyCompleted }, variables) => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      
      if (status === "completed" && !wasAlreadyCompleted) {
        // Only award XP if this is the FIRST time completing
        try {
          await awardCustomXP(
            epic.xp_reward,
            "epic_complete",
            `Epic "${epic.title}" Completed!`,
            { epic_id: variables?.epicId }
          );
        } catch (error) {
          console.error("Failed to award epic completion XP:", error);
        }
        toast.success("Epic Completed! 🏆", {
          description: `You've conquered the ${epic.title} epic! Your companion grows stronger!`,
        });
      } else if (status === "abandoned") {
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
      if (!epicId || !habitId) {
        throw new Error('Invalid epic or habit ID');
      }

      // Check if habit is already linked to prevent duplicates
      const existing = await getDocuments(
        "epic_habits",
        [
          ["epic_id", "==", epicId],
          ["habit_id", "==", habitId],
        ]
      );

      if (existing.length > 0) {
        throw new Error('Habit is already linked to this epic');
      }

      const linkId = `${epicId}_${habitId}`;
      await setDocument("epic_habits", linkId, {
        id: linkId,
        epic_id: epicId,
        habit_id: habitId,
      }, false);
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
      if (!epicId || !habitId) {
        throw new Error('Invalid epic or habit ID');
      }

      // Find and delete the epic_habit link
      const links = await getDocuments(
        "epic_habits",
        [
          ["epic_id", "==", epicId],
          ["habit_id", "==", habitId],
        ]
      );

      if (links.length === 0) {
        throw new Error('Habit is not linked to this epic');
      }

      for (const link of links) {
        await deleteDocument("epic_habits", link.id);
      }
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
    error: epicsError,
    createEpic: createEpic.mutate,
    isCreating: createEpic.isPending,
    updateEpicStatus: updateEpicStatus.mutate,
    addHabitToEpic: addHabitToEpic.mutate,
    removeHabitFromEpic: removeHabitFromEpic.mutate,
  };
};
