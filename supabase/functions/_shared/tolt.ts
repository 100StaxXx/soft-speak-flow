const TOLT_API_BASE_URL = "https://api.tolt.com/v1";

type ToltApiResponse<T> = {
  success: boolean;
  data?: T | T[];
  error?: string;
};

type ToltPartner = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  status?: string | null;
  payout_method?: string | null;
  payout_details?: Record<string, unknown> | null;
};

type ToltLink = {
  id: string;
  partner_id: string;
  value: string;
  param: string;
};

type ToltCustomer = {
  id: string;
  partner_id: string;
  customer_id?: string | null;
  email?: string | null;
};

type ToltTransaction = {
  id: string;
  customer_id: string;
  amount: number;
};

type ToltCommission = {
  id: string;
  customer_id: string;
  transaction_id?: string | null;
  amount: number | string;
};

export class ToltApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ToltApiError";
    this.status = status;
  }
}

const getRequiredEnv = (key: string) => {
  const value = Deno.env.get(key)?.trim();
  if (!value) {
    throw new ToltApiError(`Missing ${key} configuration`, 500);
  }
  return value;
};

const getApiKey = () => getRequiredEnv("TOLT_API_KEY");

export const getToltProgramId = () => getRequiredEnv("TOLT_PROGRAM_ID");

export const getToltPartnerPortalUrl = () => Deno.env.get("TOLT_PARTNER_PORTAL_URL")?.trim() ?? null;

const unwrapResponse = <T>(payload: ToltApiResponse<T>): T => {
  if (!payload.success || payload.data === undefined) {
    throw new ToltApiError(payload.error || "Tolt request failed", 502);
  }

  if (Array.isArray(payload.data)) {
    const [first] = payload.data;
    if (!first) {
      throw new ToltApiError("Tolt returned an empty data payload", 502);
    }
    return first;
  }

  return payload.data;
};

async function toltRequest<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(`${TOLT_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  let payload: ToltApiResponse<T>;
  try {
    payload = text ? JSON.parse(text) as ToltApiResponse<T> : { success: response.ok } as ToltApiResponse<T>;
  } catch {
    throw new ToltApiError(text || `Tolt request failed with status ${response.status}`, response.status);
  }

  if (!response.ok) {
    throw new ToltApiError(payload.error || `Tolt request failed with status ${response.status}`, response.status);
  }

  return unwrapResponse(payload);
}

export async function createToltLink(params: {
  partnerId: string;
  value: string;
  param?: string;
}) {
  return await toltRequest<ToltLink>("/links", {
    method: "POST",
    body: JSON.stringify({
      program_id: getToltProgramId(),
      partner_id: params.partnerId,
      param: params.param ?? "ref",
      value: params.value,
    }),
  });
}

export async function createToltCustomer(params: {
  partnerId: string;
  email: string;
  customerId: string;
  subscriptionId?: string | null;
  name?: string | null;
  activeAt?: string | null;
  status?: "lead" | "trialing" | "active" | "canceled";
  clickId?: string | null;
}) {
  return await toltRequest<ToltCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      partner_id: params.partnerId,
      customer_id: params.customerId,
      subscription_id: params.subscriptionId ?? undefined,
      name: params.name ?? undefined,
      active_at: params.activeAt ?? undefined,
      status: params.status ?? "active",
      click_id: params.clickId ?? undefined,
    }),
  });
}

export async function updateToltCustomer(
  customerId: string,
  params: {
    status?: "lead" | "trialing" | "active" | "canceled";
    subscriptionId?: string | null;
    activeAt?: string | null;
    name?: string | null;
  },
) {
  return await toltRequest<ToltCustomer>(`/customers/${customerId}`, {
    method: "PUT",
    body: JSON.stringify({
      status: params.status,
      subscription_id: params.subscriptionId ?? undefined,
      active_at: params.activeAt ?? undefined,
      name: params.name ?? undefined,
    }),
  });
}

export async function createToltTransaction(params: {
  customerId: string;
  chargeId: string;
  amountCents: number;
  interval: "year";
  productId: string;
  productName: string;
  createdAt?: string | null;
}) {
  return await toltRequest<ToltTransaction>("/transactions", {
    method: "POST",
    body: JSON.stringify({
      amount: params.amountCents,
      customer_id: params.customerId,
      billing_type: "subscription",
      charge_id: params.chargeId,
      product_id: params.productId,
      product_name: params.productName,
      source: "apple_iap",
      interval: params.interval,
      created_at: params.createdAt ?? undefined,
    }),
  });
}

export async function createToltCommission(params: {
  customerId: string;
  transactionId: string;
  chargeId: string;
  amountCents: number;
  revenueCents: number;
  createdAt?: string | null;
}) {
  return await toltRequest<ToltCommission>("/commissions", {
    method: "POST",
    body: JSON.stringify({
      amount: params.amountCents,
      customer_id: params.customerId,
      transaction_id: params.transactionId,
      charge_id: params.chargeId,
      source: "apple_iap",
      status: "pending",
      revenue: params.revenueCents,
      created_at: params.createdAt ?? undefined,
    }),
  });
}

export function normalizeToltPartner(payload: unknown): ToltPartner | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const partner = payload as Record<string, unknown>;
  if (typeof partner.id !== "string" || !partner.id.trim()) {
    return null;
  }

  return {
    id: partner.id,
    email: typeof partner.email === "string" ? partner.email : null,
    first_name: typeof partner.first_name === "string" ? partner.first_name : null,
    last_name: typeof partner.last_name === "string" ? partner.last_name : null,
    status: typeof partner.status === "string" ? partner.status : null,
    payout_method: typeof partner.payout_method === "string" ? partner.payout_method : null,
    payout_details: partner.payout_details && typeof partner.payout_details === "object"
      ? partner.payout_details as Record<string, unknown>
      : null,
  };
}

export function derivePartnerDisplayName(partner: ToltPartner) {
  const first = partner.first_name?.trim() ?? "";
  const last = partner.last_name?.trim() ?? "";
  const joined = `${first} ${last}`.trim();
  if (joined) return joined;
  if (partner.email) return partner.email;
  return partner.id;
}
