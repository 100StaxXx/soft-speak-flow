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

// RPC function type definitions for type-safe calls
export interface CreateCompanionIfNotExistsArgs {
  p_user_id: string;
  p_favorite_color: string;
  p_spirit_animal: string;
  p_core_element: string;
  p_story_tone: string;
  p_current_image_url: string;
  p_initial_image_url: string;
  p_eye_color: string;
  p_fur_color: string;
}

export interface CreateCompanionIfNotExistsResult {
  id: string;
  user_id: string;
  favorite_color: string;
  spirit_animal: string;
  core_element: string;
  story_tone: string;
  current_stage: number;
  current_xp: number;
  current_image_url: string;
  initial_image_url: string;
  eye_color: string;
  fur_color: string;
  mind: number;
  body: number;
  soul: number;
  current_mood: string;
  last_mood_update: string;
  last_energy_update: string;
  created_at: string;
  updated_at: string;
  is_new: boolean;
}
