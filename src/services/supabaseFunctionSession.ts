import { supabase } from "@/integrations/supabase/client";

const FUNCTION_SESSION_EXPIRY_BUFFER_MS = 30_000;

const hasUsableAccessToken = (
  session: { access_token?: string | null; expires_at?: number | null } | null,
) => {
  if (!session?.access_token) return false;
  if (!session.expires_at) return true;
  return session.expires_at * 1000 - Date.now() > FUNCTION_SESSION_EXPIRY_BUFFER_MS;
};

const readActiveFunctionSession = async (): Promise<boolean | "unknown"> => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.warn("Supabase session check failed before function call:", error);
      return "unknown";
    }

    return hasUsableAccessToken(session);
  } catch (error) {
    console.warn("Supabase session check threw before function call:", error);
    return "unknown";
  }
};

export async function hasActiveSupabaseFunctionSession(
  refreshSession?: () => Promise<unknown>,
): Promise<boolean> {
  const initialSessionAvailable = await readActiveFunctionSession();
  if (initialSessionAvailable === true || initialSessionAvailable === "unknown") {
    return true;
  }

  try {
    if (typeof supabase.auth.refreshSession === "function") {
      await supabase.auth.refreshSession();
    } else {
      await refreshSession?.();
    }
  } catch (error) {
    console.warn("Supabase session refresh failed before function call:", error);
  }

  const refreshedSessionAvailable = await readActiveFunctionSession();
  return refreshedSessionAvailable === true || refreshedSessionAvailable === "unknown";
}
