import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useAIInteractionTracker } from "@/hooks/useAIInteractionTracker";
import type { StoryTypeSlug } from "@/types/narrativeTypes";

// Helper to normalize difficulty values to valid database enum
const normalizeDifficulty = (value: string): 'easy' | 'medium' | 'hard' => {
  const lower = value?.toLowerCase()?.trim() || 'medium';
  if (['easy', 'simple', 'beginner', 'low'].includes(lower)) return 'easy';
  if (['hard', 'difficult', 'advanced', 'high', 'challenging'].includes(lower)) return 'hard';
  return 'medium';
};

// Helper to normalize frequency values to valid database enum
const normalizeFrequency = (value: string): 'daily' | '5x_week' | '3x_week' | 'custom' => {
  const lower = value?.toLowerCase()?.trim()?.replace(/\s+/g, '_') || 'daily';
  if (['daily', 'everyday', 'every_day', '7x_week', '7x'].includes(lower)) return 'daily';
  if (['5x_week', '5x', 'weekdays', 'five_times', '5_times'].includes(lower)) return '5x_week';
  if (['3x_week', '3x', 'three_times', '3_times', 'thrice'].includes(lower)) return '3x_week';
  if (['weekly', 'biweekly', 'twice', '2x', '2x_week', 'once', '1x', 'custom', 'twice_daily'].includes(lower)) return 'custom';
  return 'daily';
};

