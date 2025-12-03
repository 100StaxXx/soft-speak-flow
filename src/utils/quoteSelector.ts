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
 * Uses a consistent ordering to ensure the same quote is returned for the same date
 */
export const getQuoteOfTheDay = async () => {
  const today = new Date().toLocaleDateString("en-CA");
  // Create a more robust seed from the date (YYYY-MM-DD format)
  const [year, month, day] = today.split("-").map(Number);
  const seed = year * 10000 + month * 100 + day;

  // First, get the total count of quotes
  const { count, error: countError } = await supabase
    .from("quotes")
    .select("*", { count: 'exact', head: true });

  if (countError || !count || count === 0) {
    return null;
  }

  // Calculate which quote to fetch based on the seed
  const index = seed % count;

  // Fetch just that one quote using consistent ordering by id
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .order("id", { ascending: true })
    .range(index, index);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0];
};
