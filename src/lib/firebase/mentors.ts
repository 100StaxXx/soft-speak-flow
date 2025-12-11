import { getDocuments, getDocument, timestampToISO } from "./firestore";

export interface Mentor {
  id: string;
  name: string;
  voice?: string;
  avatar_url?: string;
  tone_description?: string;
  slug?: string;
  archetype?: string;
  short_title?: string;
  style_description?: string;
  target_user?: string;
  intensity_level?: string;
  gender_energy?: string;
  primary_color?: string;
  signature_line?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const getMentor = async (mentorId: string): Promise<Mentor | null> => {
  const mentor = await getDocument<Mentor>("mentors", mentorId);
  if (!mentor) return null;

  return {
    ...mentor,
    created_at: timestampToISO(mentor.created_at as any) || mentor.created_at || undefined,
    updated_at: timestampToISO(mentor.updated_at as any) || mentor.updated_at || undefined,
  };
};

export const getMentors = async (activeOnly = true): Promise<Mentor[]> => {
  const filters: Array<[string, any, any]> | undefined = activeOnly
    ? [["is_active", "==", true]]
    : undefined;

  const mentors = await getDocuments<Mentor>("mentors", filters, "name", "asc");

  return mentors.map((mentor) => ({
    ...mentor,
    created_at: timestampToISO(mentor.created_at as any) || mentor.created_at || undefined,
    updated_at: timestampToISO(mentor.updated_at as any) || mentor.updated_at || undefined,
  }));
};
