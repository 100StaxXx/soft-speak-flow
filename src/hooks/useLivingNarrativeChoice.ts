import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type {
  CompanionNarrativeChoice,
  LivingNarrativeOption,
  LivingNarrativePrompt,
  LivingNarrativeSourceType,
} from "@/types/livingNarrative";

interface LivingNarrativeSource {
  sourceType: LivingNarrativeSourceType;
  sourceId: string;
  companionId: string;
  epicId?: string | null;
  stage?: number | null;
  chapterNumber?: number | null;
}

export const getLivingNarrativeChoiceQueryKey = (
  userId: string | undefined,
  sourceType: LivingNarrativeSourceType,
  sourceId: string,
  promptKey: string,
) => ["companion-narrative-choice", userId, sourceType, sourceId, promptKey] as const;

export function useLivingNarrativeChoice(
  source: LivingNarrativeSource,
  prompt: LivingNarrativePrompt,
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = getLivingNarrativeChoiceQueryKey(
    user?.id,
    source.sourceType,
    source.sourceId,
    prompt.promptKey,
  );

  const choiceQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("companion_narrative_choices")
        .select("*")
        .eq("user_id", user.id)
        .eq("source_type", source.sourceType)
        .eq("source_id", source.sourceId)
        .eq("prompt_key", prompt.promptKey)
        .maybeSingle();

      if (error) throw error;
      return data as CompanionNarrativeChoice | null;
    },
    enabled: Boolean(user?.id && source.sourceId && source.companionId),
    staleTime: 5 * 60 * 1000,
  });

  const recordChoice = useMutation({
    mutationFn: async ({
      option,
      responseNote,
    }: {
      option: LivingNarrativeOption;
      responseNote?: string;
    }) => {
      if (!user?.id) throw new Error("Sign in to save this story choice.");

      const { data, error } = await supabase.rpc("record_companion_narrative_choice", {
        p_companion_id: source.companionId,
        p_source_type: source.sourceType,
        p_source_id: source.sourceId,
        p_prompt_key: prompt.promptKey,
        p_prompt_text: prompt.question,
        p_option_key: option.key,
        p_option_label: option.label,
        p_memory_type: option.memoryType,
        p_memory_key: `${source.sourceType}:${source.sourceId}:${prompt.promptKey}`,
        p_memory_summary: option.memorySummary,
        p_consequence_tags: option.consequenceTags,
        p_epic_id: source.epicId ?? null,
        p_stage: source.stage ?? null,
        p_chapter_number: source.chapterNumber ?? null,
        p_companion_reply: option.companionReply,
        p_side_quest_title: option.sideQuestTitle ?? null,
        p_response_note: responseNote?.trim() || null,
      });

      if (error) throw error;
      return data as CompanionNarrativeChoice;
    },
    onSuccess: (choice) => {
      queryClient.setQueryData(queryKey, choice);
      void queryClient.invalidateQueries({
        queryKey: ["companion-narrative-memories", user?.id, source.companionId],
      });
    },
  });

  const updateSideQuest = useMutation({
    mutationFn: async ({
      status,
      taskId,
    }: {
      status: "accepted" | "dismissed";
      taskId?: string | null;
    }) => {
      const choiceId = choiceQuery.data?.id;
      if (!user?.id || !choiceId) throw new Error("Save a story choice first.");

      const { data, error } = await supabase
        .from("companion_narrative_choices")
        .update({
          side_quest_status: status,
          side_quest_task_id: status === "accepted" ? taskId ?? null : null,
        })
        .eq("id", choiceId)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (error) throw error;
      return data as CompanionNarrativeChoice;
    },
    onSuccess: (choice) => queryClient.setQueryData(queryKey, choice),
  });

  const acceptSideQuest = useMutation({
    mutationFn: async () => {
      const choiceId = choiceQuery.data?.id;
      if (!user?.id || !choiceId) throw new Error("Save a story choice first.");

      const { data, error } = await supabase.rpc("accept_companion_narrative_side_quest", {
        p_choice_id: choiceId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ["daily-tasks"] }),
      ]);
    },
  });

  return {
    choice: choiceQuery.data ?? null,
    isLoading: choiceQuery.isLoading,
    error: choiceQuery.error,
    recordChoice,
    updateSideQuest,
    acceptSideQuest,
  };
}
