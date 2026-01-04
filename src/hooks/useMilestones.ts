import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";

export interface Milestone {
  id: string;
  epic_id: string;
  user_id: string;
  title: string;
  description: string | null;
  milestone_percent: number;
  completed_at: string | null;
  target_date: string | null;
  phase_name: string | null;
  phase_order: number | null;
  is_postcard_milestone: boolean | null;
  chapter_number: number | null;
  is_surfaced: boolean | null;
  surfaced_at: string | null;
}

export interface MilestonesByPhase {
  phaseName: string;
  phaseOrder: number;
  milestones: Milestone[];
}

export interface PhaseStats {
  phaseName: string;
  phaseOrder: number;
  completed: number;
  total: number;
  progress: number;
  isComplete: boolean;
  isCurrent: boolean;
  isOnTrack: boolean;
  overdueMilestones: number;
  daysUntilEnd: number | null;
  startDate: Date | null;
  endDate: Date | null;
}

export interface JourneyHealth {
  score: 'A' | 'B' | 'C' | 'D' | 'F';
  overallProgress: number;
  expectedProgress: number;
  progressDelta: number;
  velocity: number; // % per day
  estimatedCompletionDate: Date | null;
  daysAheadOrBehind: number;
  currentPhaseHealth: 'on_track' | 'at_risk' | 'behind';
}

