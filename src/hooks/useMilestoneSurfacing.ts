import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { calculateChapterMilestones } from '@/utils/epicMilestones';

export interface EpicMilestone {
  id: string;
  epic_id: string;
  epic_title: string;
  milestone_percent: number;
  title: string;
  description: string | null;
  chapter_number: number | null;
  is_surfaced: boolean;
  surfaced_at: string | null;
  completed_at: string | null;
  task_id: string | null;
}

export function useMilestoneSurfacing(selectedDate?: Date) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const taskDate = format(selectedDate || new Date(), 'yyyy-MM-dd');

  // Fetch milestones that are ready to be surfaced
  const { data: milestones, isLoading, error } = useQuery({
    queryKey: ['milestone-surfacing', user?.id, taskDate],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get active epics with their progress
      const { data: epics, error: epicsError } = await supabase
        .from('epics')
        .select('id, title, progress_percentage, total_chapters, target_days')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (epicsError) throw epicsError;

      // Get existing milestones
      const { data: existingMilestones, error: milestonesError } = await supabase
        .from('epic_milestones')
        .select('*')
        .eq('user_id', user.id);

      if (milestonesError) throw milestonesError;

      const milestoneMap = new Map(
        existingMilestones?.map(m => [`${m.epic_id}-${m.milestone_percent}`, m]) || []
      );

      const allMilestones: EpicMilestone[] = [];

      for (const epic of epics || []) {
        const totalChapters = epic.total_chapters || 5;
        const chapterMilestones = calculateChapterMilestones(totalChapters);

        chapterMilestones.forEach((percent, index) => {
          const key = `${epic.id}-${percent}`;
          const existing = milestoneMap.get(key);
          const chapterNum = index + 1;

          allMilestones.push({
            id: existing?.id || key,
            epic_id: epic.id,
            epic_title: epic.title,
            milestone_percent: percent,
            title: existing?.title || `Chapter ${chapterNum}`,
            description: existing?.description || null,
            chapter_number: chapterNum,
            is_surfaced: existing?.is_surfaced || false,
            surfaced_at: existing?.surfaced_at || null,
            completed_at: existing?.completed_at || null,
            task_id: existing?.task_id || null,
          });
        });
      }

      return allMilestones;
    },
    enabled: !!user?.id,
  });

  // Surface a milestone as a task
  const surfaceMilestoneMutation = useMutation({
    mutationFn: async ({ epicId, milestonePercent, title }: { 
      epicId: string; 
      milestonePercent: number; 
      title: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Create the task
      const { data: task, error: taskError } = await supabase
        .from('daily_tasks')
        .insert({
          user_id: user.id,
          task_text: `🏆 ${title}`,
          task_date: taskDate,
          epic_id: epicId,
          is_milestone: true,
          source: 'milestone',
        })
        .select('id')
        .single();

      if (taskError) throw taskError;

      // Upsert the milestone record
      const { error: milestoneError } = await supabase
        .from('epic_milestones')
        .upsert({
          epic_id: epicId,
          user_id: user.id,
          milestone_percent: milestonePercent,
          title,
          is_surfaced: true,
          surfaced_at: new Date().toISOString(),
          task_id: task.id,
        }, {
          onConflict: 'epic_id,milestone_percent',
        });

      if (milestoneError) throw milestoneError;

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestone-surfacing'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Get milestones ready to surface (reached but not yet surfaced)
  const readyToSurface = milestones?.filter(m => {
    // Find the epic's current progress
    const epicMilestones = milestones.filter(em => em.epic_id === m.epic_id);
    const maxReachedPercent = Math.max(
      ...epicMilestones
        .filter(em => em.is_surfaced || em.completed_at)
        .map(em => em.milestone_percent),
      0
    );
    
    // This milestone is ready if it's the next one after the last surfaced
    return !m.is_surfaced && m.milestone_percent > maxReachedPercent;
  }).slice(0, 1) || []; // Only show the next one

  return {
    milestones: milestones || [],
    readyToSurface,
    isLoading,
    error,
    surfaceMilestone: surfaceMilestoneMutation.mutate,
    pendingMilestonesCount: readyToSurface.length,
  };
}
