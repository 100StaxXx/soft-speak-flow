import type { AccessState } from "@/hooks/useAccessState";
import type { StoreKitTransaction } from "@/types/subscription";
import { resolvePlanFromProductId, type IAPPlan } from "@/utils/appleIAP";

const STORAGE_PREFIX = "cosmiq.localSubscriptionAccess.v1";

function normalizeToken(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}.${userId}`;
}

export function getActiveSubscriptionEnd(transaction: StoreKitTransaction | null): string | null {
  if (!transaction || transaction.cancelled || transaction.pending || transaction.revocationDate) {
    return null;
  }

  if (!transaction.expirationDate) return null;

  const expirationDate = new Date(transaction.expirationDate);
  if (Number.isNaN(expirationDate.getTime()) || expirationDate <= new Date()) {
    return null;
  }

  return transaction.expirationDate;
}

export function storeKitTransactionMatchesUser(
  transaction: StoreKitTransaction | null,
  userId: string | null | undefined,
): boolean {
  if (!transaction || !userId) return false;

  const appAccountToken = normalizeToken(transaction.appAccountToken);
  if (!appAccountToken) return true;

  return appAccountToken === normalizeToken(userId);
}

export function buildLocalSubscriptionAccessState(
  transaction: StoreKitTransaction | null,
  userId: string | null | undefined,
  planOverride?: IAPPlan | null,
): AccessState | null {
  if (!storeKitTransactionMatchesUser(transaction, userId)) return null;

  const subscriptionEnd = getActiveSubscriptionEnd(transaction);
  if (!subscriptionEnd) return null;

  const productPlan = resolvePlanFromProductId(transaction?.productId);
  const plan = planOverride ?? productPlan;
  if (!productPlan || !plan || plan !== productPlan) return null;

  return {
    has_access: true,
    access_source: "subscription",
    trial_ends_at: null,
    subscribed: true,
    status: "active",
    plan,
    subscription_end: subscriptionEnd,
  };
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isActiveAccessState(value: unknown): value is AccessState {
  if (!value || typeof value !== "object") return false;

  const accessState = value as Partial<AccessState>;
  if (!accessState.subscribed || !accessState.has_access) return false;
  if (accessState.access_source !== "subscription") return false;
  if (accessState.status !== "active") return false;
  if (accessState.plan !== "monthly" && accessState.plan !== "yearly") return false;
  if (typeof accessState.subscription_end !== "string") return false;

  const subscriptionEnd = new Date(accessState.subscription_end);
  return !Number.isNaN(subscriptionEnd.getTime()) && subscriptionEnd > new Date();
}

export function readLocalSubscriptionAccess(userId: string | null | undefined): AccessState | null {
  if (!userId) return null;

  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(storageKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (isActiveAccessState(parsed)) {
      return parsed;
    }

    storage.removeItem(storageKey(userId));
    return null;
  } catch {
    try {
      storage.removeItem(storageKey(userId));
    } catch {
      // Ignore local storage cleanup failures.
    }
    return null;
  }
}

export function rememberLocalSubscriptionAccess(
  userId: string | null | undefined,
  accessState: AccessState | null,
): void {
  if (!userId || !isActiveAccessState(accessState)) return;

  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(storageKey(userId), JSON.stringify(accessState));
  } catch {
    // Local persistence is a best-effort backup. RevenueCat and the backend remain the sources of truth.
  }
}
