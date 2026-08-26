import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clearLegacyAccountLocalState, clearUserAccountLocalState } from "@/utils/accountLocalState";
import { safeSessionStorage } from "@/utils/storage";
import { productScopedStorageKey } from "@/config/productRuntime";

export const INITIAL_ROUTE_REDIRECTED_STORAGE_KEY = productScopedStorageKey("initialRouteRedirected");

interface ClearAuthScopedClientStateOptions {
  previousUserId?: string | null;
  clearLegacyLocalState?: boolean;
}

export const clearAuthScopedClientState = async (
  queryClient: QueryClient,
  options: ClearAuthScopedClientStateOptions = {},
): Promise<void> => {
  queryClient.clear();
  safeSessionStorage.removeItem(INITIAL_ROUTE_REDIRECTED_STORAGE_KEY);

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
