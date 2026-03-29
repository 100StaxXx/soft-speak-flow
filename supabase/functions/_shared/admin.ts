import { requireRequestAuth } from "./auth.ts";

type SupabaseClient = any;

export async function requireAdminRequest(
  req: Request,
  supabase: SupabaseClient,
  corsHeaders: HeadersInit,
): Promise<{ userId: string; isServiceRole: boolean } | Response> {
  const requestAuth = await requireRequestAuth(req, corsHeaders);
  if (requestAuth instanceof Response) {
    return requestAuth;
  }

  if (requestAuth.isServiceRole) {
    return requestAuth;
  }

  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: requestAuth.userId,
    _role: "admin",
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: "Error checking admin access" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (!isAdmin) {
    return new Response(
      JSON.stringify({ error: "Admin access required" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return requestAuth;
}