export const useMilestones = (epicId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch milestones for a specific epic
  const { data: milestones = [], isLoading, error } = useQuery({
    queryKey: ["milestones", epicId],
    queryFn: async () => {
      if (!user || !epicId) return [];

      const { data, error } = await supabase
        .from("epic_milestones")
        .select("*")
        .eq("epic_id", epicId)
        .eq("user_id", user.id)
        .order("phase_order", { ascending: true, nullsFirst: true })
        .order("milestone_percent", { ascending: true });

      if (error) throw error;
      return data as Milestone[];
    },
    enabled: !!user && !!epicId,
    staleTime: 3 * 60 * 1000, // 3 minutes
  });

  // Group milestones by phase
  const milestonesByPhase: MilestonesByPhase[] = useMemo(() => {
    const grouped = milestones.reduce((acc, milestone) => {
      const phaseName = milestone.phase_name || "General";
      const phaseOrder = milestone.phase_order ?? 0;
      
      const existingPhase = acc.find(p => p.phaseName === phaseName);
      if (existingPhase) {
        existingPhase.milestones.push(milestone);
      } else {
        acc.push({
          phaseName,
          phaseOrder,
          milestones: [milestone],
        });
      }
      return acc;
    }, [] as MilestonesByPhase[]);

    // Sort phases by order
    return grouped.sort((a, b) => a.phaseOrder - b.phaseOrder);
  }, [milestones]);

  // Calculate stats
  const completedCount = milestones.filter(m => m.completed_at).length;
  const totalCount = milestones.length;
  const nextMilestone = milestones.find(m => !m.completed_at);
  const postcardMilestones = milestones.filter(m => m.is_postcard_milestone);

  // Get current phase based on incomplete milestones
  const getCurrentPhase = useCallback(() => {
    for (const phase of milestonesByPhase) {
      const incompleteMilestones = phase.milestones.filter(m => !m.completed_at);
      if (incompleteMilestones.length > 0) {
        return phase.phaseName;
      }
    }
    return milestonesByPhase[milestonesByPhase.length - 1]?.phaseName || null;
  }, [milestonesByPhase]);

  // Phase-aware progress calculations
  const getPhaseStats = useCallback((): PhaseStats[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentPhaseName = getCurrentPhase();

    return milestonesByPhase.map((phase) => {
      const completed = phase.milestones.filter(m => m.completed_at).length;
      const total = phase.milestones.length;
      const progress = total > 0 ? (completed / total) * 100 : 0;
      
      // Get date range
      const dates = phase.milestones
        .filter(m => m.target_date)
        .map(m => new Date(m.target_date!))
        .sort((a, b) => a.getTime() - b.getTime());
      
      const startDate = dates[0] || null;
      const endDate = dates[dates.length - 1] || null;
      
      // Check overdue milestones
      const overdueMilestones = phase.milestones.filter(m => {
        if (m.completed_at || !m.target_date) return false;
        return new Date(m.target_date) < today;
      });
      
      const daysUntilEnd = endDate ? differenceInDays(endDate, today) : null;
      
      return {
        phaseName: phase.phaseName,
        phaseOrder: phase.phaseOrder,
        completed,
        total,
        progress,
        isComplete: progress === 100,
        isCurrent: phase.phaseName === currentPhaseName,
        isOnTrack: overdueMilestones.length === 0,
        overdueMilestones: overdueMilestones.length,
        daysUntilEnd,
        startDate,
        endDate,
      };
    });
  }, [milestonesByPhase, getCurrentPhase]);

  // Get current phase progress specifically
  const getCurrentPhaseProgress = useCallback(() => {
    const stats = getPhaseStats();
    const current = stats.find(s => s.isCurrent);
    return current?.progress ?? 0;
  }, [getPhaseStats]);

  // Calculate journey health score
  const getJourneyHealth = useCallback((epicStartDate?: string, epicEndDate?: string): JourneyHealth | null => {
    if (!epicStartDate || !epicEndDate || totalCount === 0) return null;

    const today = new Date();
    const startDate = new Date(epicStartDate);
    const endDate = new Date(epicEndDate);
    
    const totalDays = differenceInDays(endDate, startDate);
    const daysElapsed = differenceInDays(today, startDate);
    const daysRemaining = differenceInDays(endDate, today);
    
    if (totalDays <= 0) return null;

    const overallProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
    const expectedProgress = Math.min(100, (daysElapsed / totalDays) * 100);
    const progressDelta = overallProgress - expectedProgress;
    
    // Calculate velocity (% completed per day)
    const velocity = daysElapsed > 0 ? overallProgress / daysElapsed : 0;
    
    // Estimate completion date
    let estimatedCompletionDate: Date | null = null;
    if (velocity > 0) {
      const remainingProgress = 100 - overallProgress;
      const daysToComplete = remainingProgress / velocity;
      estimatedCompletionDate = new Date();
      estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + daysToComplete);
    }
    
    // Calculate days ahead or behind
    const daysAheadOrBehind = velocity > 0 && estimatedCompletionDate
      ? differenceInDays(endDate, estimatedCompletionDate)
      : 0;
    
    // Determine health score
    let score: JourneyHealth['score'];
    if (progressDelta >= 10) score = 'A';
    else if (progressDelta >= 0) score = 'B';
    else if (progressDelta >= -10) score = 'C';
    else if (progressDelta >= -25) score = 'D';
    else score = 'F';
    
    // Current phase health
    const phaseStats = getPhaseStats();
    const currentPhase = phaseStats.find(p => p.isCurrent);
    let currentPhaseHealth: JourneyHealth['currentPhaseHealth'] = 'on_track';
    if (currentPhase) {
      if (currentPhase.overdueMilestones > 0) {
        currentPhaseHealth = currentPhase.overdueMilestones > 1 ? 'behind' : 'at_risk';
      }
    }

    return {
      score,
      overallProgress,
      expectedProgress,
      progressDelta,
      velocity,
      estimatedCompletionDate,
      daysAheadOrBehind,
      currentPhaseHealth,
    };
  }, [completedCount, totalCount, getPhaseStats]);

  // Check if a milestone is overdue
  const isMilestoneOverdue = useCallback((milestone: Milestone) => {
    if (milestone.completed_at || !milestone.target_date) return false;
    const targetDate = new Date(milestone.target_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    return targetDate < today;
  }, []);

  // Get days until milestone
  const getDaysUntilMilestone = useCallback((milestone: Milestone) => {
    if (!milestone.target_date) return null;
    const targetDate = new Date(milestone.target_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, []);

  // Get next postcard milestone
  const getNextPostcardMilestone = useCallback(() => {
    return milestones.find(m => m.is_postcard_milestone && !m.completed_at);
  }, [milestones]);

  // Get progress to next postcard
  const getProgressToNextPostcard = useCallback(() => {
    const nextPostcard = getNextPostcardMilestone();
    if (!nextPostcard) return null;
    
    const currentProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
    const targetPercent = nextPostcard.milestone_percent;
    
    return {
      current: currentProgress,
      target: targetPercent,
      remaining: Math.max(0, targetPercent - currentProgress),
      milestone: nextPostcard,
    };
  }, [getNextPostcardMilestone, completedCount, totalCount]);

  // Complete milestone mutation
  const completeMilestone = useMutation({
    mutationFn: async ({ 
      milestoneId,
      epicId: mutationEpicId,
      onPostcardTrigger 
    }: {
      milestoneId: string;
      epicId: string;
      onPostcardTrigger?: (milestone: Milestone) => void;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const milestone = milestones.find(m => m.id === milestoneId);
      if (!milestone) throw new Error("Milestone not found");

      const { error } = await supabase
        .from("epic_milestones")
        .update({ 
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", milestoneId)
        .eq("user_id", user.id);

      if (error) throw error;

      return { milestone, onPostcardTrigger };
    },
    onSuccess: ({ milestone, onPostcardTrigger }) => {
      queryClient.invalidateQueries({ queryKey: ["milestones", epicId] });
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      
      toast.success(`Milestone completed: ${milestone.title}`);

      // Trigger postcard generation if this is a postcard milestone
      if (milestone.is_postcard_milestone && onPostcardTrigger) {
        onPostcardTrigger(milestone);
      }
    },
    onError: (error) => {
      console.error("Failed to complete milestone:", error);
      toast.error("Failed to complete milestone");
    },
  });

  // Uncomplete milestone (for undo functionality)
  const uncompleteMilestone = useMutation({
    mutationFn: async (milestoneId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("epic_milestones")
        .update({ 
          completed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", milestoneId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones", epicId] });
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      toast.success("Milestone unmarked");
    },
    onError: (error) => {
      console.error("Failed to uncomplete milestone:", error);
      toast.error("Failed to update milestone");
    },
  });

  return {
    milestones,
    milestonesByPhase,
    isLoading,
    error,
    completedCount,
    totalCount,
    nextMilestone,
    postcardMilestones,
    completeMilestone,
    uncompleteMilestone,
    getCurrentPhase,
    getPhaseStats,
    getCurrentPhaseProgress,
    getJourneyHealth,
    isMilestoneOverdue,
    getDaysUntilMilestone,
    getNextPostcardMilestone,
    getProgressToNextPostcard,
    isCompleting: completeMilestone.isPending,
  };
};
