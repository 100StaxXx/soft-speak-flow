import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocuments, getDocument, updateDocument, timestampToISO } from "@/lib/firebase/firestore";

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
      // Firestore doesn't support multiple orderBy easily, so we'll fetch and sort client-side
      const data = await getDocuments<EpicTemplate>(
        "epic_templates",
        undefined,
        "popularity_count",
        "desc"
      );

      // Sort: featured first, then by popularity
      const sorted = data.sort((a, b) => {
        if (a.is_featured && !b.is_featured) return -1;
        if (!a.is_featured && b.is_featured) return 1;
        return (b.popularity_count || 0) - (a.popularity_count || 0);
      });

      return sorted.map(t => ({
        ...t,
        habits: Array.isArray(t.habits) ? t.habits : (typeof t.habits === 'string' ? JSON.parse(t.habits || '[]') : []),
        created_at: timestampToISO(t.created_at as any) || t.created_at || new Date().toISOString(),
      }));
    },
  });

  const incrementPopularity = useMutation({
    mutationFn: async (templateId: string) => {
      // Read-then-write for popularity increment
      // Note: This could still have race conditions in high-concurrency scenarios
      // For a popularity counter, occasional missed increments are acceptable
      const template = await getDocument<{ popularity_count: number }>("epic_templates", templateId);
        
      if (template) {
        await updateDocument("epic_templates", templateId, {
          popularity_count: (template.popularity_count || 0) + 1,
        });
      } else {
        console.error('Template not found for popularity increment:', templateId);
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
