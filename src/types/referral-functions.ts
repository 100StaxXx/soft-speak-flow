// TypeScript interfaces for Referral RPC functions
// FIX Bug #20: Explicit types until database types are regenerated

export interface CompleteReferralStage3Args {
  p_referee_id: string;
  p_referrer_id: string;
}

export interface CompleteReferralStage3Result {
  success: boolean;
  reason?: string;
  message?: string;
  new_count?: number;
  milestone_reached?: boolean;
  skin_unlocked?: boolean;
}

export interface ApplyReferralCodeArgs {
  p_user_id: string;
  p_referrer_id: string;
  p_referral_code: string;
}

export interface ApplyReferralCodeResult {
  success: boolean;
  reason?: string;
  message?: string;
}

export interface HasCompletedReferralArgs {
  p_referee_id: string;
  p_referrer_id: string;
}

export interface IncrementReferralCountArgs {
  referrer_id: string;
}

export interface DecrementReferralCountArgs {
  referrer_id: string;
}
