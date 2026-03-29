import { supabase } from "@/integrations/supabase/client";

export const QUEST_ATTACHMENTS_BUCKET = "quest-attachments";
export const QUEST_ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function createQuestAttachmentSignedUrl(
  filePath: string,
  expiresIn = QUEST_ATTACHMENT_SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  if (!filePath) return null;

  const { data, error } = await supabase.storage
    .from(QUEST_ATTACHMENTS_BUCKET)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    console.error("Failed to create signed quest attachment URL:", error);
    return null;
  }

  return data?.signedUrl ?? null;
}

export async function createQuestAttachmentSignedUrlMap(
  filePaths: string[],
  expiresIn = QUEST_ATTACHMENT_SIGNED_URL_TTL_SECONDS,
): Promise<Map<string, string>> {
  const uniquePaths = Array.from(new Set(filePaths.filter((value) => typeof value === "string" && value.trim().length > 0)));
  const signedUrlMap = new Map<string, string>();

  if (uniquePaths.length === 0) {
    return signedUrlMap;
  }

  const results = await Promise.all(
    uniquePaths.map(async (filePath) => {
      const signedUrl = await createQuestAttachmentSignedUrl(filePath, expiresIn);
      return { filePath, signedUrl };
    }),
  );

  results.forEach(({ filePath, signedUrl }) => {
    if (signedUrl) {
      signedUrlMap.set(filePath, signedUrl);
    }
  });

  return signedUrlMap;
}

export function extractQuestAttachmentFilePath(value: string): string | null {
  if (!value) return null;

  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return value;
  }

  try {
    const url = new URL(value);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const bucketIndex = pathParts.findIndex((part) => part === QUEST_ATTACHMENTS_BUCKET);
    if (bucketIndex === -1) {
      return null;
    }

    return decodeURIComponent(pathParts.slice(bucketIndex + 1).join("/"));
  } catch {
    return null;
  }
}
