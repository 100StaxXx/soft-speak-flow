import { getDocuments, getDocument } from "./firestore";

export interface Mentor {
  id: string;
  name: string;
  slug: string;
  description: string;
  tone_description: string;
  avatar_url?: string;
  tags: string[];
  mentor_type: string;
  target_user_type?: string;
  short_title?: string;
  primary_color?: string;
  target_user?: string;
  themes?: string[];
  intensity_level?: string;
  is_active?: boolean;
  created_at?: string;
}

// Fetch all mentors from Firestore
export const getAllMentors = async (): Promise<Mentor[]> => {
  try {
    const mentors = await getDocuments<Mentor>(
      "mentors",
      [["is_active", "==", true]], // Only active mentors
      "name",
      "asc"
    );
    return mentors;
  } catch (error) {
    console.error("Error fetching mentors from Firestore:", error);
    // Fallback: try without filter
    try {
      const mentors = await getDocuments<Mentor>("mentors", undefined, "name", "asc");
      return mentors;
    } catch (fallbackError) {
      console.error("Error fetching all mentors:", fallbackError);
      return [];
    }
  }
};

// Fetch a single mentor by ID
export const getMentorById = async (mentorId: string): Promise<Mentor | null> => {
  try {
    return await getDocument<Mentor>("mentors", mentorId);
  } catch (error) {
    console.error("Error fetching mentor by ID:", error);
    return null;
  }
};

// Fetch a mentor by slug
export const getMentorBySlug = async (slug: string): Promise<Mentor | null> => {
  try {
    const mentors = await getDocuments<Mentor>(
      "mentors",
      [["slug", "==", slug]],
      undefined,
      undefined,
      1
    );
    return mentors.length > 0 ? mentors[0] : null;
  } catch (error) {
    console.error("Error fetching mentor by slug:", error);
    return null;
  }
};

