// Edge function for account deletion - v3.0
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface CleanupWarning {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

type SupabaseAdminClient = ReturnType<typeof createClient>;

const STORAGE_PATH_REGEX = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/i;
const STORAGE_REMOVE_BATCH_SIZE = 100;
const STORAGE_LIST_PAGE_SIZE = 100;

const PREFIX_SWEEPS: Array<{ bucket: string; prefix: (userId: string) => string }> = [
  { bucket: "quest-attachments", prefix: (userId) => userId },
  { bucket: "mentors-avatars", prefix: (userId) => userId },
  { bucket: "evolution-cards", prefix: (userId) => `postcards/${userId}` },
];

/**
 * Sanitize error messages for client responses
 * Logs full error server-side, returns generic message to client
 */
function sanitizeError(error: unknown): { message: string; status: number } {
  // Log full error details server-side for debugging
  console.error("Full error details:", error);

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // Authorization errors - safe to indicate
    if (msg.includes("unauthorized") || msg.includes("invalid token") || msg.includes("jwt")) {
      return { message: "Unauthorized", status: 401 };
    }

    // Permission errors
    if (msg.includes("permission denied") || msg.includes("access denied")) {
      return { message: "Access denied", status: 403 };
    }

    // Not found
    if (msg.includes("not found") || msg.includes("no rows")) {
      return { message: "User not found", status: 404 };
    }
  }

  // Generic error for everything else - don't leak internal details
  return { message: "An error occurred during account deletion. Please try again.", status: 500 };
}

const pushCleanupWarning = (
  warnings: CleanupWarning[],
  code: string,
  message: string,
  details?: Record<string, unknown>,
): void => {
  const warning: CleanupWarning = {
    code,
    message,
    ...(details ? { details } : {}),
  };

  warnings.push(warning);
  console.warn("[delete-user] storage cleanup warning", JSON.stringify(warning));
};

const normalizeStoragePath = (value: string): string => {
  return decodeURIComponent(value).replace(/^\/+/, "").trim();
};

const parseStorageUrl = (value: string): { bucket: string; path: string } | null => {
  try {
    const parsed = new URL(value);
    const match = parsed.pathname.match(STORAGE_PATH_REGEX);
    if (!match) return null;

    const [, bucket, path] = match;
    const normalizedBucket = decodeURIComponent(bucket).trim();
    const normalizedPath = normalizeStoragePath(path);

    if (!normalizedBucket || !normalizedPath) {
      return null;
    }

    return {
      bucket: normalizedBucket,
      path: normalizedPath,
    };
  } catch {
    return null;
  }
};

const addStorageTarget = (
  targets: Map<string, Set<string>>,
  bucket: string,
  path: string,
): void => {
  const normalizedBucket = bucket.trim();
  const normalizedPath = normalizeStoragePath(path);
  if (!normalizedBucket || !normalizedPath) return;

  const bucketTargets = targets.get(normalizedBucket) ?? new Set<string>();
  bucketTargets.add(normalizedPath);
  targets.set(normalizedBucket, bucketTargets);
};

