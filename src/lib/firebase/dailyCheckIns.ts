import { getDocuments, getDocument, setDocument, timestampToISO } from "./firestore";

export interface DailyCheckIn {
  id?: string;
  user_id: string;
  check_in_type: "morning" | "evening";
  check_in_date: string;
  mood?: string;
  intention?: string;
  reflection?: string;
  completed_at?: string;
  mentor_response?: string;
  created_at?: string;
  updated_at?: string;
}

export const getCheckIn = async (
  userId: string,
  checkInDate: string,
  checkInType: "morning" | "evening"
): Promise<DailyCheckIn | null> => {
  const checkIns = await getDocuments<DailyCheckIn>(
    "daily_check_ins",
    [
      ["user_id", "==", userId],
      ["check_in_date", "==", checkInDate],
      ["check_in_type", "==", checkInType],
    ],
    undefined,
    undefined,
    1
  );

  if (checkIns.length === 0) return null;

  const checkIn = checkIns[0];
  return {
    ...checkIn,
    completed_at: timestampToISO(checkIn.completed_at as any) || checkIn.completed_at || undefined,
    created_at: timestampToISO(checkIn.created_at as any) || checkIn.created_at || undefined,
    updated_at: timestampToISO(checkIn.updated_at as any) || checkIn.updated_at || undefined,
  };
};

export const getCheckIns = async (
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<DailyCheckIn[]> => {
  const filters: Array<[string, any, any]> = [["user_id", "==", userId]];
  
  if (startDate) {
    filters.push(["created_at", ">=", startDate]);
  }
  if (endDate) {
    filters.push(["created_at", "<=", endDate]);
  }

  const checkIns = await getDocuments<DailyCheckIn>(
    "daily_check_ins",
    filters,
    "created_at",
    "desc"
  );

  return checkIns.map((checkIn) => ({
    ...checkIn,
    completed_at: timestampToISO(checkIn.completed_at as any) || checkIn.completed_at || undefined,
    created_at: timestampToISO(checkIn.created_at as any) || checkIn.created_at || undefined,
    updated_at: timestampToISO(checkIn.updated_at as any) || checkIn.updated_at || undefined,
  }));
};

export const createCheckIn = async (checkIn: Omit<DailyCheckIn, "id" | "created_at" | "updated_at">): Promise<DailyCheckIn> => {
  const checkInId = `${checkIn.user_id}_${checkIn.check_in_date}_${checkIn.check_in_type}_${Date.now()}`;
  const now = new Date().toISOString();
  
  await setDocument("daily_check_ins", checkInId, {
    ...checkIn,
    completed_at: checkIn.completed_at || now,
    created_at: now,
    updated_at: now,
  }, false);

  return {
    ...checkIn,
    id: checkInId,
    completed_at: checkIn.completed_at || now,
    created_at: now,
    updated_at: now,
  };
};

export const getCheckInsCount = async (userId: string): Promise<number> => {
  const checkIns = await getDocuments<DailyCheckIn>("daily_check_ins", [["user_id", "==", userId]]);
  return checkIns.length;
};

