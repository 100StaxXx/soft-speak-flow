import {
  AppStoreConnectApiError,
  ensureAppleCustomOfferCode,
  getOfferCodeCampaignIdentifier,
} from "./appStoreConnect.ts";
import {
  normalizeWinWinKitCode,
  type WinWinKitCodeType,
  type WinWinKitUser,
} from "./winwinkit.ts";

type SupabaseClientLike = any;

function claimsCount(user: WinWinKitUser): number {
  return Number.isFinite(user.stats?.claims)
    ? Number(user.stats?.claims)
    : 0;
}

function metadataRecord(
  existing: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
) {
  return {
    ...(existing ?? {}),
    ...next,
  };
}

export async function syncWinWinKitUserToLocalState(
  supabase: SupabaseClientLike,
  userId: string,
  user: WinWinKitUser,
) {
  const normalizedReferralCode = normalizeWinWinKitCode(user.referral_code);
  const normalizedReferredByCode = normalizeWinWinKitCode(user.referred_by?.code);
  const profileUpdate: Record<string, unknown> = {
    referral_count: claimsCount(user),
  };

  if (normalizedReferralCode) {
    profileUpdate.referral_code = normalizedReferralCode;
  }
  if (normalizedReferredByCode) {
    profileUpdate.referred_by_code = normalizedReferredByCode;
  }

  const { data: currentProfile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("referral_code, referred_by_code")
    .eq("id", userId)
    .single();

  if (profileLookupError) {
    throw profileLookupError;
  }

  const previousReferredByCode = normalizeWinWinKitCode(currentProfile?.referred_by_code);

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", userId);

  if (profileUpdateError) {
    throw profileUpdateError;
  }

  if (!normalizedReferralCode) {
    return {
      previousReferredByCode,
      normalizedReferredByCode,
    };
  }

  const { data: ownedReferralCode, error: ownedReferralCodeLookupError } = await supabase
    .from("referral_codes")
    .select("id, code, total_signups, total_conversions, total_revenue")
    .eq("owner_type", "user")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (ownedReferralCodeLookupError) {
    throw ownedReferralCodeLookupError;
  }

  if (ownedReferralCode) {
    const { error: updateOwnedCodeError } = await supabase
      .from("referral_codes")
      .update({
        code: normalizedReferralCode,
        is_active: true,
        affiliate_provider: null,
      })
      .eq("id", ownedReferralCode.id);

    if (updateOwnedCodeError) {
      throw updateOwnedCodeError;
    }
  } else {
    const { error: insertOwnedCodeError } = await supabase
      .from("referral_codes")
      .insert({
        code: normalizedReferralCode,
        owner_type: "user",
        owner_user_id: userId,
        is_active: true,
        affiliate_provider: null,
        total_signups: claimsCount(user),
      });

    if (insertOwnedCodeError) {
      throw insertOwnedCodeError;
    }
  }

  return {
    previousReferredByCode,
    normalizedReferredByCode,
  };
}

export async function ensureAffiliateReferralCodeRecord(
  supabase: SupabaseClientLike,
  code: string,
): Promise<string> {
  const normalizedCode = normalizeWinWinKitCode(code);
  if (!normalizedCode) {
    throw new Error("Missing affiliate code");
  }

  const now = new Date().toISOString();
  const { data: existing, error: lookupError } = await supabase
    .from("referral_codes")
    .select("id, code, apple_offer_code_id, apple_offer_campaign_identifier, apple_offer_code_status, apple_offer_code_last_error")
    .eq("code", normalizedCode)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  let referralCodeId = existing?.id as string | undefined;
  let appleOfferCodeId = existing?.apple_offer_code_id as string | null | undefined;
  let appleOfferCampaignIdentifier = existing?.apple_offer_campaign_identifier as string | null | undefined;

  if (!referralCodeId) {
    const { data: inserted, error: insertError } = await supabase
      .from("referral_codes")
      .insert({
        code: normalizedCode,
        owner_type: "influencer",
        payout_method: "winwinkit",
        is_active: true,
        affiliate_provider: "winwinkit",
        provider_status: "active",
        provider_synced_at: now,
        apple_offer_code_status: "pending",
      })
      .select("id, code, apple_offer_code_id, apple_offer_campaign_identifier")
      .single();

    if (insertError) {
      throw insertError;
    }

    referralCodeId = inserted.id;
    appleOfferCodeId = inserted.apple_offer_code_id ?? null;
    appleOfferCampaignIdentifier = inserted.apple_offer_campaign_identifier ?? null;
  } else {
    const { error: updateError } = await supabase
      .from("referral_codes")
      .update({
        owner_type: "influencer",
        payout_method: "winwinkit",
        is_active: true,
        affiliate_provider: "winwinkit",
        provider_status: "active",
        provider_synced_at: now,
      })
      .eq("id", referralCodeId);

    if (updateError) {
      throw updateError;
    }
  }

  if (!referralCodeId) {
    throw new Error("Failed to persist affiliate referral code");
  }

  await syncAppleOfferCodeForReferralCode(supabase, {
    id: referralCodeId,
    code: normalizedCode,
    apple_offer_code_id: appleOfferCodeId ?? null,
    apple_offer_campaign_identifier: appleOfferCampaignIdentifier ?? null,
  });

  return referralCodeId;
}

export async function syncAppleOfferCodeForReferralCode(
  supabase: SupabaseClientLike,
  referralCode: {
    id: string;
    code: string;
    apple_offer_code_id?: string | null;
    apple_offer_campaign_identifier?: string | null;
  },
) {
  const normalizedCode = normalizeWinWinKitCode(referralCode.code);
  if (!normalizedCode) {
    throw new Error("Missing referral code");
  }

  const now = new Date().toISOString();

  try {
    const customCode = await ensureAppleCustomOfferCode({
      customCode: normalizedCode,
      existingCustomCodeId: referralCode.apple_offer_code_id ?? null,
      existingCampaignIdentifier: referralCode.apple_offer_campaign_identifier ?? null,
    });

    const { error: appleUpdateError } = await supabase
      .from("referral_codes")
      .update({
        apple_offer_code_id: customCode.id,
        apple_offer_code_status: customCode.active === false ? "inactive" : "active",
        apple_offer_code_synced_at: now,
        apple_offer_campaign_identifier: getOfferCodeCampaignIdentifier(),
        apple_offer_code_last_error: null,
        apple_offer_code_expires_at: customCode.expirationDate ?? null,
      })
      .eq("id", referralCode.id);

    if (appleUpdateError) {
      throw appleUpdateError;
    }

    return {
      code: normalizedCode,
      status: customCode.active === false ? "inactive" : "active",
      apple_offer_code_id: customCode.id,
      apple_offer_code_expires_at: customCode.expirationDate ?? null,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof AppStoreConnectApiError
      ? error.details || error.message
      : error instanceof Error
        ? error.message
        : "Unknown Apple offer-code sync failure";

    const { error: appleFailureUpdateError } = await supabase
      .from("referral_codes")
      .update({
        apple_offer_code_status: "failed",
        apple_offer_code_synced_at: now,
        apple_offer_campaign_identifier: Deno.env.get("APPLE_OFFER_CODE_IDENTIFIER")?.trim() ?? null,
        apple_offer_code_last_error: errorMessage,
      })
      .eq("id", referralCode.id);

    if (appleFailureUpdateError) {
      throw appleFailureUpdateError;
    }

    return {
      code: normalizedCode,
      status: "failed",
      apple_offer_code_id: referralCode.apple_offer_code_id ?? null,
      apple_offer_code_expires_at: null,
      error: errorMessage,
    };
  }
}

export async function finalizeClaimedReferralCode(params: {
  supabase: SupabaseClientLike;
  appUserId: string;
  user: WinWinKitUser;
  claimedCode: string;
  providerClaimed: boolean;
}) {
  const normalizedClaimedCode = normalizeWinWinKitCode(params.claimedCode);
  if (!normalizedClaimedCode) {
    throw new Error("Missing referral code");
  }

  const { previousReferredByCode, normalizedReferredByCode } = await syncWinWinKitUserToLocalState(
    params.supabase,
    params.appUserId,
    params.user,
  );

  if (!normalizedReferredByCode) {
    throw new Error("WinWinKit did not return an applied code for this user");
  }

  if (normalizedReferredByCode !== normalizedClaimedCode) {
    throw new Error("The applied referral code does not match the requested code");
  }

  const codeType = params.user.referred_by?.type ?? "referral";
  let referralCodeId: string | null = null;

  if (codeType === "affiliate") {
    referralCodeId = await ensureAffiliateReferralCodeRecord(
      params.supabase,
      normalizedReferredByCode,
    );
  }

  const shouldIncrementCounts = previousReferredByCode !== normalizedReferredByCode;
  if (shouldIncrementCounts) {
    const { data: ownerCode, error: ownerCodeLookupError } = await params.supabase
      .from("referral_codes")
      .select("id, owner_user_id, total_signups")
      .eq("code", normalizedReferredByCode)
      .maybeSingle();

    if (ownerCodeLookupError) {
      throw ownerCodeLookupError;
    }

    if (ownerCode?.id) {
      referralCodeId = ownerCode.id;

      const { error: ownerCodeUpdateError } = await params.supabase
        .from("referral_codes")
        .update({
          total_signups: Number(ownerCode.total_signups ?? 0) + 1,
        })
        .eq("id", ownerCode.id);

      if (ownerCodeUpdateError) {
        throw ownerCodeUpdateError;
      }

      if (ownerCode.owner_user_id) {
        const { data: ownerProfile, error: ownerProfileLookupError } = await params.supabase
          .from("profiles")
          .select("referral_count")
          .eq("id", ownerCode.owner_user_id)
          .maybeSingle();

        if (ownerProfileLookupError) {
          throw ownerProfileLookupError;
        }

        const { error: ownerProfileUpdateError } = await params.supabase
          .from("profiles")
          .update({
            referral_count: Number(ownerProfile?.referral_count ?? 0) + 1,
          })
          .eq("id", ownerCode.owner_user_id);

        if (ownerProfileUpdateError) {
          throw ownerProfileUpdateError;
        }
      }
    }
  }

  return {
    codeType: codeType as WinWinKitCodeType,
    normalizedClaimedCode,
    normalizedReferredByCode,
    providerClaimed: params.providerClaimed,
    referralCodeId,
  };
}

export async function markAffiliateConversionAudit(params: {
  supabase: SupabaseClientLike;
  referralCodeId: string;
  userId: string;
  sourceTransactionId: string;
  sourceProductId: string;
  appliedOfferId: string | null;
  amountCents: number;
  commissionCents: number;
  metadata?: Record<string, unknown>;
}) {
  const existing = await params.supabase
    .from("affiliate_conversions")
    .select("id, metadata")
    .eq("provider", "winwinkit")
    .eq("source_transaction_id", params.sourceTransactionId)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data?.id) {
    const { error } = await params.supabase
      .from("affiliate_conversions")
      .update({
        status: "reported",
        amount_cents: params.amountCents,
        commission_cents: params.commissionCents,
        applied_offer_id: params.appliedOfferId,
        metadata: metadataRecord(existing.data.metadata, params.metadata ?? {}),
        updated_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", existing.data.id);

    if (error) {
      throw error;
    }

    return existing.data.id as string;
  }

  const inserted = await params.supabase
    .from("affiliate_conversions")
    .insert({
      provider: "winwinkit",
      referral_code_id: params.referralCodeId,
      user_id: params.userId,
      source_transaction_id: params.sourceTransactionId,
      source_product_id: params.sourceProductId,
      plan: "yearly",
      amount_cents: params.amountCents,
      commission_cents: params.commissionCents,
      applied_offer_id: params.appliedOfferId,
      status: "reported",
      metadata: params.metadata ?? {},
    })
    .select("id")
    .single();

  if (inserted.error) {
    throw inserted.error;
  }

  return inserted.data.id as string;
}
