export interface InternalFunctionConfig {
  supabaseUrl: string;
  functionApiKey: string;
  internalKey: string;
}

export function getInternalFunctionConfig(): InternalFunctionConfig {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const functionApiKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  const internalKey = Deno.env.get("INTERNAL_FUNCTION_SECRET");

  if (!supabaseUrl || !functionApiKey || !internalKey) {
    throw new Error(
      "Internal function auth requires SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY, and INTERNAL_FUNCTION_SECRET",
    );
  }

  return { supabaseUrl, functionApiKey, internalKey };
}

export function buildInternalFunctionHeaders(): HeadersInit {
  const { functionApiKey, internalKey } = getInternalFunctionConfig();
  return {
    "Content-Type": "application/json",
    apikey: functionApiKey,
    "x-internal-key": internalKey,
  };
}

export function getInternalFunctionUrl(functionName: string): string {
  const { supabaseUrl } = getInternalFunctionConfig();
  return `${supabaseUrl}/functions/v1/${functionName}`;
}

export function invokeInternalFunction(functionName: string, payload: Record<string, unknown>): Promise<Response> {
  return fetch(getInternalFunctionUrl(functionName), {
    method: "POST",
    headers: buildInternalFunctionHeaders(),
    body: JSON.stringify(payload),
  });
}
