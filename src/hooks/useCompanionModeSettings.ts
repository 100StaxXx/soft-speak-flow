import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_COMPANION_MODE,
  isCompanionModeId,
  type CompanionModeId,
} from "@/shared/companionModes";

type CompanionModeSettings = {
  mode: CompanionModeId;
  adaptationEnabled: boolean;
};

const QUERY_KEY = ["companion-mode-settings"];

const isMissingPreferenceColumnError = (error: unknown) => {
  const source = typeof error === "object" && error
    ? JSON.stringify(error).toLowerCase()
    : String(error).toLowerCase();

  return source.includes("companion_mode")
    || source.includes("companion_mode_adaptation_enabled");
};

const normalizeSettings = (
  row: {
    mode?: string | null;
    adaptationEnabled?: boolean | null;
    companion_mode?: string | null;
    companion_mode_adaptation_enabled?: boolean | null;
  } | null | undefined,
): CompanionModeSettings => ({
  mode: isCompanionModeId(row?.mode)
    ? row.mode
    : isCompanionModeId(row?.companion_mode)
      ? row.companion_mode
      : DEFAULT_COMPANION_MODE,
  adaptationEnabled: row?.adaptationEnabled ?? row?.companion_mode_adaptation_enabled ?? true,
});

export const getCompanionModeSettingsQueryKey = (userId: string | null | undefined) => [
  ...QUERY_KEY,
  userId ?? "anon",
];

export function useCompanionModeSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const query = useQuery({
    queryKey: getCompanionModeSettingsQueryKey(user?.id),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CompanionModeSettings> => {
      if (!user?.id) {
        return normalizeSettings(null);
      }

      const { data, error } = await supabase
        .from("user_ai_preferences")
        .select("companion_mode, companion_mode_adaptation_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        if (isMissingPreferenceColumnError(error)) {
          return normalizeSettings(null);
        }
        throw error;
      }

      return normalizeSettings(data);
    },
  });

  const persist = useCallback(async (patch: Partial<CompanionModeSettings>) => {
    if (!user?.id) return;

    const current = normalizeSettings(
      queryClient.getQueryData<CompanionModeSettings>(getCompanionModeSettingsQueryKey(user.id))
        ?? query.data,
    );
    const next = {
      mode: patch.mode ?? current.mode,
      adaptationEnabled: patch.adaptationEnabled ?? current.adaptationEnabled,
    } satisfies CompanionModeSettings;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("user_ai_preferences")
        .upsert({
          user_id: user.id,
          companion_mode: next.mode,
          companion_mode_adaptation_enabled: next.adaptationEnabled,
        }, {
          onConflict: "user_id",
        });

      if (error) {
        if (isMissingPreferenceColumnError(error)) {
          return;
        }
        throw error;
      }

      queryClient.setQueryData(
        getCompanionModeSettingsQueryKey(user.id),
        next,
      );
    } finally {
      setIsSaving(false);
    }
  }, [query.data, queryClient, user?.id]);

  const settings = useMemo(
    () => normalizeSettings(query.data),
    [query.data],
  );

  return {
    mode: settings.mode,
    adaptationEnabled: settings.adaptationEnabled,
    isLoading: query.isLoading,
    isSaving,
    setMode: (mode: CompanionModeId) => persist({ mode }),
    setAdaptationEnabled: (adaptationEnabled: boolean) => persist({ adaptationEnabled }),
  };
}
