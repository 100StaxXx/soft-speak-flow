import { useEffect, useState } from "react";

import {
  getPendingMentorMood,
  subscribeToPendingMentorMood,
} from "@/utils/mentorMoodSignal";

export const usePendingMentorMood = (): string | null => {
  const [mood, setMood] = useState<string | null>(() => getPendingMentorMood());

  useEffect(() => {
    setMood(getPendingMentorMood());
    return subscribeToPendingMentorMood(setMood);
  }, []);

  return mood;
};
