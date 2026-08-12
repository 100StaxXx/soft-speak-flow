export type AccessSource = "subscription" | "promo_code" | "trial" | "manual" | "none";

export interface AccessState {
  has_access: boolean;
  access_source: AccessSource;
  trial_ends_at: string | null;
  subscribed: boolean;
  status?: string;
  plan?: string;
  subscription_end?: string;
}