const collectFromValue = (
  targets: Map<string, Set<string>>,
  value: unknown,
  source: string,
  warnings: CleanupWarning[],
  defaultBucket?: string,
): void => {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (!trimmed) return;

  const parsed = parseStorageUrl(trimmed);
  if (parsed) {
    addStorageTarget(targets, parsed.bucket, parsed.path);
    return;
  }

  if (!defaultBucket) return;

  if (trimmed.includes("://")) {
    pushCleanupWarning(warnings, "storage_url_unparsed", "Unable to parse storage URL", {
      source,
      value: trimmed,
    });
    return;
  }

  addStorageTarget(targets, defaultBucket, trimmed);
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const listFilesUnderPrefix = async (
  supabase: SupabaseAdminClient,
  bucket: string,
  prefix: string,
  warnings: CleanupWarning[],
): Promise<string[]> => {
  const normalizedPrefix = normalizeStoragePath(prefix).replace(/\/$/, "");
  if (!normalizedPrefix) return [];

  const pendingFolders = [normalizedPrefix];
  const discoveredFiles = new Set<string>();

  while (pendingFolders.length > 0) {
    const folder = pendingFolders.shift();
    if (!folder) continue;

    let offset = 0;

    while (true) {
      const { data, error } = await supabase.storage.from(bucket).list(folder, {
        limit: STORAGE_LIST_PAGE_SIZE,
        offset,
      });

      if (error) {
        pushCleanupWarning(warnings, "storage_prefix_list_failed", "Failed listing storage prefix", {
          bucket,
          prefix: folder,
          error: error.message,
        });
        break;
      }

      if (!data || data.length === 0) {
        break;
      }

      for (const item of data) {
        if (!item?.name) continue;

        const candidatePath = `${folder}/${item.name}`;
        const isFolder = !item.id;

        if (isFolder) {
          pendingFolders.push(candidatePath);
        } else {
          discoveredFiles.add(candidatePath);
        }
      }

      if (data.length < STORAGE_LIST_PAGE_SIZE) {
        break;
      }

      offset += STORAGE_LIST_PAGE_SIZE;
    }
  }

  return [...discoveredFiles];
};

const collectUserStorageTargets = async (
  supabase: SupabaseAdminClient,
  userId: string,
  warnings: CleanupWarning[],
): Promise<Map<string, Set<string>>> => {
  const targets = new Map<string, Set<string>>();

  const { data: taskAttachments, error: taskAttachmentError } = await supabase
    .from("task_attachments")
    .select("file_path, file_url")
    .eq("user_id", userId);

  if (taskAttachmentError) {
    pushCleanupWarning(warnings, "storage_collect_task_attachments_failed", "Unable to collect task attachments", {
      error: taskAttachmentError.message,
    });
  } else {
    for (const row of taskAttachments ?? []) {
      collectFromValue(targets, row.file_path, "task_attachments.file_path", warnings, "quest-attachments");
      collectFromValue(targets, row.file_url, "task_attachments.file_url", warnings);
    }
  }

  const { data: dailyTasks, error: dailyTasksError } = await supabase
    .from("daily_tasks")
    .select("image_url")
    .eq("user_id", userId)
    .not("image_url", "is", null);

  if (dailyTasksError) {
    pushCleanupWarning(warnings, "storage_collect_daily_tasks_failed", "Unable to collect task images", {
      error: dailyTasksError.message,
    });
  } else {
    for (const row of dailyTasks ?? []) {
      collectFromValue(targets, row.image_url, "daily_tasks.image_url", warnings, "quest-attachments");
    }
  }

  const { data: companions, error: companionsError } = await supabase
    .from("user_companion")
    .select("id, current_image_url, initial_image_url, dormant_image_url, scarred_image_url, neglected_image_url")
    .eq("user_id", userId);

  const companionIds: string[] = [];

  if (companionsError) {
    pushCleanupWarning(warnings, "storage_collect_companion_failed", "Unable to collect companion images", {
      error: companionsError.message,
    });
  } else {
    for (const companion of companions ?? []) {
      companionIds.push(companion.id);
      collectFromValue(targets, companion.current_image_url, "user_companion.current_image_url", warnings, "mentors-avatars");
      collectFromValue(targets, companion.initial_image_url, "user_companion.initial_image_url", warnings, "mentors-avatars");
      collectFromValue(targets, companion.dormant_image_url, "user_companion.dormant_image_url", warnings, "mentors-avatars");
      collectFromValue(targets, companion.scarred_image_url, "user_companion.scarred_image_url", warnings, "mentors-avatars");
      collectFromValue(targets, companion.neglected_image_url, "user_companion.neglected_image_url", warnings, "mentors-avatars");
    }
  }

  const { data: postcards, error: postcardsError } = await supabase
    .from("companion_postcards")
    .select("image_url")
    .eq("user_id", userId);

  if (postcardsError) {
    pushCleanupWarning(warnings, "storage_collect_postcards_failed", "Unable to collect postcard images", {
      error: postcardsError.message,
    });
  } else {
    for (const postcard of postcards ?? []) {
      collectFromValue(targets, postcard.image_url, "companion_postcards.image_url", warnings, "evolution-cards");
    }
  }

  const { data: memorials, error: memorialsError } = await supabase
    .from("companion_memorials")
    .select("final_image_url, memorial_image_url")
    .eq("user_id", userId);

  if (memorialsError) {
    pushCleanupWarning(warnings, "storage_collect_memorials_failed", "Unable to collect memorial images", {
      error: memorialsError.message,
    });
  } else {
    for (const memorial of memorials ?? []) {
      collectFromValue(targets, memorial.final_image_url, "companion_memorials.final_image_url", warnings);
      collectFromValue(targets, memorial.memorial_image_url, "companion_memorials.memorial_image_url", warnings);
    }
  }

  const { data: journeyPaths, error: journeyPathsError } = await supabase
    .from("epic_journey_paths")
    .select("image_url")
    .eq("user_id", userId);

  if (journeyPathsError) {
    pushCleanupWarning(warnings, "storage_collect_journey_paths_failed", "Unable to collect journey path images", {
      error: journeyPathsError.message,
    });
  } else {
    for (const row of journeyPaths ?? []) {
      collectFromValue(targets, row.image_url, "epic_journey_paths.image_url", warnings, "journey-paths");
    }
  }

  const { data: evolutionJobs, error: evolutionJobsError } = await supabase
    .from("companion_evolution_jobs")
    .select("result_image_url")
    .eq("user_id", userId)
    .not("result_image_url", "is", null);

  if (evolutionJobsError) {
    pushCleanupWarning(
      warnings,
      "storage_collect_evolution_jobs_failed",
      "Unable to collect companion evolution job images",
      {
        error: evolutionJobsError.message,
      },
    );
  } else {
    for (const row of evolutionJobs ?? []) {
      collectFromValue(targets, row.result_image_url, "companion_evolution_jobs.result_image_url", warnings, "evolution-cards");
    }
  }

  const { data: welcomeImages, error: welcomeImagesError } = await supabase
    .from("user_welcome_images")
    .select("image_url")
    .eq("user_id", userId);

  if (welcomeImagesError) {
    pushCleanupWarning(warnings, "storage_collect_welcome_images_failed", "Unable to collect welcome images", {
      error: welcomeImagesError.message,
    });
  } else {
    for (const row of welcomeImages ?? []) {
      collectFromValue(targets, row.image_url, "user_welcome_images.image_url", warnings, "journey-paths");
    }
  }

  if (companionIds.length > 0) {
    const { data: evolutionCards, error: evolutionCardsError } = await supabase
      .from("companion_evolution_cards")
      .select("image_url, companion_id")
      .in("companion_id", companionIds);

    if (evolutionCardsError) {
      pushCleanupWarning(
        warnings,
        "storage_collect_evolution_cards_failed",
        "Unable to collect companion evolution card images",
        {
          error: evolutionCardsError.message,
        },
      );
    } else {
      for (const row of evolutionCards ?? []) {
        collectFromValue(targets, row.image_url, "companion_evolution_cards.image_url", warnings, "evolution-cards");
      }
    }

    const { data: evolutions, error: evolutionsError } = await supabase
      .from("companion_evolutions")
      .select("image_url, companion_id")
      .in("companion_id", companionIds);

    if (evolutionsError) {
      pushCleanupWarning(
        warnings,
        "storage_collect_evolutions_failed",
        "Unable to collect companion evolution images",
        {
          error: evolutionsError.message,
        },
      );
    } else {
      for (const row of evolutions ?? []) {
        collectFromValue(targets, row.image_url, "companion_evolutions.image_url", warnings, "evolution-cards");
      }
    }
  }

  return targets;
};

const runStorageCleanup = async (
  supabase: SupabaseAdminClient,
  userId: string,
  existingTargets: Map<string, Set<string>>,
  warnings: CleanupWarning[],
): Promise<void> => {
  for (const sweep of PREFIX_SWEEPS) {
    const files = await listFilesUnderPrefix(supabase, sweep.bucket, sweep.prefix(userId), warnings);
    for (const file of files) {
      addStorageTarget(existingTargets, sweep.bucket, file);
    }
  }

  for (const [bucket, pathSet] of existingTargets.entries()) {
    const paths = [...pathSet];
    if (paths.length === 0) continue;

    const batches = chunkArray(paths, STORAGE_REMOVE_BATCH_SIZE);

    for (const batch of batches) {
      const { error } = await supabase.storage.from(bucket).remove(batch);
      if (error) {
        pushCleanupWarning(warnings, "storage_remove_failed", "Failed removing storage objects", {
          bucket,
          pathCount: batch.length,
          error: error.message,
        });
      }
    }
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase environment variables");
      throw new Error("Server configuration error");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser(token);
    if (userError) {
      throw userError;
    }

    const user = userResult?.user;
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const cleanupWarnings: CleanupWarning[] = [];

    const storageTargets = await collectUserStorageTargets(supabase, userId, cleanupWarnings);

    const { error: deleteDataError } = await supabase.rpc("delete_user_account", { p_user_id: userId });
    if (deleteDataError) {
      throw deleteDataError;
    }

    await runStorageCleanup(supabase, userId, storageTargets, cleanupWarnings);

    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      throw authDeleteError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...(cleanupWarnings.length > 0 ? { warnings: cleanupWarnings } : {}),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("delete-user edge function error", error);
    const { message, status } = sanitizeError(error);

    return new Response(JSON.stringify({ success: false, error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
