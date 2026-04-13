export function buildDailyPepQueueDedupeKey(userId: string, dailyPepTalkId: string): string {
  return `daily_pep:${userId}:${dailyPepTalkId}`;
}

export function buildDailyQuoteQueueDedupeKey(userId: string, dailyQuoteId: string): string {
  return `daily_quote:${userId}:${dailyQuoteId}`;
}

