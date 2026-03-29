import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSafeErrorResponse, logBypassAttempt, requireProtectedRequest } from "../_shared/abuseProtection.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const BUCKET = "quest-attachments";

function jsonSuccess(req: Request, body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

interface DeleteQuestAttachmentDeps {
  requireProtectedRequestFn: typeof requireProtectedRequest;
  logBypassAttemptFn: typeof logBypassAttempt;
}

const defaultDeps: DeleteQuestAttachmentDeps = {
  requireProtectedRequestFn: requireProtectedRequest,
  logBypassAttemptFn: logBypassAttempt,
};

export async function handleDeleteQuestAttachment(
  req: Request,
  deps: DeleteQuestAttachmentDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const protectedRequest = await deps.requireProtectedRequestFn(req, {
    profileKey: "upload.attachments",
    endpointName: "delete-quest-attachment",
    blockedMessage: "Too many attachment requests. Please try again later.",
    metadata: {
      flow: "quest_attachment_delete",
    },
  });

  if (protectedRequest instanceof Response) {
    return protectedRequest;
  }

  try {
    const payload = await req.json() as { filePath?: string };
    const filePath = typeof payload.filePath === "string" ? payload.filePath.trim() : "";

    if (!filePath) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_ATTACHMENT_PATH",
        error: "Invalid attachment path",
        requestId: protectedRequest.requestId,
      });
    }

    const expectedPrefix = `${protectedRequest.auth.userId}/`;
    if (!filePath.startsWith(expectedPrefix)) {
      return await deps.logBypassAttemptFn(protectedRequest.supabase, req, {
        endpointName: "delete-quest-attachment",
        requestId: protectedRequest.requestId,
        profileKey: "upload.attachments",
        actingUserId: protectedRequest.auth.userId,
        code: "attachment_path_mismatch",
        metadata: {
          filePath,
        },
      });
    }

    const { error } = await protectedRequest.supabase.storage
      .from(BUCKET)
      .remove([filePath]);

    if (error) {
      console.error("[delete-quest-attachment] Failed to delete attachment", error);
      return createSafeErrorResponse(req, {
        status: 500,
        code: "ATTACHMENT_DELETE_FAILED",
        error: "Attachment could not be removed right now",
        requestId: protectedRequest.requestId,
      });
    }

    return jsonSuccess(req, {
      success: true,
      requestId: protectedRequest.requestId,
    });
  } catch (error) {
    console.error("[delete-quest-attachment] Unexpected error", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "ATTACHMENT_DELETE_FAILED",
      error: "Attachment could not be removed right now",
      requestId: protectedRequest.requestId,
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleDeleteQuestAttachment(req));
}
