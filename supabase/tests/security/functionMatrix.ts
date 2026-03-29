export type FunctionAuthMode =
  | "jwt"
  | "service-role"
  | "internal-secret"
  | "hmac"
  | "public-rate-limited";

export interface FunctionSecurityTarget {
  name: string;
  authMode: FunctionAuthMode;
  body: Record<string, unknown>;
}

export const FUNCTION_SECURITY_MATRIX: readonly FunctionSecurityTarget[] = [
  {
    name: "mentor-chat",
    authMode: "jwt",
    body: {
      message: "Security suite check-in",
      mentorName: "Eli",
      mentorTone: "supportive",
    },
  },
  {
    name: "generate-companion-evolution",
    authMode: "jwt",
    body: {},
  },
  {
    name: "verify-admin-access",
    authMode: "jwt",
    body: {},
  },
  {
    name: "process-paypal-payout",
    authMode: "jwt",
    body: {},
  },
  {
    name: "dispatch-mentor-nudge-pushes",
    authMode: "service-role",
    body: {},
  },
  {
    name: "send-apns-notification",
    authMode: "internal-secret",
    body: {
      deviceToken: "short-token",
      title: "Security test",
      body: "This payload should fail validation before delivery.",
    },
  },
  {
    name: "record-subscription",
    authMode: "hmac",
    body: {
      user_id: "10000000-0000-0000-0000-000000000001",
      referral_code: "SECURITY",
      plan: "monthly",
      amount: 9.99,
      apple_transaction_id: "security-suite-tx",
      source_app: "security-suite",
    },
  },
  {
    name: "get-creator-stats",
    authMode: "public-rate-limited",
    body: {
      referral_code: "SECURITY",
      creator_access_token: "not-a-real-token",
    },
  },
] as const;