// Helper to normalize theme color to valid database constraint values
const normalizeThemeColor = (value: string | undefined): 'heroic' | 'warrior' | 'mystic' | 'nature' | 'solar' => {
  if (!value) return 'heroic';
  const lower = value.toLowerCase().trim();
  
  // Direct matches for valid values
  if (['heroic', 'warrior', 'mystic', 'nature', 'solar'].includes(lower)) {
    return lower as 'heroic' | 'warrior' | 'mystic' | 'nature' | 'solar';
  }
  
  // Map hex values to ids (backward compatibility)
  const hexMap: Record<string, 'heroic' | 'warrior' | 'mystic' | 'nature' | 'solar'> = {
    '#f59e0b': 'heroic',
    '#ef4444': 'warrior',
    '#10b981': 'nature',
    '#ec4899': 'mystic',
    '#f97316': 'solar',
    '#8b5cf6': 'mystic',  // cosmic -> mystic
    '#3b82f6': 'heroic',  // ocean -> heroic
    '#475569': 'warrior', // shadow -> warrior
  };
  
  return hexMap[lower] || 'heroic';
};

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
  const { trackEpicOutcome } = useAIInteractionTracker();

  // Fetch all epics for the user
  const { data: epics, isLoading, error: epicsError } = useQuery({
    queryKey: ["epics", user?.id],
    queryFn: async () => {
      // Double-check user exists (defensive - enabled should prevent this)
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("epics")
        .select(`
          *,
          epic_habits(
            habit_id,
            habits(id, title, difficulty, description, frequency, estimated_minutes)
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error('Failed to fetch epics:', error);
        throw error;
      }
      return data || [];
    },
    enabled: !!user?.id,
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
      story_type_slug?: StoryTypeSlug;
      habits: Array<{
        title: string;
        description?: string;
        difficulty: string;
        frequency: string;
        custom_days: number[];
        preferred_time?: string;
        reminder_enabled?: boolean;
        reminder_minutes_before?: number;
        estimated_minutes?: number;
      }>;
      milestones?: Array<{
        title: string;
        description?: string;
        target_date: string;
        milestone_percent: number;
        is_postcard_milestone: boolean;
      }>;
      phases?: Array<{
        name: string;
        description: string;
        start_date: string;
        end_date: string;
        phase_order: number;
      }>;
    }) => {
      // Get fresh session first - don't rely on potentially stale user from closure
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user?.id) {
        throw new Error("Not authenticated. Please refresh and try again.");
      }

      // Use session.user.id instead of the stale user variable
      const currentUserId = session.user.id;

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
        // Create habits first with normalized values
        const { data: habits, error: habitError } = await supabase
          .from("habits")
          .insert(
            epicData.habits.map(habit => ({
              user_id: currentUserId,
              title: habit.title,
              description: habit.description || null,
              difficulty: normalizeDifficulty(habit.difficulty),
              frequency: normalizeFrequency(habit.frequency),
              custom_days: habit.custom_days.length > 0 ? habit.custom_days : null,
              preferred_time: habit.preferred_time || null,
              reminder_enabled: habit.reminder_enabled || false,
              reminder_minutes_before: habit.reminder_minutes_before || 15,
              estimated_minutes: habit.estimated_minutes || null,
            }))
          )
          .select();

        if (habitError) {
          console.error("Failed to create habits:", habitError);
          throw new Error(`Failed to create habits: ${habitError.message}`);
        }

        if (!habits || habits.length === 0) {
          throw new Error("No habits were created");
        }

        createdHabits = habits;

        // Generate unique invite code
        const inviteCode = `EPIC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

        // Create the epic
        const { data: epic, error: epicError } = await supabase
          .from("epics")
          .insert({
            user_id: currentUserId,
            title: epicData.title,
            description: epicData.description,
            target_days: epicData.target_days,
            is_public: true,
            xp_reward: Math.floor(epicData.target_days * 10),
            invite_code: inviteCode,
            theme_color: normalizeThemeColor(epicData.theme_color),
            story_type_slug: epicData.story_type_slug || null,
          })
          .select()
          .single();

        if (epicError) {
          console.error("Failed to create epic:", epicError);
          // Rollback: delete created habits
          await supabase
            .from("habits")
            .delete()
            .in("id", createdHabits.map(h => h.id));
          throw new Error(`Failed to create epic: ${epicError.message}`);
        }

        if (!epic) {
          throw new Error("Epic creation returned no data");
        }

        createdEpic = epic;

        // Link habits to epic
        const { error: linkError } = await supabase
          .from("epic_habits")
          .insert(
            createdHabits.map((habit) => ({
              epic_id: epic.id,
              habit_id: habit.id,
            }))
          );

        if (linkError) {
          console.error("Failed to link habits:", linkError);
          // Rollback: delete epic and habits
          await supabase.from("epics").delete().eq("id", epic.id);
          await supabase
            .from("habits")
            .delete()
            .in("id", createdHabits.map(h => h.id));
          throw new Error(`Failed to link habits: ${linkError.message}`);
        }

        // Create journey phases if provided
        if (epicData.phases && epicData.phases.length > 0) {
          const { error: phasesError } = await supabase
            .from("journey_phases")
            .insert(
              epicData.phases.map(phase => ({
                epic_id: epic.id,
                user_id: currentUserId,
                name: phase.name,
                description: phase.description,
                start_date: phase.start_date,
                end_date: phase.end_date,
                phase_order: phase.phase_order,
              }))
            );

          if (phasesError) {
            console.error("Failed to create journey phases:", phasesError);
            // Non-blocking - epic still created successfully
          }
        }

        // Create milestones with dates if provided
        if (epicData.milestones && epicData.milestones.length > 0) {
          console.log('[Epic Creation] Inserting milestones:', epicData.milestones.length, epicData.milestones);
          
          const { data: insertedMilestones, error: milestonesError } = await supabase
            .from("epic_milestones")
            .insert(
              epicData.milestones.map((milestone, index) => ({
                epic_id: epic.id,
                user_id: currentUserId,
                title: milestone.title,
                description: milestone.description || null,
                target_date: milestone.target_date,
                milestone_percent: milestone.milestone_percent,
                is_postcard_milestone: milestone.is_postcard_milestone ?? false,
                phase_order: index + 1,
              }))
            )
            .select();

          if (milestonesError) {
            console.error("Failed to create milestones:", milestonesError);
            toast.error("Milestones couldn't be created", {
              description: "You can add them manually from the campaign settings",
            });
          } else {
            console.log('[Epic Creation] Successfully created milestones:', insertedMilestones?.length);
          }
        } else {
          console.log('[Epic Creation] No milestones provided in epicData');
        }

        // Trigger narrative seed generation in background if story type selected
        if (epicData.story_type_slug) {
          // Fetch companion and mentor data for richer narrative generation
          const [companionResult, profileResult] = await Promise.all([
            supabase
              .from('user_companion')
              .select('spirit_animal, core_element, favorite_color, fur_color')
              .eq('user_id', currentUserId)
              .maybeSingle(),
            supabase
              .from('profiles')
              .select('selected_mentor_id')
              .eq('id', currentUserId)
              .maybeSingle(),
          ]);

          let mentorData: { id?: string; name?: string; slug?: string } | undefined;
          
          if (profileResult.data?.selected_mentor_id) {
            const { data: mentor } = await supabase
              .from('mentors')
              .select('id, name, slug')
              .eq('id', profileResult.data.selected_mentor_id)
              .maybeSingle();
            
            if (mentor) {
              mentorData = { id: mentor.id, name: mentor.name, slug: mentor.slug || undefined };
            }
          }

          // Build milestone data for narrative generation - use the actual postcard milestones
          const postcardMilestones = epicData.milestones?.filter(m => m.is_postcard_milestone) || [];
          const totalChapters = postcardMilestones.length || 5;
          const milestoneData = postcardMilestones.map((m, idx) => ({
            chapterNumber: idx + 1,
            title: m.title,
            targetDate: m.target_date,
            milestonePercent: m.milestone_percent,
          }));

          supabase.functions.invoke('generate-epic-narrative-seed', {
            body: {
              userId: currentUserId,
              epicId: epic.id,
              epicTitle: epicData.title,
              epicDescription: epicData.description,
              targetDays: epicData.target_days,
              storyTypeSlug: epicData.story_type_slug,
              companionData: companionResult.data || undefined,
              mentorData,
              userGoal: epicData.description,
              totalChapters, // Explicitly pass the count from milestones
              milestoneData, // Pass the milestone dates for chapter alignment
            },
          }).catch(err => {
            console.error('Narrative seed generation failed:', err);
            // Non-blocking - epic still created successfully
          });
        }

        return epic;
      } catch (error) {
        // Final cleanup in case of any unexpected error
        if (createdEpic) {
          void supabase.from("epics").delete().eq("id", createdEpic.id).then(({ error: delErr }) => {
            if (delErr) console.error('Failed to cleanup epic:', delErr);
          });
        }
        if (createdHabits.length > 0) {
          void supabase
            .from("habits")
            .delete()
            .in("id", createdHabits.map(h => h.id))
            .then(({ error: delErr }) => {
              if (delErr) console.error('Failed to cleanup habits:', delErr);
            });
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
      const { data: epic, error: fetchError } = await supabase
        .from("epics")
        .select("xp_reward, title, progress_percentage, status, user_id")
        .eq("id", epicId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) {
        console.error("Failed to fetch epic:", fetchError);
        throw new Error(`Failed to fetch epic: ${fetchError.message}`);
      }

      if (!epic) {
        throw new Error("Epic not found or you don't have permission");
      }

      // Prevent double-completion XP award
      if (epic.status === "completed" && status === "completed") {
        throw new Error("Epic is already completed");
      }

      const { error } = await supabase
        .from("epics")
        .update({
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", epicId)
        .eq("user_id", user.id);

      if (error) throw error;

      return { epic, status, wasAlreadyCompleted: epic.status === "completed" };
    },
    onSuccess: async ({ epic, status, wasAlreadyCompleted }, variables) => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      
      // Track epic outcome for AI learning
      if (status === "completed" || status === "abandoned") {
        trackEpicOutcome(variables.epicId, status).catch(err => {
          console.error('Failed to track epic outcome:', err);
        });
      }
      
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
      const { data: existing } = await supabase
        .from("epic_habits")
        .select('id')
        .eq('epic_id', epicId)
        .eq('habit_id', habitId)
        .maybeSingle();

      if (existing) {
        throw new Error('Habit is already linked to this epic');
      }

      const { error } = await supabase
        .from("epic_habits")
        .insert({ epic_id: epicId, habit_id: habitId });

      if (error) {
        console.error('Failed to link habit to epic:', error);
        throw error;
      }
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

      const { error } = await supabase
        .from("epic_habits")
        .delete()
        .eq("epic_id", epicId)
        .eq("habit_id", habitId);

      if (error) {
        console.error('Failed to remove habit from epic:', error);
        throw error;
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
