type MentorChatLocationState = Record<string, unknown>;

const asStateRecord = (state: unknown): MentorChatLocationState => {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return {};
  }

  return { ...(state as MentorChatLocationState) };
};

export const getConsultMentorIdFromState = (state: unknown): string | null => {
  const consultMentorId = asStateRecord(state).consultMentorId;
  if (typeof consultMentorId !== "string") {
    return null;
  }

  const normalized = consultMentorId.trim();
  return normalized.length > 0 ? normalized : null;
};

export const withConsultMentorState = (
  state: unknown,
  consultMentorId: string | null,
  consultSource?: string | null,
): MentorChatLocationState => {
  const nextState = asStateRecord(state);

  if (consultMentorId) {
    nextState.consultMentorId = consultMentorId;
  } else {
    delete nextState.consultMentorId;
  }

  if (consultMentorId && consultSource) {
    nextState.consultSource = consultSource;
  } else {
    delete nextState.consultSource;
  }

  return nextState;
};
