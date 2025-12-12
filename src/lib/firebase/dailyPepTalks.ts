import { getDocuments, getDocument, timestampToISO } from "./firestore";

export interface DailyPepTalk {
  id: string;
  for_date: string;
  mentor_slug: string;
  title: string;
  summary: string;
  script: string;
  audio_url: string;
  topic_category?: string | string[];
  intensity?: string;
  emotional_triggers?: string[];
  transcript?: any;
  created_at?: string;
}

export const getDailyPepTalk = async (
  forDate: string,
  mentorSlug: string
): Promise<DailyPepTalk | null> => {
  const pepTalks = await getDocuments<DailyPepTalk>(
    "daily_pep_talks",
    [
      ["for_date", "==", forDate],
      ["mentor_slug", "==", mentorSlug],
    ],
    undefined,
    undefined,
    1
  );

  if (pepTalks.length === 0) return null;

  const pepTalk = pepTalks[0];
  return {
    ...pepTalk,
    created_at: timestampToISO(pepTalk.created_at as any) || pepTalk.created_at || undefined,
  };
};

export const getDailyPepTalks = async (
  mentorSlug?: string,
  limitCount?: number
): Promise<DailyPepTalk[]> => {
  const filters: Array<[string, any, any]> | undefined = mentorSlug
    ? [["mentor_slug", "==", mentorSlug]]
    : undefined;

  const pepTalks = await getDocuments<DailyPepTalk>(
    "daily_pep_talks",
    filters,
    "for_date",
    "desc",
    limitCount
  );

  return pepTalks.map((pepTalk) => ({
    ...pepTalk,
    created_at: timestampToISO(pepTalk.created_at as any) || pepTalk.created_at || undefined,
  }));
};

