const APP_STORE_CONNECT_API_BASE_URL = "https://api.appstoreconnect.apple.com/v1";
export const DEFAULT_CUSTOM_CODE_REDEMPTION_LIMIT = 25000;

type JsonApiData<T> = {
  id: string;
  type: string;
  attributes?: T;
};

type JsonApiResponse<T> = {
  data?: JsonApiData<T> | Array<JsonApiData<T>>;
  errors?: Array<{ detail?: string; title?: string; code?: string; status?: string }>;
};

type SubscriptionOfferCodeCustomCodeAttributes = {
  active?: boolean;
  customCode?: string;
  expirationDate?: string;
  numberOfCodes?: number;
};

export type AppleCustomOfferCodeRecord = {
  id: string;
  customCode: string | null;
  active: boolean | null;
  expirationDate: string | null;
  numberOfCodes: number | null;
};

export class AppStoreConnectApiError extends Error {
  status: number;
  details: string | null;

  constructor(message: string, status: number, details?: string | null) {
    super(message);
    this.name = "AppStoreConnectApiError";
    this.status = status;
    this.details = details ?? null;
  }
}

const getRequiredEnv = (key: string) => {
  const value = Deno.env.get(key)?.trim();
  if (!value) {
    throw new AppStoreConnectApiError(`Missing ${key} configuration`, 500);
  }
  return value;
};

const base64UrlEncode = (data: Uint8Array): string => {
  const binString = Array.from(data, (byte) => String.fromCharCode(byte)).join("");
  const base64 = btoa(binString);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

async function createAppStoreConnectJWT(): Promise<string> {
  const keyId = getRequiredEnv("APPLE_KEY_ID");
  const issuerId = getRequiredEnv("APPLE_ISSUER_ID");
  const privateKeyPem = getRequiredEnv("APPLE_PRIVATE_KEY");

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 20 * 60;

  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT",
  };

  const payload = {
    iss: issuerId,
    iat: now,
    exp: expiry,
    aud: "appstoreconnect-v1",
  };

  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const keyBase64 = privateKeyPem
    .split("\n")
    .filter((line) => !line.startsWith("-----"))
    .join("");

  const keyBuffer = Uint8Array.from(atob(keyBase64), (char) => char.charCodeAt(0)).buffer;
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function appStoreConnectRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<JsonApiResponse<T>> {
  const jwt = await createAppStoreConnectJWT();
  const response = await fetch(`${APP_STORE_CONNECT_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text
    ? JSON.parse(text) as JsonApiResponse<T>
    : { data: undefined } as JsonApiResponse<T>;

  if (!response.ok) {
    const details = payload.errors?.map((error) => error.detail || error.title).filter(Boolean).join("; ") || text;
    throw new AppStoreConnectApiError(
      `App Store Connect request failed with status ${response.status}`,
      response.status,
      details,
    );
  }

  return payload;
}

const normalizeCustomCodeRecord = (
  data: JsonApiData<SubscriptionOfferCodeCustomCodeAttributes>,
): AppleCustomOfferCodeRecord => ({
  id: data.id,
  customCode: data.attributes?.customCode ?? null,
  active: data.attributes?.active ?? null,
  expirationDate: data.attributes?.expirationDate ?? null,
  numberOfCodes: data.attributes?.numberOfCodes ?? null,
});

const getOfferCodeCampaignId = () => getRequiredEnv("APPLE_SUBSCRIPTION_OFFER_CODE_ID");
export const getOfferCodeCampaignIdentifier = () => getRequiredEnv("APPLE_OFFER_CODE_IDENTIFIER");

export const getCustomCodeRedemptionLimit = () => {
  const rawValue = Deno.env.get("APPLE_OFFER_CODE_MAX_REDEMPTIONS_PER_CUSTOM_CODE");
  const parsedValue = rawValue ? Number(rawValue) : NaN;
  return Number.isFinite(parsedValue) && parsedValue > 0
    ? Math.floor(parsedValue)
    : DEFAULT_CUSTOM_CODE_REDEMPTION_LIMIT;
};

export const getOfferCodeExpiryDate = () => {
  const configuredDate = Deno.env.get("APPLE_OFFER_CODE_EXPIRATION_DATE")?.trim();
  if (configuredDate) {
    return configuredDate;
  }

  return null;
};

export const buildAppleCustomOfferCodeCreateAttributes = (customCode: string) => {
  const expirationDate = getOfferCodeExpiryDate();
  const attributes: SubscriptionOfferCodeCustomCodeAttributes = {
    active: true,
    customCode,
    numberOfCodes: getCustomCodeRedemptionLimit(),
  };

  if (expirationDate) {
    attributes.expirationDate = expirationDate;
  }

  return attributes;
};

export const buildAppleCustomOfferCodeUpdateAttributes = () => {
  const expirationDate = getOfferCodeExpiryDate();
  const attributes: Partial<SubscriptionOfferCodeCustomCodeAttributes> = {
    active: true,
    numberOfCodes: getCustomCodeRedemptionLimit(),
  };

  if (expirationDate) {
    attributes.expirationDate = expirationDate;
  }

  return attributes;
};

export async function findAppleCustomOfferCodeByValue(customCode: string) {
  const offerCodeId = getOfferCodeCampaignId();
  const searchParams = new URLSearchParams({
    "filter[customCode]": customCode,
    limit: "1",
  });

  const response = await appStoreConnectRequest<SubscriptionOfferCodeCustomCodeAttributes>(
    `/subscriptionOfferCodes/${offerCodeId}/customCodes?${searchParams.toString()}`,
  );

  const firstRecord = Array.isArray(response.data) ? response.data[0] : response.data;
  return firstRecord ? normalizeCustomCodeRecord(firstRecord) : null;
}

export async function createAppleCustomOfferCode(customCode: string) {
  const offerCodeId = getOfferCodeCampaignId();

  const response = await appStoreConnectRequest<SubscriptionOfferCodeCustomCodeAttributes>(
    "/subscriptionOfferCodeCustomCodes",
    {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "subscriptionOfferCodeCustomCodes",
          attributes: buildAppleCustomOfferCodeCreateAttributes(customCode),
          relationships: {
            offerCode: {
              data: {
                type: "subscriptionOfferCodes",
                id: offerCodeId,
              },
            },
          },
        },
      }),
    },
  );

  const createdRecord = Array.isArray(response.data) ? response.data[0] : response.data;
  if (!createdRecord) {
    throw new AppStoreConnectApiError("App Store Connect returned no custom offer code", 502);
  }

  return normalizeCustomCodeRecord(createdRecord);
}

export async function updateAppleCustomOfferCode(
  customCodeId: string,
  attributes: Partial<SubscriptionOfferCodeCustomCodeAttributes>,
) {
  const response = await appStoreConnectRequest<SubscriptionOfferCodeCustomCodeAttributes>(
    `/subscriptionOfferCodeCustomCodes/${customCodeId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        data: {
          id: customCodeId,
          type: "subscriptionOfferCodeCustomCodes",
          attributes,
        },
      }),
    },
  );

  const updatedRecord = Array.isArray(response.data) ? response.data[0] : response.data;
  if (!updatedRecord) {
    throw new AppStoreConnectApiError("App Store Connect returned no updated custom offer code", 502);
  }

  return normalizeCustomCodeRecord(updatedRecord);
}

