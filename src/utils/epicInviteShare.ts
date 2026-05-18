import { Capacitor } from "@capacitor/core";
import { getRedirectUrlWithPath } from "@/utils/redirectUrl";

const EPIC_INVITE_DEEP_LINK_BASE = "cosmiq://join";

export const buildEpicInviteLink = (inviteCode: string): string => {
  const normalizedCode = inviteCode.trim();
  const encodedCode = encodeURIComponent(normalizedCode);

  if (Capacitor.isNativePlatform()) {
    return `${EPIC_INVITE_DEEP_LINK_BASE}/${encodedCode}`;
  }

  return getRedirectUrlWithPath(`/join/${encodedCode}`);
};

export const buildEpicInviteShareText = (epicTitle: string, inviteCode: string): string =>
  `Join my Cosmiq epic "${epicTitle}" with invite code ${inviteCode}.`;
