import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EpicTemplate {
  id: string;
  name: string;
  description: string;
  theme_color: string;
  target_days: number;
  difficulty_tier: 'beginner' | 'intermediate' | 'advanced';
  habits: {
    title: string;
    frequency: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }[];
  badge_icon: string | null;
  badge_name: string | null;
  popularity_count: number;
  is_featured: boolean;
  created_at: string;
}

export const useEpicTemplates = () => {
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery<EpicTemplate[]>({
    queryKey: ["epic-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("epic_templates")
        .select("*")
        .order("is_featured", { ascending: false })
        .order("popularity_count", { ascending: false });

      if (error) throw error;
      
      return (data || []).map(t => ({
        ...t,
        habits: Array.isArray(t.habits) ? t.habits : JSON.parse(t.habits as string || '[]'),
      })) as EpicTemplate[];
    },
  });

  const incrementPopularity = useMutation({
    mutationFn: async (templateId: string) => {
      const { data: template } = await supabase
        .from("epic_templates")
        .select("popularity_count")
        .eq("id", templateId)
        .single();
      
      if (template) {
        await supabase
          .from("epic_templates")
          .update({ popularity_count: (template.popularity_count || 0) + 1 })
          .eq("id", templateId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epic-templates"] });
    },
  });

  const featuredTemplates = templates?.filter(t => t.is_featured) || [];
  const allTemplates = templates || [];

  return {
    templates: allTemplates,
    featuredTemplates,
    isLoading,
    incrementPopularity,
  };
};
