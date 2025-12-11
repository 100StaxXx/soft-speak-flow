import { getDocument, setDocument, updateDocument, getDocuments, timestampToISO } from "./firestore";

export interface Profile {
  id: string;
  email: string | null;
  is_premium: boolean;
  preferences: Record<string, unknown> | null;
  selected_mentor_id: string | null;
  created_at: string;
  updated_at: string;
  daily_push_enabled: boolean | null;
  daily_push_window: string | null;
  daily_push_time: string | null;
  daily_quote_push_enabled: boolean | null;
  daily_quote_push_window: string | null;
  daily_quote_push_time: string | null;
  timezone: string | null;
  current_habit_streak: number | null;
  longest_habit_streak: number | null;
  onboarding_completed: boolean | null;
  onboarding_data: Record<string, unknown> | null;
  // Trial & subscription fields
  trial_ends_at: string | null;
  subscription_status: string | null;
  subscription_expires_at: string | null;
  // Astrology fields
  zodiac_sign: string | null;
  birthdate: string | null;
  birth_time: string | null;
  birth_location: string | null;
  moon_sign: string | null;
  rising_sign: string | null;
  mercury_sign: string | null;
  mars_sign: string | null;
  venus_sign: string | null;
  cosmic_profile_generated_at: string | null;
  // Faction
  faction: string | null;
  // Referral
  referred_by: string | null;
}

export const getProfile = async (userId: string): Promise<Profile | null> => {
  try {
    const data = await getDocument<Profile>("profiles", userId);
    if (!data) return null;
    
    // Convert Firestore timestamps to ISO strings
    return {
      ...data,
      created_at: timestampToISO(data.created_at as any) || data.created_at || new Date().toISOString(),
      updated_at: timestampToISO(data.updated_at as any) || data.updated_at || new Date().toISOString(),
      trial_ends_at: timestampToISO(data.trial_ends_at as any) || data.trial_ends_at || null,
      subscription_expires_at: timestampToISO(data.subscription_expires_at as any) || data.subscription_expires_at || null,
      cosmic_profile_generated_at: timestampToISO(data.cosmic_profile_generated_at as any) || data.cosmic_profile_generated_at || null,
    } as Profile;
  } catch (error) {
    console.error("[getProfile] Error fetching profile:", error);
    throw error;
  }
};

export const createProfile = async (userId: string, email: string | null, data?: Partial<Profile>): Promise<Profile> => {
  const userTimezone = data?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const newProfile: Partial<Profile> = {
    id: userId,
    email: email,
    is_premium: false,
    preferences: null,
    selected_mentor_id: null,
    daily_push_enabled: null,
    daily_push_window: null,
    daily_push_time: null,
    daily_quote_push_enabled: null,
    daily_quote_push_window: null,
    daily_quote_push_time: null,
    timezone: userTimezone,
    current_habit_streak: null,
    longest_habit_streak: null,
    onboarding_completed: false,
    onboarding_data: {},
    trial_ends_at: null,
    subscription_status: null,
    subscription_expires_at: null,
    zodiac_sign: null,
    birthdate: null,
    birth_time: null,
    birth_location: null,
    moon_sign: null,
    rising_sign: null,
    mercury_sign: null,
    mars_sign: null,
    venus_sign: null,
    cosmic_profile_generated_at: null,
    faction: null,
    referred_by: null,
    ...data, // Override with any provided data
  };

  await setDocument("profiles", userId, newProfile, false);
  
  // Return the profile directly instead of re-reading from Firestore
  // This avoids an extra network round trip and speeds up account creation
  const now = new Date().toISOString();
  return {
    ...newProfile,
    created_at: now,
    updated_at: now,
  } as Profile;
};

export const updateProfile = async (
  userId: string,
  updates: Partial<Profile>
): Promise<void> => {
  await updateDocument("profiles", userId, updates);
};

