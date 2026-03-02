import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clearLegacyAccountLocalState, clearUserAccountLocalState } from "@/utils/accountLocalState";
import { safeSessionStorage } from "@/utils/storage";

interface ClearAuthScopedClientStateOptions {
  previousUserId?: string | null;
  clearLegacyLocalState?: boolean;
}

export const clearAuthScopedClientState = async (
  queryClient: QueryClient,
  options: ClearAuthScopedClientStateOptions = {},
): Promise<void> => {
  queryClient.clear();
  safeSessionStorage.removeItem("initialRouteRedirected");

  if (options.previousUserId) {
    clearUserAccountLocalState(options.previousUserId);
  }

  if (options.clearLegacyLocalState !== false) {
    clearLegacyAccountLocalState();
  }

  try {
    await supabase.removeAllChannels();
  } catch (error) {
    console.error("Failed to remove realtime channels:", error);
  }
};
