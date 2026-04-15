const WINWINKIT_API_BASE_URL = "https://api.winwinkit.com";

type WinWinKitEnvelope<T> = {
  data?: T;
  errors?: Array<{
    code?: string;
    detail?: string;
    title?: string;
    status?: string;
  }>;
};

export type WinWinKitCodeType = "affiliate" | "promo" | "referral" | string;

export type WinWinKitRewardBucket = Record<string, unknown[]> | null | undefined;

export type WinWinKitUser = {
  app_user_id: string;
  referral_code: string | null;
  referral_code_link?: string | null;
  is_premium: boolean;
  is_trial?: boolean | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  metadata?: Record<string, unknown> | null;
  claim_code_eligibility?: {
    eligible: boolean;
    eligible_until?: string | null;
  } | null;
  referred_by?: {
    code: string;
    type: WinWinKitCodeType;
  } | null;
  stats?: {
    claims?: number | null;
    conversions?: number | null;
    churns?: number | null;
  } | null;
  rewards?: {
    active?: WinWinKitRewardBucket;
    expired?: WinWinKitRewardBucket;
  } | null;
};

type CreateOrUpdateUserResponse = {
  user: WinWinKitUser;
};

type FetchUserResponse = {
  user: WinWinKitUser;
};

type ClaimCodeResponse = {
  user: WinWinKitUser;
  rewards_granted?: WinWinKitRewardBucket;
};

export class WinWinKitApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "WinWinKitApiError";
    this.status = status;
  }
}

const getRequiredEnv = (key: string) => {
  const value = Deno.env.get(key)?.trim();
  if (!value) {
    throw new WinWinKitApiError(`Missing ${key} configuration`, 500);
  }
  return value;
};

const getApiKey = () => getRequiredEnv("WINWINKIT_API_KEY");

async function winWinKitRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${WINWINKIT_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  let payload: WinWinKitEnvelope<T>;
  try {
    payload = text ? JSON.parse(text) as WinWinKitEnvelope<T> : {};
  } catch {
    throw new WinWinKitApiError(
      text || `WinWinKit request failed with status ${response.status}`,
      response.status,
    );
  }

  if (!response.ok || !payload.data) {
    const details = payload.errors?.map((error) => error.detail || error.title || error.code)
      .filter(Boolean)
      .join("; ");
    throw new WinWinKitApiError(
      details || `WinWinKit request failed with status ${response.status}`,
      response.status,
    );
  }

  return payload.data;
}

export async function createOrUpdateWinWinKitUser(params: {
  appUserId: string;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  isPremium?: boolean | null;
  metadata?: Record<string, unknown> | null;
}) {
  const body: Record<string, unknown> = {
    app_user_id: params.appUserId,
  };

  if (params.firstSeenAt) {
    body.first_seen_at = params.firstSeenAt;
  }
  if (params.lastSeenAt) {
    body.last_seen_at = params.lastSeenAt;
  }
  if (typeof params.isPremium === "boolean") {
    body.is_premium = params.isPremium;
  }
  if (params.metadata) {
    body.metadata = params.metadata;
  }

  const data = await winWinKitRequest<CreateOrUpdateUserResponse>("/users", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return data.user;
}

export async function fetchWinWinKitUser(appUserId: string) {
  const data = await winWinKitRequest<FetchUserResponse>(`/users/${encodeURIComponent(appUserId)}`, {
    method: "GET",
  });
  return data.user;
}

export async function claimWinWinKitCode(params: {
  appUserId: string;
  code: string;
}) {
  const data = await winWinKitRequest<ClaimCodeResponse>(
    `/users/${encodeURIComponent(params.appUserId)}/claim-code`,
    {
      method: "POST",
      body: JSON.stringify({
        code: params.code,
      }),
    },
  );

  return {
    user: data.user,
    rewardsGranted: data.rewards_granted ?? null,
  };
}

export function normalizeWinWinKitCode(code: string | null | undefined): string | null {
  if (typeof code !== "string") return null;
  const normalized = code.trim().toUpperCase();
  return normalized || null;
}
