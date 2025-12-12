import { getDocuments, timestampToISO } from "./firestore";

export interface BattleParticipant {
  id?: string;
  user_id: string;
  battle_match_id?: string;
  placement?: number;
  xp_earned?: number;
  created_at?: string;
  battle_matches?: {
    id: string;
    status?: string;
    completed_at?: string;
  };
}

export const getBattleHistory = async (
  userId: string,
  limitCount?: number
): Promise<BattleParticipant[]> => {
  const participants = await getDocuments<BattleParticipant>(
    "battle_participants",
    [["user_id", "==", userId]],
    "created_at",
    "desc",
    limitCount
  );

  // For each participant, fetch the battle match if battle_match_id exists
  const enrichedParticipants = await Promise.all(
    participants.map(async (participant) => {
      if (participant.battle_match_id) {
        const { getDocument } = await import("./firestore");
        const battleMatch = await getDocument<{ id: string; status?: string; completed_at?: string }>(
          "battle_matches",
          participant.battle_match_id
        );
        if (battleMatch) {
          participant.battle_matches = {
            ...battleMatch,
            completed_at: timestampToISO(battleMatch.completed_at as any) || battleMatch.completed_at || undefined,
          };
        }
      }
      return {
        ...participant,
        created_at: timestampToISO(participant.created_at as any) || participant.created_at || undefined,
      };
    })
  );

  return enrichedParticipants;
};

