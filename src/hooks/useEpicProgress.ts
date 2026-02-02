import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, differenceInDays } from 'date-fns';
import { 
  calculateTotalChapters, 
  getCurrentChapter, 
  getNextMilestone,
  getChapterProgress 
} from '@/utils/epicMilestones';

export interface EpicProgressData {
  id: string;
  title: string;
  description: string | null;
  progress_percentage: number;
  target_days: number;
  total_chapters: number;
  current_chapter: number;
  chapter_progress: number;
  next_milestone: number | null;
  days_elapsed: number;
  days_remaining: number;
  habits_today: {
    total: number;
    completed: number;
  };
  streak: number;
  is_on_track: boolean;
}

export function useEpicProgress(epicId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  // Fetch epic progress data
  const { data: epicProgress, isLoading, error } = useQuery({
    queryKey: ['epic-progress', user?.id, epicId, today],
    queryFn: async () => {
      if (!user?.id) return null;

      // Build query for single epic or all active epics
      let query = supabase
        .from('epics')
        .select(`
          id,
          title,
          description,
          progress_percentage,
          target_days,
          total_chapters,
          start_date,
          end_date,
          story_type_slug,
          epic_habits(
            habit_id,
            habits(id, title, frequency, custom_days)
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (epicId) {
        query = query.eq('id', epicId);
      }

      const { data: epics, error: epicsError } = await query;
      if (epicsError) throw epicsError;

      if (!epics || epics.length === 0) return epicId ? null : [];

      // Get today's habit completions
      const habitIds = epics.flatMap(e => 
        e.epic_habits?.map(eh => eh.habit_id) || []
      );

      const { data: completions } = await supabase
        .from('habit_completions')
        .select('habit_id')
        .eq('user_id', user.id)
        .eq('date', today)
        .in('habit_id', habitIds);

      const completedHabitIds = new Set(completions?.map(c => c.habit_id) || []);

      // Get streak data from progress log
      const epicIds = epics.map(e => e.id);
      const { data: progressLogs } = await supabase
        .from('epic_progress_log')
        .select('epic_id, date, habits_completed, habits_total')
        .eq('user_id', user.id)
        .in('epic_id', epicIds)
        .order('date', { ascending: false })
        .limit(30);

      // Calculate progress for each epic
      const progressData: EpicProgressData[] = epics.map(epic => {
        const totalChapters = epic.total_chapters || calculateTotalChapters(epic.target_days, 5);
        const progress = epic.progress_percentage || 0;
        const currentChapter = getCurrentChapter(progress, totalChapters);
        const chapterInfo = getChapterProgress(progress, totalChapters);
        const nextMilestone = getNextMilestone(progress, totalChapters);

        const startDate = new Date(epic.start_date);
        const endDate = epic.end_date ? new Date(epic.end_date) : null;
        const daysElapsed = differenceInDays(new Date(), startDate);
        const daysRemaining = endDate ? differenceInDays(endDate, new Date()) : epic.target_days - daysElapsed;

        const epicHabits = epic.epic_habits || [];
        const habitsToday = {
          total: epicHabits.length,
          completed: epicHabits.filter(eh => completedHabitIds.has(eh.habit_id)).length,
        };

        // Calculate streak from progress logs
        const epicLogs = progressLogs?.filter(l => l.epic_id === epic.id) || [];
        let streak = 0;
        for (const log of epicLogs) {
          if (log.habits_completed && log.habits_completed > 0) {
            streak++;
          } else {
            break;
          }
        }

        // Check if on track (progress should roughly match days elapsed / target_days)
        const expectedProgress = Math.min(100, (daysElapsed / epic.target_days) * 100);
        const isOnTrack = progress >= expectedProgress * 0.8; // 80% of expected is considered on track

        return {
          id: epic.id,
          title: epic.title,
          description: epic.description,
          progress_percentage: progress,
          target_days: epic.target_days,
          total_chapters: totalChapters,
          current_chapter: currentChapter,
          chapter_progress: chapterInfo.progressInChapter,
          next_milestone: nextMilestone,
          days_elapsed: Math.max(0, daysElapsed),
          days_remaining: Math.max(0, daysRemaining),
          habits_today: habitsToday,
          streak,
          is_on_track: isOnTrack,
        };
      });

      return epicId ? progressData[0] || null : progressData;
    },
    enabled: !!user?.id,
  });

  // Update epic progress when habits are completed
  const recalculateProgressMutation = useMutation({
    mutationFn: async (targetEpicId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Get the epic
      const { data: epic, error: epicError } = await supabase
        .from('epics')
        .select('id, target_days, start_date, end_date')
        .eq('id', targetEpicId)
        .maybeSingle();
      
      if (!epic) throw new Error('Epic not found');

      if (epicError) throw epicError;

      // Count days with any habit completion
      const { data: progressLogs, error: logsError } = await supabase
        .from('epic_progress_log')
        .select('date')
        .eq('epic_id', targetEpicId)
        .eq('user_id', user.id)
        .gt('habits_completed', 0);

      if (logsError) throw logsError;

      const daysWithProgress = progressLogs?.length || 0;
      const newProgress = Math.min(100, (daysWithProgress / epic.target_days) * 100);

      // Update epic progress
      const { error: updateError } = await supabase
        .from('epics')
        .update({ 
          progress_percentage: Math.round(newProgress),
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetEpicId);

      if (updateError) throw updateError;

      return { progress: newProgress };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epic-progress'] });
      queryClient.invalidateQueries({ queryKey: ['epics'] });
    },
  });

  return {
    epicProgress,
    isLoading,
    error,
    recalculateProgress: recalculateProgressMutation.mutate,
  };
}

// Hook to get all active epics progress summary
export function useActiveEpicsProgress() {
  const result = useEpicProgress();
  
  return {
    ...result,
    epics: Array.isArray(result.epicProgress) ? result.epicProgress : [],
  };
}
