import { getDocuments } from "@/lib/firebase/firestore";

interface GuildBonusResult {
  bonusXP: number;
  toastReason: string;
}

/**
 * Calculate guild bonus XP for task completion
 * Returns 10% bonus if user is member of an active public epic
 */
export const calculateGuildBonus = async (
  userId: string | undefined, 
  baseXP: number
): Promise<GuildBonusResult> => {
  if (!userId) {
    return { bonusXP: 0, toastReason: 'Task Complete!' };
  }

  try {
    // Get all active public epics
    const activePublicEpics = await getDocuments(
      "epics",
      [
        ["status", "==", "active"],
        ["is_public", "==", true],
      ]
    );

    if (!activePublicEpics || activePublicEpics.length === 0) {
      return { bonusXP: 0, toastReason: 'Task Complete!' };
    }

    const epicIds = activePublicEpics.map((epic: any) => epic.id);

    // Get epic habits for these epics (batch queries if more than 10)
    let epicHabits: any[] = [];
    if (epicIds.length <= 10) {
      epicHabits = await getDocuments(
        "epic_habits",
        [["epic_id", "in", epicIds]]
      );
    } else {
      // Batch queries for more than 10 epics
      const batches = [];
      for (let i = 0; i < epicIds.length; i += 10) {
        const batch = epicIds.slice(i, i + 10);
        batches.push(getDocuments("epic_habits", [["epic_id", "in", batch]]));
      }
      const results = await Promise.all(batches);
      epicHabits = results.flat();
    }

    if (!epicHabits || epicHabits.length === 0) {
      return { bonusXP: 0, toastReason: 'Task Complete!' };
    }

    const habitEpicIds = [...new Set(epicHabits.map((eh: any) => eh.epic_id))];

    // Check if user is a member of any of these epics (batch queries if more than 10)
    let memberships: any[] = [];
    if (habitEpicIds.length <= 10) {
      memberships = await getDocuments(
        "epic_members",
        [
          ["user_id", "==", userId],
          ["epic_id", "in", habitEpicIds],
        ]
      );
    } else {
      // Batch queries for more than 10 epics
      const batches = [];
      for (let i = 0; i < habitEpicIds.length; i += 10) {
        const batch = habitEpicIds.slice(i, i + 10);
        batches.push(
          getDocuments("epic_members", [
            ["user_id", "==", userId],
            ["epic_id", "in", batch],
          ])
        );
      }
      const results = await Promise.all(batches);
      memberships = results.flat();
    }

    if (memberships && memberships.length > 0) {
      const rawBonus = Math.round(baseXP * 0.1);
      const bonusXP = baseXP > 0 ? Math.max(1, rawBonus) : 0;
      return { bonusXP, toastReason: `Task Complete! +${bonusXP} Guild Bonus (10%) 🎯` };
    }
  } catch (error) {
    console.error('Unexpected error computing guild bonus:', error);
  }

  return { bonusXP: 0, toastReason: 'Task Complete!' };
};
