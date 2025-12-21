/**
 * useGuildRituals Hook
 * Manages guild rituals and attendance functionality
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface GuildRitual {
  id: string;
  community_id: string | null;
  epic_id: string | null;
  name: string;
  description: string | null;
  ritual_type: string;
  scheduled_days: number[];
  scheduled_time: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface RitualAttendance {
  id: string;
  ritual_id: string;
  user_id: string;
  ritual_date: string;
  attended_at: string;
}

interface UseGuildRitualsOptions {
  epicId?: string;
  communityId?: string;
}

export const useGuildRituals = ({ epicId, communityId }: UseGuildRitualsOptions) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch active rituals
  const { data: rituals, isLoading } = useQuery({
    queryKey: ["guild-rituals", epicId, communityId],
    queryFn: async () => {
      let query = supabase
        .from("guild_rituals")
        .select("*")
        .eq("is_active", true)
        .order("scheduled_time", { ascending: true });

      if (epicId) {
        query = query.eq("epic_id", epicId);
      } else if (communityId) {
        query = query.eq("community_id", communityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as GuildRitual[];
    },
    enabled: !!(epicId || communityId),
  });

  // Fetch today's attendance
  const today = new Date().toISOString().split('T')[0];
  
  const { data: todayAttendance } = useQuery({
    queryKey: ["ritual-attendance-today", user?.id, today],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("guild_ritual_attendance")
        .select("*")
        .eq("user_id", user.id)
        .eq("ritual_date", today);

      if (error) throw error;
      return data as RitualAttendance[];
    },
    enabled: !!user,
  });

  // Mark attendance
  const markAttendance = useMutation({
    mutationFn: async (ritualId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("guild_ritual_attendance")
        .insert({
          ritual_id: ritualId,
          user_id: user.id,
          ritual_date: today,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Ritual attended! 🌟",
        description: "You've completed this ritual.",
      });
      queryClient.invalidateQueries({ queryKey: ["ritual-attendance-today"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to mark attendance",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const hasAttendedToday = (ritualId: string) => 
    todayAttendance?.some(a => a.ritual_id === ritualId) ?? false;

  return {
    rituals,
    markAttendance,
    hasAttendedToday,
    isLoading,
    isMarking: markAttendance.isPending,
  };
};