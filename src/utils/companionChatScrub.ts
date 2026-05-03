import { forgetDeletedPlannerEntities } from "@/utils/deletedPlannerMemory";

export async function scrubCompanionChatsForDeletedEpic(
  userId: string,
  epicTitle: string | null | undefined,
  epicCreatedAt: string | null | undefined,
): Promise<void> {
  const trimmedTitle = epicTitle?.trim();
  if (!trimmedTitle) return;

  await forgetDeletedPlannerEntities({
    userId,
    source: "legacy_epic_chat_scrub",
    entities: [{
      entityType: "campaign",
      title: trimmedTitle,
      metadata: {
        createdAt: epicCreatedAt ?? null,
      },
    }],
  });
}
