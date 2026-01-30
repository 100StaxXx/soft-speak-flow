import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface Community {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  is_public: boolean;
  owner_id: string;
  theme_color: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  member_count?: number;
  // New customization fields
  banner_style?: string;
  emblem_icon?: string;
  frame_style?: string;
  glow_effect?: string;
  particle_effect?: string;
}

export interface CommunityWithMembership extends Community {
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

interface CreateCommunityParams {
  name: string;
  description?: string;
  is_public?: boolean;
  theme_color?: string;
  banner_style?: string;
  emblem_icon?: string;
  frame_style?: string;
  glow_effect?: string;
  particle_effect?: string;
}

interface UpdateCommunityParams {
  id: string;
  name?: string;
  description?: string;
  is_public?: boolean;
  theme_color?: string;
  avatar_url?: string;
  banner_style?: string;
  emblem_icon?: string;
  frame_style?: string;
  glow_effect?: string;
  particle_effect?: string;
}

export const useCommunity = (communityId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's communities (ones they own or are members of)
  const { data: myCommunities, isLoading: isLoadingMyCommunities } = useQuery<CommunityWithMembership[]>({
    queryKey: ["communities", "my", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("community_members")
        .select(`
          role,
          joined_at,
          community:communities(*)
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      return (data || [])
        .filter(item => item.community)
        .map(item => ({
          ...(item.community as unknown as Community),
          role: item.role as 'owner' | 'admin' | 'member',
          joined_at: item.joined_at,
        }));
    },
    enabled: !!user,
  });

  // Fetch a single community by ID
  const { data: community, isLoading: isLoadingCommunity } = useQuery<Community | null>({
    queryKey: ["community", communityId],
    queryFn: async () => {
      if (!communityId) return null;

      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .eq("id", communityId)
        .maybeSingle();

      if (error) throw error;
      return data as Community | null;
    },
    enabled: !!communityId,
  });

  // Fetch public communities (for discovery)
  const { data: publicCommunities, isLoading: isLoadingPublic } = useQuery<Community[]>({
    queryKey: ["communities", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Community[];
    },
    enabled: !!user,
  });

  // Create a new community
  const createCommunity = useMutation({
    mutationFn: async (params: CreateCommunityParams) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("communities")
        .insert({
          name: params.name,
          description: params.description || null,
          is_public: params.is_public ?? false,
          theme_color: params.theme_color || '#8B5CF6',
          owner_id: user.id,
          banner_style: params.banner_style || 'cosmic',
          emblem_icon: params.emblem_icon || 'shield',
          frame_style: params.frame_style || 'ornate',
          glow_effect: params.glow_effect || 'pulse',
          particle_effect: params.particle_effect || 'stars',
        })
        .select()
        .single();

      if (error) throw error;
      return data as Community;
    },
    onSuccess: (data) => {
      toast.success(`${data.name} created!`);
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (error) => {
      console.error("Create community error:", error);
      toast.error("Failed to create community");
    },
  });

  // Update a community
  const updateCommunity = useMutation({
    mutationFn: async (params: UpdateCommunityParams) => {
      if (!user) throw new Error("Not authenticated");

      const { id, ...updates } = params;
      const { data, error } = await supabase
        .from("communities")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Community;
    },
    onSuccess: () => {
      toast.success("Guild updated");
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["community", communityId] });
    },
    onError: (error) => {
      console.error("Update community error:", error);
      toast.error("Failed to update guild");
    },
  });

  // Delete a community
  const deleteCommunity = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("communities")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Guild deleted");
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (error) => {
      console.error("Delete community error:", error);
      toast.error("Failed to delete guild");
    },
  });

  // Find community by invite code (uses security definer function to bypass RLS)
  const findByInviteCode = async (code: string): Promise<Community | null> => {
    const { data, error } = await supabase
      .rpc('find_community_by_invite_code', { p_invite_code: code.toUpperCase() });

    if (error || !data || data.length === 0) {
      console.error("Find by invite code error:", error);
      return null;
    }
    
    return data[0] as Community;
  };

  return {
    // Data
    myCommunities,
    community,
    publicCommunities,
    
    // Loading states
    isLoadingMyCommunities,
    isLoadingCommunity,
    isLoadingPublic,
    
    // Mutations
    createCommunity,
    updateCommunity,
    deleteCommunity,
    
    // Mutation states
    isCreating: createCommunity.isPending,
    isUpdating: updateCommunity.isPending,
    isDeleting: deleteCommunity.isPending,
    
    // Utils
    findByInviteCode,
  };
};
