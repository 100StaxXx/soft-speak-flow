import { getDocuments, getDocument, updateDocument, timestampToISO } from "./firestore";

export interface ReferralCode {
  id: string;
  code: string;
  owner_type: "user" | "influencer";
  owner_user_id?: string | null;
  influencer_name?: string | null;
  influencer_email?: string | null;
  influencer_handle?: string | null;
  payout_method?: string | null;
  payout_identifier?: string | null;
  is_active: boolean;
  total_signups?: number;
  total_conversions?: number;
  total_revenue?: number;
  created_at?: string;
}

export const getReferralCode = async (code: string): Promise<ReferralCode | null> => {
  const codes = await getDocuments<ReferralCode>(
    "referral_codes",
    [
      ["code", "==", code],
      ["is_active", "==", true],
    ],
    undefined,
    undefined,
    1
  );

  if (codes.length === 0) return null;

  const referralCode = codes[0];
  return {
    ...referralCode,
    created_at: timestampToISO(referralCode.created_at as any) || referralCode.created_at || undefined,
  };
};

export const getReferralCodes = async (): Promise<ReferralCode[]> => {
  const codes = await getDocuments<ReferralCode>(
    "referral_codes",
    undefined,
    "created_at",
    "desc"
  );

  return codes.map((code) => ({
    ...code,
    created_at: timestampToISO(code.created_at as any) || code.created_at || undefined,
  }));
};

export const updateReferralCode = async (
  codeId: string,
  updates: Partial<ReferralCode>
): Promise<void> => {
  await updateDocument("referral_codes", codeId, updates);
};

