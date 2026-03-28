const PENDING_MENTOR_MOOD_KEY = "mentor-switcher-pending-mood";
const PENDING_MENTOR_MOOD_EVENT = "mentor-switcher-pending-mood-changed";

type PendingMentorMoodDetail = {
  mood: string | null;
};

const canUseWindow = () => typeof window !== "undefined";

export const getPendingMentorMood = (): string | null => {
  if (!canUseWindow()) return null;
  const mood = window.sessionStorage.getItem(PENDING_MENTOR_MOOD_KEY);
  return mood && mood.trim().length > 0 ? mood : null;
};

export const setPendingMentorMood = (mood: string | null): void => {
  if (!canUseWindow()) return;

  const nextMood = mood?.trim() || null;
  if (nextMood) {
    window.sessionStorage.setItem(PENDING_MENTOR_MOOD_KEY, nextMood);
  } else {
    window.sessionStorage.removeItem(PENDING_MENTOR_MOOD_KEY);
  }

  window.dispatchEvent(
    new CustomEvent<PendingMentorMoodDetail>(PENDING_MENTOR_MOOD_EVENT, {
      detail: { mood: nextMood },
    }),
  );
};

export const subscribeToPendingMentorMood = (
  listener: (mood: string | null) => void,
): (() => void) => {
  if (!canUseWindow()) {
    return () => undefined;
  }

  const handleChange = (event: Event) => {
    const detail = (event as CustomEvent<PendingMentorMoodDetail>).detail;
    listener(detail?.mood ?? null);
  };

  window.addEventListener(PENDING_MENTOR_MOOD_EVENT, handleChange);
  return () => window.removeEventListener(PENDING_MENTOR_MOOD_EVENT, handleChange);
};
