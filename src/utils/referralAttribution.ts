import { safeLocalStorage } from "@/utils/storage";
import { productScopedStorageKey } from "@/config/productRuntime";

export const PENDING_REFERRAL_CODE_STORAGE_KEY = productScopedStorageKey(
  "pending-referral-code",
);

const REFERRAL_CODE_PATTERN = /^[A-Z0-9-]{1,20}$/;

export function normalizeReferralCode(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  if (!REFERRAL_CODE_PATTERN.test(normalized)) return null;

  return normalized;
}

export function readPendingReferralCode(): string | null {
  return normalizeReferralCode(safeLocalStorage.getItem(PENDING_REFERRAL_CODE_STORAGE_KEY));
}

export function storePendingReferralCode(code: string): boolean {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return false;
  return safeLocalStorage.setItem(PENDING_REFERRAL_CODE_STORAGE_KEY, normalized);
}

export function clearPendingReferralCode(): boolean {
  return safeLocalStorage.removeItem(PENDING_REFERRAL_CODE_STORAGE_KEY);
}

export function getReferralCodeFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  return normalizeReferralCode(params.get("ref"));
}
