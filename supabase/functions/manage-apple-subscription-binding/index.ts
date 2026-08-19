import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdminRequest } from "../_shared/admin.ts";

type SupabaseClient = any;

type ManageAppleSubscriptionBindingDeps = {
  createSupabaseClient?: typeof createClient;
  requireAdminRequestImpl?: typeof requireAdminRequest;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const defaultDeps: Required<ManageAppleSubscriptionBindingDeps> = {
  createSupabaseClient: createClient,
  requireAdminRequestImpl: requireAdminRequest,
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUserId(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

async function fetchAppleBinding(
  supabase: SupabaseClient,
  originalTransactionId: string,
) {
  const { data, error } = await supabase
    .from("apple_transaction_bindings")
    .select("*")
    .eq("original_transaction_id", originalTransactionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchSubscriptionForOriginalTransaction(
  supabase: SupabaseClient,
  originalTransactionId: string,
) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("stripe_subscription_id", originalTransactionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchSubscriptionForUser(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchUserSummary(supabase: SupabaseClient, userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile) return profile;

  if (supabase.auth?.admin?.getUserById) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) return null;
    return data?.user
      ? {
        id: data.user.id,
        email: typeof data.user.app_metadata?.account_email === "string"
          ? data.user.app_metadata.account_email
          : typeof data.user.user_metadata?.account_email === "string"
          ? data.user.user_metadata.account_email
          : data.user.email ?? null,
        created_at: data.user.created_at ?? null,
      }
      : null;
  }

  return null;
}

async function buildLookupResponse(
  supabase: SupabaseClient,
  originalTransactionId: string,
  targetUserId?: string,
) {
  const [binding, subscription, targetUser] = await Promise.all([
    fetchAppleBinding(supabase, originalTransactionId),
    fetchSubscriptionForOriginalTransaction(supabase, originalTransactionId),
    targetUserId
      ? fetchUserSummary(supabase, targetUserId)
      : Promise.resolve(null),
  ]);

  const currentOwner = binding?.bound_user_id
    ? await fetchUserSummary(supabase, binding.bound_user_id)
    : null;

  return {
    binding,
    subscription,
    currentOwner,
    targetUser,
  };
}

export async function handleManageAppleSubscriptionBinding(
  req: Request,
  deps: ManageAppleSubscriptionBindingDeps = defaultDeps,
): Promise<Response> {
  const {
    createSupabaseClient,
    requireAdminRequestImpl,
  } = { ...defaultDeps, ...deps };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const supabase = createSupabaseClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const adminRequest = await requireAdminRequestImpl(
      req,
      supabase,
      corsHeaders,
    );
    if (adminRequest instanceof Response) {
      return adminRequest;
    }

    const body = await req.json().catch(() => ({}));
    const action = normalizeText(body?.action) || "lookup";
    const originalTransactionId = normalizeText(body?.originalTransactionId);

    if (!originalTransactionId) {
      return jsonResponse(400, { error: "originalTransactionId is required" });
    }

    if (action === "lookup") {
      return jsonResponse(
        200,
        await buildLookupResponse(
          supabase,
          originalTransactionId,
          normalizeUserId(body?.targetUserId) || undefined,
        ),
      );
    }

    if (action !== "reassign") {
      return jsonResponse(400, { error: "Unsupported action" });
    }

    const targetUserId = normalizeUserId(body?.targetUserId);
    const reason = normalizeText(body?.reason);
    if (!targetUserId) {
      return jsonResponse(400, { error: "targetUserId is required" });
    }
    if (reason.length < 8) {
      return jsonResponse(400, {
        error: "A support reason of at least 8 characters is required",
      });
    }

    const { data, error } = await supabase.rpc(
      "admin_reassign_apple_subscription_binding",
      {
        p_original_transaction_id: originalTransactionId,
        p_target_user_id: targetUserId,
        p_admin_user_id: adminRequest.isServiceRole
          ? null
          : adminRequest.userId,
        p_reason: reason,
      },
    );

    if (error) throw error;

    return jsonResponse(
      200,
      (data ?? { success: true }) as Record<string, unknown>,
    );
  } catch (error) {
    console.error("manage-apple-subscription-binding error:", error);
    const message = error instanceof Error
      ? error.message
      : "Internal server error";
    const isConflict = message.includes(
      "Target user already has a subscription row",
    );
    const isNotFound = message.includes("not found");
    return jsonResponse(isConflict ? 409 : isNotFound ? 404 : 500, {
      error: message,
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleManageAppleSubscriptionBinding(req));
}
