import { getEffectiveDailyDateAnchor } from "../_shared/effectiveDailyDate.ts";

interface ProfileTimezoneRow {
  timezone: string | null;
}

interface ProfileTimezoneError {
  message?: string;
}

export interface ProfileTimezoneSupabaseClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: ProfileTimezoneRow | null; error: ProfileTimezoneError | null }>;
      };
    };
  };
}

export interface SingleDailyPepTalkDateContext {
  effectiveDate: string;
  themeAnchorDate: Date;
  timezone: string;
}

export async function resolveSingleDailyPepTalkDateContext({
  supabase,
  userId,
  now = new Date(),
}: {
  supabase: ProfileTimezoneSupabaseClient;
  userId: string;
  now?: Date;
}): Promise<SingleDailyPepTalkDateContext> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch profile timezone: ${error.message ?? "unknown error"}`);
  }

  const { effectiveDate, anchorDate, timezone } = getEffectiveDailyDateAnchor(
    profile?.timezone ?? null,
    2,
    now,
  );

  return {
    effectiveDate,
    themeAnchorDate: anchorDate,
    timezone,
  };
}
