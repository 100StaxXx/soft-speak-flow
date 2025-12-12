import { getDocuments, getDocument, setDocument, updateDocument, timestampToISO } from "./firestore";

export interface ReferralPayout {
  id: string;
  referrer_id: string;
  referee_id: string;
  referral_code_id?: string | null;
  amount: number;
  status: "pending" | "approved" | "paid" | "rejected";
  payout_type: "first_month" | "first_year";
  apple_transaction_id?: string | null;
  created_at?: string;
  approved_at?: string | null;
  paid_at?: string | null;
  rejected_at?: string | null;
  admin_notes?: string | null;
  paypal_transaction_id?: string | null;
  referral_code?: {
    code: string;
    owner_type: "user" | "influencer";
    owner_user_id?: string | null;
    influencer_name?: string | null;
    influencer_email?: string | null;
    influencer_handle?: string | null;
    payout_identifier?: string | null;
  } | null;
  referee?: {
    email: string;
  };
}

export const getReferralPayouts = async (): Promise<ReferralPayout[]> => {
  const payouts = await getDocuments<ReferralPayout>(
    "referral_payouts",
    undefined,
    "created_at",
    "desc"
  );

  // Enrich with referral code and referee data
  const enrichedPayouts = await Promise.all(
    payouts.map(async (payout) => {
      let referralCode = null;
      if (payout.referral_code_id) {
        const code = await getDocument<{
          code: string;
          owner_type: "user" | "influencer";
          owner_user_id?: string | null;
          influencer_name?: string | null;
          influencer_email?: string | null;
          influencer_handle?: string | null;
          payout_identifier?: string | null;
        }>("referral_codes", payout.referral_code_id);
        if (code) {
          referralCode = code;
        }
      }

      let referee = null;
      const refereeProfile = await getDocument<{ email?: string }>("profiles", payout.referee_id);
      if (refereeProfile?.email) {
        referee = { email: refereeProfile.email };
      }

      return {
        ...payout,
        referral_code: referralCode,
        referee,
        created_at: timestampToISO(payout.created_at as any) || payout.created_at || undefined,
        approved_at: timestampToISO(payout.approved_at as any) || payout.approved_at || undefined,
        paid_at: timestampToISO(payout.paid_at as any) || payout.paid_at || undefined,
        rejected_at: timestampToISO(payout.rejected_at as any) || payout.rejected_at || undefined,
      };
    })
  );

  return enrichedPayouts;
};

export const createReferralPayout = async (
  payout: Omit<ReferralPayout, "id" | "created_at">
): Promise<ReferralPayout> => {
  const payoutId = `${payout.referrer_id}_${payout.referee_id}_${Date.now()}`;
  await setDocument(
    "referral_payouts",
    payoutId,
    {
      ...payout,
      created_at: new Date().toISOString(),
    },
    false
  );

  const created = await getDocument<ReferralPayout>("referral_payouts", payoutId);
  if (!created) throw new Error("Failed to create payout");

  return {
    ...created,
    created_at: timestampToISO(created.created_at as any) || created.created_at || undefined,
  };
};

export const updateReferralPayout = async (
  payoutId: string,
  updates: Partial<ReferralPayout>
): Promise<void> => {
  await updateDocument("referral_payouts", payoutId, updates);
};

export const getReferralPayoutsByCode = async (
  referralCodeId: string
): Promise<ReferralPayout[]> => {
  const payouts = await getDocuments<ReferralPayout>(
    "referral_payouts",
    [["referral_code_id", "==", referralCodeId]],
    "created_at",
    "desc"
  );

  return payouts.map((payout) => ({
    ...payout,
    created_at: timestampToISO(payout.created_at as any) || payout.created_at || undefined,
    approved_at: timestampToISO(payout.approved_at as any) || payout.approved_at || undefined,
    paid_at: timestampToISO(payout.paid_at as any) || payout.paid_at || undefined,
    rejected_at: timestampToISO(payout.rejected_at as any) || payout.rejected_at || undefined,
  }));
};

