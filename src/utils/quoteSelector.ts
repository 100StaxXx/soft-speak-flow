import { supabase } from "@/integrations/supabase/client";

interface QuoteFilters {
  category?: string;
  emotionalTriggers?: string[];
  mentorId?: string;
  intensity?: string;
  limit?: number;
}

/**
 * Fetches quotes that match the given context filters
 * Returns quotes ordered by relevance (matching multiple criteria first)
 */
export const fetchContextualQuotes = async (filters: QuoteFilters) => {
  const { category, emotionalTriggers, mentorId, intensity, limit = 1 } = filters;

  let query = supabase
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false });

  // Apply filters
  if (category) {
    query = query.eq("category", category);
  }

  if (mentorId) {
    query = query.eq("mentor_id", mentorId);
  }

  if (intensity) {
    query = query.eq("intensity", intensity);
  }

  // Filter by emotional triggers if provided
  if (emotionalTriggers && emotionalTriggers.length > 0) {
    query = query.overlaps("emotional_triggers", emotionalTriggers);
  }

  query = query.limit(limit * 3); // Get more than needed for rotation

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching quotes:", error);
    return [];
  }

  // Shuffle and return limited results for variety
  const shuffled = data?.sort(() => Math.random() - 0.5) || [];
  return shuffled.slice(0, limit);
};

/**
 * Get a random quote (for loading screens, empty states)
 */
export const getRandomQuote = async () => {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .limit(50);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[Math.floor(Math.random() * data.length)];
};

/**
 * Get quote of the day (deterministic based on current date)
 */
export const getQuoteOfTheDay = async () => {
  const today = new Date().toISOString().split("T")[0];
  const seed = today.split("-").reduce((acc, val) => acc + parseInt(val), 0);

  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .limit(100);

  if (error || !data || data.length === 0) {
    return null;
  }

  // Use date as seed for consistent daily quote
  const index = seed % data.length;
  return data[index];
};
