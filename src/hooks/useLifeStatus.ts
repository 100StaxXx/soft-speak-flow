import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type LifeStatus = 'active' | 'vacation' | 'sick' | 'transition';
export type StatMode = 'casual' | 'rpg';

interface StatusConfig {
  duration: number;
  label: string;
  icon: string;
  description: string;
}

export const STATUS_CONFIG: Record<LifeStatus, StatusConfig> = {
  active: { 
    duration: 0, 
    label: 'Active', 
    icon: '✅',
    description: 'Normal maintenance applies'
  },
  vacation: { 
    duration: 14, 
    label: 'Vacation', 
    icon: '🏖️',
    description: 'Maintenance reduced to 25%'
  },
  sick: { 
    duration: 30, 
    label: 'Sick', 
    icon: '🤒',
    description: 'Maintenance reduced to 10%'
  },
  transition: { 
    duration: 21, 
    label: 'Life Transition', 
    icon: '🔄',
    description: 'Maintenance reduced to 50%'
  },
};

export const useLifeStatus = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["lifeStatus", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("life_status, life_status_set_at, life_status_expires_at, stat_mode, stats_enabled")
        .eq("id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const setLifeStatus = useMutation({
    mutationFn: async (newStatus: LifeStatus) => {
      if (!user) throw new Error("Not authenticated");

      const now = new Date();
      const config = STATUS_CONFIG[newStatus];
      const expiresAt = config.duration > 0
        ? new Date(now.getTime() + config.duration * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { error } = await supabase
        .from("profiles")
        .update({
          life_status: newStatus,
          life_status_set_at: now.toISOString(),
          life_status_expires_at: expiresAt,
        })
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["lifeStatus"] });
      toast.success(`Life status updated to ${STATUS_CONFIG[newStatus].label}`);
    },
    onError: (error) => {
      console.error('Failed to update life status:', error);
      toast.error('Failed to update life status');
    },
  });

  const setStatMode = useMutation({
    mutationFn: async (mode: StatMode) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({ stat_mode: mode })
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: (_, mode) => {
      queryClient.invalidateQueries({ queryKey: ["lifeStatus"] });
      toast.success(`Stat mode set to ${mode === 'rpg' ? 'RPG' : 'Casual'}`);
    },
    onError: (error) => {
      console.error('Failed to update stat mode:', error);
      toast.error('Failed to update stat mode');
    },
  });

  const setStatsEnabled = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({ stats_enabled: enabled })
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["lifeStatus"] });
      toast.success(enabled ? 'Stats enabled' : 'Stats disabled (task manager mode)');
    },
    onError: (error) => {
      console.error('Failed to toggle stats:', error);
      toast.error('Failed to toggle stats');
    },
  });

  return {
    currentStatus: (status?.life_status ?? 'active') as LifeStatus,
    statMode: (status?.stat_mode ?? 'casual') as StatMode,
    statsEnabled: status?.stats_enabled ?? true,
    expiresAt: status?.life_status_expires_at,
    isLoading,
    setLifeStatus: setLifeStatus.mutateAsync,
    setStatMode: setStatMode.mutateAsync,
    setStatsEnabled: setStatsEnabled.mutateAsync,
    STATUS_CONFIG,
  };
};
