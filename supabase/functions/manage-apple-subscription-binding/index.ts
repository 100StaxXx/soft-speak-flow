import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdminRequest } from "../_shared/admin.ts";
import {
  fetchAccountEntitlementForUser,
  upsertAccountEntitlement,
} from "../_shared/accountEntitlements.ts";

type SupabaseClient = any;

type ManageAppleSubscriptionBindingDeps = {
  createSupabaseClient?: typeof createClient;
  requireAdminRequestImpl?: typeof requireAdminRequest;
  now?: () => Date;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const defaultDeps: Required<ManageAppleSubscriptionBindingDeps> = {
  createSupabaseClient: createClient,
  requireAdminRequestImpl: requireAdminRequest,
  now: () => new Date(),
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

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function subscriptionIsActive(subscription: Record<string, unknown>, now: Date): boolean {
  const periodEnd = typeof subscription.current_period_end === "string"
    ? new Date(subscription.current_period_end)
    : null;
  if (!periodEnd || Number.isNaN(periodEnd.getTime()) || periodEnd <= now) {
    return false;
  }

  return (
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    subscription.status === "past_due" ||
    subscription.status === "cancelled"
  );
}

async function fetchAppleBinding(supabase: SupabaseClient, originalTransactionId: string) {
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

async function fetchSubscriptionForUser(supabase: SupabaseClient, userId: string) {
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
          email: data.user.email ?? null,
          created_at: data.user.created_at ?? null,
        }
      : null;
  }

  return null;
}

async function revokePreviousSubscriptionAccess(params: {
  supabase: SupabaseClient;
  previousUserId: string;
  originalTransactionId: string;
  targetUserId: string;
  adminUserId: string;
  reason: string;
  nowIso: string;
}) {
  const {
    supabase,
    previousUserId,
    originalTransactionId,
    targetUserId,
    adminUserId,
    reason,
    nowIso,
  } = params;
  const previousEntitlement = await fetchAccountEntitlementForUser(supabase, previousUserId);
  if (!previousEntitlement || previousEntitlement.source !== "subscription") {
    return false;
  }

  const matchesOriginalTransaction =
    previousEntitlement.billing_subscription_id === originalTransactionId ||
    previousEntitlement.billing_customer_id === originalTransactionId;
  if (!matchesOriginalTransaction) return false;

  await upsertAccountEntitlement(supabase, {
    user_id: previousUserId,
    source: "subscription",
    status: "transferred",
    is_active: false,
    ends_at: nowIso,
    metadata: {
      apple_binding_transfer_status: "transferred_away",
      transferred_to_user_id: targetUserId,
      transfer_admin_user_id: adminUserId,
      transfer_reason: reason,
      transferred_at: nowIso,
      original_transaction_id: originalTransactionId,
    },
  });

  return true;
}

async function upsertTargetEntitlementFromSubscription(params: {
  supabase: SupabaseClient;
  subscription: Record<string, unknown>;
  targetUserId: string;
  previousUserId: string;
  originalTransactionId: string;
  adminUserId: string;
  reason: string;
  now: Date;
  nowIso: string;
}) {
  const {
    supabase,
    subscription,
    targetUserId,
    previousUserId,
    originalTransactionId,
    adminUserId,
    reason,
    now,
    nowIso,
  } = params;
  const plan = subscription.plan === "monthly" || subscription.plan === "yearly"
    ? subscription.plan
    : null;

  await upsertAccountEntitlement(supabase, {
    user_id: targetUserId,
    source: "subscription",
    status: typeof subscription.status === "string" ? subscription.status : "active",
    plan,
    is_active: subscriptionIsActive(subscription, now),
    started_at: typeof subscription.current_period_start === "string"
      ? subscription.current_period_start
      : null,
    ends_at: typeof subscription.current_period_end === "string"
      ? subscription.current_period_end
      : null,
    billing_customer_id: originalTransactionId,
    billing_subscription_id: originalTransactionId,
    metadata: {
      apple_binding_transfer_status: "transferred_in",
      transferred_from_user_id: previousUserId,
      transfer_admin_user_id: adminUserId,
      transfer_reason: reason,
      transferred_at: nowIso,
      original_transaction_id: originalTransactionId,
    },
  });
}

async function migrateSubscriptionOwner(params: {
  supabase: SupabaseClient;
  originalTransactionId: string;
  targetUserId: string;
  nowIso: string;
}) {
  const { supabase, originalTransactionId, targetUserId, nowIso } = params;
  const subscription = await fetchSubscriptionForOriginalTransaction(supabase, originalTransactionId);
  if (!subscription) {
    return { subscription: null, migrated: false };
  }

  if (normalizeUserId(subscription.user_id) === targetUserId) {
    return { subscription, migrated: false };
  }

  const targetSubscription = await fetchSubscriptionForUser(supabase, targetUserId);
  if (targetSubscription && targetSubscription.id !== subscription.id) {
    throw new Error("Target user already has a subscription row. Resolve the existing subscription before transfer.");
  }

  const { data: updatedSubscription, error } = await supabase
    .from("subscriptions")
    .update({
      user_id: targetUserId,
      updated_at: nowIso,
    })
    .eq("id", subscription.id)
    .select("*")
    .single();

  if (error) throw error;
  return { subscription: updatedSubscription, migrated: true };
}

async function buildLookupResponse(
  supabase: SupabaseClient,
  originalTransactionId: string,
  targetUserId?: string,
) {
  const [binding, subscription, targetUser] = await Promise.all([
    fetchAppleBinding(supabase, originalTransactionId),
    fetchSubscriptionForOriginalTransaction(supabase, originalTransactionId),
    targetUserId ? fetchUserSummary(supabase, targetUserId) : Promise.resolve(null),
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
    now: nowFn,
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
    const adminRequest = await requireAdminRequestImpl(req, supabase, corsHeaders);
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
      return jsonResponse(200, await buildLookupResponse(
        supabase,
        originalTransactionId,
        normalizeUserId(body?.targetUserId) || undefined,
      ));
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
      return jsonResponse(400, { error: "A support reason of at least 8 characters is required" });
    }

    const binding = await fetchAppleBinding(supabase, originalTransactionId);
    if (!binding) {
      return jsonResponse(404, { error: "Apple transaction binding not found" });
    }

    const targetUser = await fetchUserSummary(supabase, targetUserId);
    if (!targetUser) {
      return jsonResponse(404, { error: "Target user not found" });
    }

    const previousUserId = normalizeUserId(binding.bound_user_id);
    const previousAppAccountToken = normalizeUserId(binding.app_account_token) || null;
    const now = nowFn();
    const nowIso = now.toISOString();

    const migration = await migrateSubscriptionOwner({
      supabase,
      originalTransactionId,
      targetUserId,
      nowIso,
    });

    let previousAccessRevoked = false;
    if (previousUserId && previousUserId !== targetUserId) {
      previousAccessRevoked = await revokePreviousSubscriptionAccess({
        supabase,
        previousUserId,
        originalTransactionId,
        targetUserId,
        adminUserId: adminRequest.userId,
        reason,
        nowIso,
      });
    }

    if (migration.subscription) {
      await upsertTargetEntitlementFromSubscription({
        supabase,
        subscription: migration.subscription,
        targetUserId,
        previousUserId,
        originalTransactionId,
        adminUserId: adminRequest.userId,
        reason,
        now,
        nowIso,
      });
    }

    const transferMetadata = {
      previous_bound_user_id: previousUserId || null,
      target_user_id: targetUserId,
      previous_app_account_token: previousAppAccountToken,
      transfer_admin_user_id: adminRequest.userId,
      transfer_reason: reason,
      transferred_at: nowIso,
    };
    const { data: updatedBinding, error: bindingUpdateError } = await supabase
      .from("apple_transaction_bindings")
      .update({
        bound_user_id: targetUserId,
        app_account_token: previousAppAccountToken,
        metadata: {
          ...normalizeMetadata(binding.metadata),
          apple_binding_admin_transfer: transferMetadata,
        },
        last_verified_at: nowIso,
      })
      .eq("original_transaction_id", originalTransactionId)
      .select("*")
      .single();

    if (bindingUpdateError) throw bindingUpdateError;

    return jsonResponse(200, {
      success: true,
      binding: updatedBinding,
      subscription: migration.subscription,
      subscriptionMigrated: migration.migrated,
      previousAccessRevoked,
      targetUser,
    });
  } catch (error) {
    console.error("manage-apple-subscription-binding error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const isConflict = message.includes("Target user already has a subscription row");
    return jsonResponse(isConflict ? 409 : 500, { error: message });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleManageAppleSubscriptionBinding(req));
}
