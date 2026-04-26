import { normalizeCompanionName } from "../../../src/lib/companionNameIdentity.ts";

type SupabaseNameCacheClient = {
  from: (table: string) => any;
};

export async function cacheGeneratedCompanionNameIfUncustomized(params: {
  supabase: SupabaseNameCacheClient;
  companionId: string;
  creatureName: string | null | undefined;
}): Promise<boolean> {
  const normalizedName = normalizeCompanionName(params.creatureName);
  if (!normalizedName) return false;

  const { error } = await params.supabase
    .from("user_companion")
    .update({ cached_creature_name: normalizedName })
    .eq("id", params.companionId)
    .is("companion_name", null);

  if (error) {
    throw error;
  }

  return true;
}
