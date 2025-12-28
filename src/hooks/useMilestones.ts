import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallback } from "react";
import { toast } from "sonner";

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
  });

  // Group milestones by phase
  const milestonesByPhase: MilestonesByPhase[] = milestones.reduce((acc, milestone) => {
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
  milestonesByPhase.sort((a, b) => a.phaseOrder - b.phaseOrder);

  // Calculate stats
  const completedCount = milestones.filter(m => m.completed_at).length;
  const totalCount = milestones.length;
  const nextMilestone = milestones.find(m => !m.completed_at);
  const postcardMilestones = milestones.filter(m => m.is_postcard_milestone);

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

  // Get current phase based on today's date
  const getCurrentPhase = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const phase of milestonesByPhase) {
      const incompleteMilestones = phase.milestones.filter(m => !m.completed_at);
      if (incompleteMilestones.length > 0) {
        return phase.phaseName;
      }
    }
    return milestonesByPhase[milestonesByPhase.length - 1]?.phaseName || null;
  }, [milestonesByPhase]);

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
    isMilestoneOverdue,
    getDaysUntilMilestone,
    isCompleting: completeMilestone.isPending,
  };
};