type AppleOfferCodeClient = {
  findByValue(customCode: string): Promise<AppleCustomOfferCodeRecord | null>;
  create(customCode: string): Promise<AppleCustomOfferCodeRecord>;
  update(
    customCodeId: string,
    attributes: Partial<SubscriptionOfferCodeCustomCodeAttributes>,
  ): Promise<AppleCustomOfferCodeRecord>;
  deactivate(customCodeId: string): Promise<AppleCustomOfferCodeRecord | null>;
};

const defaultAppleOfferCodeClient: AppleOfferCodeClient = {
  findByValue: findAppleCustomOfferCodeByValue,
  create: createAppleCustomOfferCode,
  update: updateAppleCustomOfferCode,
  deactivate: deactivateAppleCustomOfferCode,
};

const sameOfferCampaignIdentifier = (
  left: string | null,
  right: string,
) => left?.toLowerCase() === right.toLowerCase();

export async function ensureAppleCustomOfferCode(params: {
  customCode: string;
  existingCustomCodeId?: string | null;
  existingCampaignIdentifier?: string | null;
}, client: AppleOfferCodeClient = defaultAppleOfferCodeClient) {
  const targetCampaignIdentifier = getOfferCodeCampaignIdentifier();
  const existingCustomCodeId = params.existingCustomCodeId?.trim() || null;
  const existingCampaignIdentifier = params.existingCampaignIdentifier?.trim() || null;
  const shouldReplaceExistingCampaign = Boolean(
    existingCustomCodeId &&
      existingCampaignIdentifier &&
      !sameOfferCampaignIdentifier(existingCampaignIdentifier, targetCampaignIdentifier),
  );
  const desiredUpdateAttributes = buildAppleCustomOfferCodeUpdateAttributes();

  let existingRecord: AppleCustomOfferCodeRecord | null = null;

  if (existingCustomCodeId && shouldReplaceExistingCampaign) {
    try {
      await client.deactivate(existingCustomCodeId);
    } catch (error) {
      if (!(error instanceof AppStoreConnectApiError) || error.status !== 404) {
        throw error;
      }
    }

    try {
      return await client.create(params.customCode);
    } catch (error) {
      if (error instanceof AppStoreConnectApiError && error.status === 409) {
        const conflictedRecord = await client.findByValue(params.customCode);
        if (conflictedRecord?.id && conflictedRecord.id !== existingCustomCodeId) {
          return await client.update(conflictedRecord.id, desiredUpdateAttributes);
        }
      }
      throw error;
    }
  } else if (existingCustomCodeId) {
    try {
      existingRecord = await client.findByValue(params.customCode);
      if (existingRecord?.id) {
        return existingRecord;
      }
    } catch (error) {
      if (!(error instanceof AppStoreConnectApiError) || error.status !== 404) {
        throw error;
      }
    }

    try {
      return await client.update(existingCustomCodeId, desiredUpdateAttributes);
    } catch (error) {
      if (!(error instanceof AppStoreConnectApiError) || error.status !== 404) {
        throw error;
      }
    }
  }

  try {
    existingRecord = await client.findByValue(params.customCode);
  } catch (error) {
    console.warn("Unable to look up Apple custom offer code before create:", error);
  }

  if (existingRecord?.id) {
    return await client.update(existingRecord.id, desiredUpdateAttributes);
  }

  try {
    return await client.create(params.customCode);
  } catch (error) {
    if (error instanceof AppStoreConnectApiError && error.status === 409) {
      const conflictedRecord = await client.findByValue(params.customCode);
      if (conflictedRecord?.id) {
        return await client.update(conflictedRecord.id, desiredUpdateAttributes);
      }
    }
    throw error;
  }
}

export async function deactivateAppleCustomOfferCode(customCodeId: string | null | undefined) {
  if (!customCodeId) {
    return null;
  }

  return await updateAppleCustomOfferCode(customCodeId, {
    active: false,
  });
}
