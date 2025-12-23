import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface CommunityMember {
  id: string;
  community_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  total_contribution: number;
  joined_at: string;
  last_activity_at: string;
  profile?: {
    id: string;
    email: string | null;
    onboarding_data?: unknown;
  };
  companion?: {
    id: string;
    current_xp: number;
    current_stage: number;
    spirit_animal: string;
    current_image_url: string | null;
  };
}

export const useCommunityMembers = (communityId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch members of a community
  const { data: members, isLoading } = useQuery<CommunityMember[]>({
    queryKey: ["community-members", communityId],
    queryFn: async () => {
      if (!communityId) return [];

      // First get community members
      const { data: membersData, error: membersError } = await supabase
        .from("community_members")
        .select("*")
        .eq("community_id", communityId)
        .order("total_contribution", { ascending: false });

      if (membersError) throw membersError;
      if (!membersData || membersData.length === 0) return [];

      // Get user IDs to fetch profiles and companions
      const userIds = membersData.map(m => m.user_id);

      // Fetch profiles for these users (including onboarding_data for display name)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, onboarding_data")
        .in("id", userIds);

      // Fetch companions for these users
      const { data: companions } = await supabase
        .from("user_companion")
        .select("id, user_id, current_xp, current_stage, spirit_animal, current_image_url")
        .in("user_id", userIds);

      // Map data together
      return membersData.map(member => {
        const profile = profiles?.find(p => p.id === member.user_id);
        const companion = companions?.find(c => c.user_id === member.user_id);
        
        return {
          ...member,
          role: member.role as 'owner' | 'admin' | 'member',
          profile: profile ? {
            id: profile.id,
            email: profile.email,
            onboarding_data: profile.onboarding_data,
          } : undefined,
          companion: companion ? {
            id: companion.id,
            current_xp: companion.current_xp,
            current_stage: companion.current_stage,
            spirit_animal: companion.spirit_animal,
            current_image_url: companion.current_image_url,
          } : undefined,
        };
      }) as CommunityMember[];
    },
    enabled: !!communityId,
  });

  // Get current user's membership
  const currentUserMember = members?.find(m => m.user_id === user?.id);

  // Join a community (uses security definer function to bypass RLS for FK validation)
  const joinCommunity = useMutation({
    mutationFn: async (targetCommunityId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .rpc('join_community_by_id', { p_community_id: targetCommunityId });

      if (error) throw error;
      
      // Check the response from the function
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || "Failed to join guild");
      }
      
      return result;
    },
    onSuccess: () => {
      toast.success("Welcome to the guild! 🎉");
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["community-members"] });
    },
    onError: (error) => {
      console.error("Join community error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to join guild");
    },
  });

  // Leave a community
  const leaveCommunity = useMutation({
    mutationFn: async (targetCommunityId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Check if user is the owner
      const member = members?.find(m => m.user_id === user.id && m.community_id === targetCommunityId);
      if (member?.role === 'owner') {
        throw new Error("Owners cannot leave their guild. Transfer ownership or delete the guild instead.");
      }

      const { error } = await supabase
        .from("community_members")
        .delete()
        .eq("community_id", targetCommunityId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Left the guild");
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["community-members"] });
    },
    onError: (error) => {
      console.error("Leave community error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to leave guild");
    },
  });

  // Update member role (admin only)
  const updateMemberRole = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: 'admin' | 'member' }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("community_members")
        .update({ role: newRole })
        .eq("id", memberId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Member role updated");
      queryClient.invalidateQueries({ queryKey: ["community-members", communityId] });
    },
    onError: (error) => {
      console.error("Update member role error:", error);
      toast.error("Failed to update member role");
    },
  });

  // Remove a member (admin only)
  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("community_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["community-members", communityId] });
    },
    onError: (error) => {
      console.error("Remove member error:", error);
      toast.error("Failed to remove member");
    },
  });

  // Update member contribution (for leaderboard)
  const addContribution = useMutation({
    mutationFn: async ({ memberId, amount }: { memberId: string; amount: number }) => {
      if (!user) throw new Error("Not authenticated");

      // Get current contribution
      const member = members?.find(m => m.id === memberId);
      const currentContribution = member?.total_contribution || 0;

      const { data, error } = await supabase
        .from("community_members")
        .update({
          total_contribution: currentContribution + amount,
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", memberId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-members", communityId] });
    },
    onError: (error) => {
      console.error("Add contribution error:", error);
    },
  });

  // Leaderboard - sorted by contribution
  const leaderboard = members?.slice().sort((a, b) => b.total_contribution - a.total_contribution) || [];

  return {
    // Data
    members,
    leaderboard,
    currentUserMember,
    isOwner: currentUserMember?.role === 'owner',
    isAdmin: currentUserMember?.role === 'owner' || currentUserMember?.role === 'admin',
    isMember: !!currentUserMember,
    
    // Loading state
    isLoading,
    
    // Mutations
    joinCommunity,
    leaveCommunity,
    updateMemberRole,
    removeMember,
    addContribution,
    
    // Mutation states
    isJoining: joinCommunity.isPending,
    isLeaving: leaveCommunity.isPending,
  };
};
