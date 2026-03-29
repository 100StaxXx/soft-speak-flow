import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AccessSource = "subscription" | "promo_code" | "trial" | "manual" | "none";

export interface AccessState {
  has_access: boolean;
  access_source: AccessSource;
  trial_ends_at: string | null;
  subscribed: boolean;
  status?: string;
  plan?: string;
  subscription_end?: string;
}

const DEFAULT_ACCESS_STATE: AccessState = {
  has_access: false,
  access_source: "none",
  trial_ends_at: null,
  subscribed: false,
};

export function useAccessState() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["access-state", user?.id],
    queryFn: async (): Promise<AccessState> => {
      if (!user) return DEFAULT_ACCESS_STATE;

      const { data, error } = await supabase.functions.invoke("check-apple-subscription");
      if (error) throw error;

      const response = (data ?? {}) as Partial<AccessState>;
      return {
        ...DEFAULT_ACCESS_STATE,
        ...response,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
  });

  const accessState = useMemo(
    () => query.data ?? DEFAULT_ACCESS_STATE,
    [query.data],
  );

  return {
    accessState,
    isLoading: authLoading || (!!user && query.isLoading),
    error: query.error,
    refetch: query.refetch,
  };
}
