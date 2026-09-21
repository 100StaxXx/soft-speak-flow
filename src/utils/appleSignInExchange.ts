import { getErrorStatus, isNetworkLikeError } from "@/utils/networkErrors";

/** Retry transport failures without reopening Apple's authorization sheet. */
export async function exchangeAppleIdentityToken<T extends { error: unknown }>(
  exchange: () => Promise<T>,
  delay: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    let result: T;
    try { result = await exchange(); }
    catch (error) {
      if (attempt >= 2 || !isTransient(error)) throw error;
      await delay(500 * (attempt + 1));
      continue;
    }
    if (!result.error || attempt >= 2 || !isTransient(result.error)) return result;
    await delay(500 * (attempt + 1));
  }
}

function isTransient(error: unknown): boolean {
  const status = getErrorStatus(error);
  // Never retry a known invalid token/nonce, even if its text mentions networking.
  if (status !== null && status >= 400 && status < 500) return false;
  return status === 0 || (status !== null && status >= 500) || isNetworkLikeError(error);
}
