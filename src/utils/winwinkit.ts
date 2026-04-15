import { WINWINKIT_AFFILIATES_URL } from "@/constants/winwinkit";

function shouldSkipAutoRedirect(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /jsdom/i.test(navigator.userAgent);
}

export function redirectToWinWinKit() {
  if (typeof window === "undefined" || shouldSkipAutoRedirect()) {
    return;
  }

  window.location.replace(WINWINKIT_AFFILIATES_URL);
}
