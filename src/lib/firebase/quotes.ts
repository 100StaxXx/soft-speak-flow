import { getDocuments, getDocument, timestampToISO } from "./firestore";

export interface Quote {
  id: string;
  quote: string;
  author?: string;
  title?: string;
  audio_url?: string;
  mentor_id?: string;
  date?: string;
  created_at?: string;
  updated_at?: string;
}

export const getQuote = async (quoteId: string): Promise<Quote | null> => {
  return await getDocument<Quote>("quotes", quoteId);
};

export const getQuotes = async (
  mentorId?: string,
  limitCount?: number
): Promise<Quote[]> => {
  const filters: Array<[string, any, any]> | undefined = mentorId
    ? [["mentor_id", "==", mentorId]]
    : undefined;

  const quotes = await getDocuments<Quote>("quotes", filters, "created_at", "desc", limitCount);

  return quotes.map((quote) => ({
    ...quote,
    created_at: timestampToISO(quote.created_at as any) || quote.created_at || undefined,
    updated_at: timestampToISO(quote.updated_at as any) || quote.updated_at || undefined,
  }));
};

export const getQuotesCount = async (): Promise<number> => {
  const quotes = await getDocuments<Quote>("quotes");
  return quotes.length;
};

