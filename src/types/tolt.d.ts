export {};

declare global {
  interface Window {
    tolt_referral?: string;
    tolt?: {
      signup?: (email: string, options?: Record<string, unknown>) => void;
    };
    tolt_data?: {
      partner_id?: string;
      click_id?: string;
      referral?: string;
    };
  }
}
