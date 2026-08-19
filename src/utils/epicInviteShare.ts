import { Capacitor } from "@capacitor/core";
import { PRODUCT } from "@/config/product";
import { PRODUCT_RUNTIME } from "@/config/productRuntime";
import { getRedirectUrlWithPath } from "@/utils/redirectUrl";

const EPIC_INVITE_DEEP_LINK_BASE = `${PRODUCT_RUNTIME.nativeScheme}://join`;

export const buildEpicInviteLink = (inviteCode: string): string => {
  const normalizedCode = inviteCode.trim();
  const encodedCode = encodeURIComponent(normalizedCode);

  if (Capacitor.isNativePlatform()) {
    return `${EPIC_INVITE_DEEP_LINK_BASE}/${encodedCode}`;
  }

  return getRedirectUrlWithPath(`/join/${encodedCode}`);
};

export const buildEpicInviteShareText = (epicTitle: string, inviteCode: string): string =>
  `Join my ${PRODUCT.name} commitment "${epicTitle}" with invite code ${inviteCode}.`;
