import { supabase } from "@/integrations/supabase/client";

export async function hasActiveSupabaseFunctionSession(
  refreshSession?: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await refreshSession?.();
  } catch (error) {
    console.warn("Supabase session refresh failed before function call:", error);
  }

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.warn("Supabase session check failed before function call:", error);
      return true;
    }

    return Boolean(session?.access_token);
  } catch (error) {
    console.warn("Supabase session check threw before function call:", error);
    return true;
  }
}
