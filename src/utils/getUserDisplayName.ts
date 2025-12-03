/**
 * Gets the display name for a user from their profile data.
 * Prefers userName from onboarding_data, falls back to email prefix, then "Anonymous"
 */
export const getUserDisplayName = (profile?: {
  email?: string | null;
  onboarding_data?: unknown;
} | null): string => {
  if (!profile) return "Anonymous";
  
  // Try to get userName from onboarding_data
  const onboardingData = profile.onboarding_data as Record<string, unknown> | null;
  const userName = onboardingData?.userName as string | undefined;
  
  if (userName && typeof userName === 'string' && userName.trim()) {
    return userName.trim();
  }
  
  // Fallback to email prefix
  if (profile.email) {
    return profile.email.split("@")[0];
  }
  
  return "Anonymous";
};

/**
 * Gets initials from a display name
 */
export const getInitials = (name: string): string => {
  if (!name || name === "Anonymous") return "?";
  
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};
