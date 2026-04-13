export const buildEpicInviteLink = (inviteCode: string): string => {
  const normalizedCode = inviteCode.trim();
  return `${window.location.origin}/join/${encodeURIComponent(normalizedCode)}`;
};

export const buildEpicInviteShareText = (epicTitle: string, inviteCode: string): string =>
  `Join my Cosmiq epic "${epicTitle}" with invite code ${inviteCode}.`;
