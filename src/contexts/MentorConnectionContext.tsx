import { createContext, type ReactNode, useContext, useMemo } from "react";

import {
  useMentorConnectionHealth,
  type MentorConnectionStatus,
} from "@/hooks/useMentorConnectionHealth";

type MentorConnectionContextValue = {
  mentorId: string | null;
  status: MentorConnectionStatus;
  refreshConnection: () => Promise<void>;
};

const MentorConnectionContext = createContext<MentorConnectionContextValue | null>(null);

export const MentorConnectionProvider = ({ children }: { children: ReactNode }) => {
  const {
    effectiveMentorId,
    status,
    refreshConnection,
  } = useMentorConnectionHealth();

  const value = useMemo<MentorConnectionContextValue>(() => ({
    mentorId: effectiveMentorId,
    status,
    refreshConnection,
  }), [effectiveMentorId, refreshConnection, status]);

  return (
    <MentorConnectionContext.Provider value={value}>
      {children}
    </MentorConnectionContext.Provider>
  );
};

export const useMentorConnection = (): MentorConnectionContextValue => {
  const value = useContext(MentorConnectionContext);
  if (!value) {
    throw new Error("useMentorConnection must be used within MentorConnectionProvider");
  }

  return value;
};

export type { MentorConnectionStatus };
