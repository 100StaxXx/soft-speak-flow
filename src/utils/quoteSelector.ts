import { getDocuments } from "@/lib/firebase/firestore";

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

  // Build filters array
  const filtersArray: Array<[string, any, any]> = [];
  
  if (category) {
    filtersArray.push(["category", "==", category]);
  }

  if (mentorId) {
    filtersArray.push(["mentor_id", "==", mentorId]);
  }

  if (intensity) {
    filtersArray.push(["intensity", "==", intensity]);
  }

  // Get quotes with filters
  let quotes = await getDocuments("quotes", filtersArray.length > 0 ? filtersArray : undefined, "created_at", "desc", limit * 3);

  // Filter by emotional triggers if provided (Firestore doesn't support array-overlaps directly)
  if (emotionalTriggers && emotionalTriggers.length > 0) {
    quotes = quotes.filter((q: any) => {
      const quoteTriggers = q.emotional_triggers || [];
      return emotionalTriggers.some(trigger => quoteTriggers.includes(trigger));
    });
  }

  // Shuffle and return limited results for variety
  const shuffled = quotes.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
};

/**
 * Get a random quote (for loading screens, empty states)
 */
export const getRandomQuote = async () => {
  const quotes = await getDocuments("quotes", undefined, undefined, undefined, 50);

  if (!quotes || quotes.length === 0) {
    return null;
  }

  return quotes[Math.floor(Math.random() * quotes.length)];
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

  // Get all quotes ordered by id for consistent selection
  const quotes = await getDocuments("quotes", undefined, "id", "asc");

  if (!quotes || quotes.length === 0) {
    return null;
  }

  // Calculate which quote to return based on the seed
  const index = seed % quotes.length;
  return quotes[index];
};
