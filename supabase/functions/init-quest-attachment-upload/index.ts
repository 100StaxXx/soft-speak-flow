import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireProtectedRequest, createSafeErrorResponse } from "../_shared/abuseProtection.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const BUCKET = "quest-attachments";
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".csv",
]);
const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
]);

function jsonSuccess(req: Request, body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

function getFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex < 0) return "";
  return fileName.slice(lastDotIndex).toLowerCase();
}

function sanitizeBaseName(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");
  const baseName = lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName;
  return baseName
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "attachment";
}

interface InitQuestAttachmentUploadDeps {
  requireProtectedRequestFn: typeof requireProtectedRequest;
}

const defaultDeps: InitQuestAttachmentUploadDeps = {
  requireProtectedRequestFn: requireProtectedRequest,
};

export async function handleInitQuestAttachmentUpload(
  req: Request,
  deps: InitQuestAttachmentUploadDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const protectedRequest = await deps.requireProtectedRequestFn(req, {
    profileKey: "upload.attachments",
    endpointName: "init-quest-attachment-upload",
    blockedMessage: "Too many upload attempts. Please try again later.",
    metadata: {
      flow: "quest_attachment_upload_init",
    },
  });

  if (protectedRequest instanceof Response) {
    return protectedRequest;
  }

  try {
    const payload = await req.json() as {
      fileName?: string;
      mimeType?: string;
      fileSizeBytes?: number;
    };

    const fileName = typeof payload.fileName === "string" ? payload.fileName.trim() : "";
    const mimeType = typeof payload.mimeType === "string" ? payload.mimeType.trim() : "application/octet-stream";
    const fileSizeBytes = typeof payload.fileSizeBytes === "number" ? payload.fileSizeBytes : 0;

    if (!fileName || fileSizeBytes <= 0) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_UPLOAD_REQUEST",
        error: "Invalid upload request",
        requestId: protectedRequest.requestId,
      });
    }

    if (fileSizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "ATTACHMENT_TOO_LARGE",
        error: "Attachment exceeds the 10 MB limit",
        requestId: protectedRequest.requestId,
      });
    }

    const extension = getFileExtension(fileName);
    const isAllowedExtension = ALLOWED_EXTENSIONS.has(extension);
    const isAllowedMimeType = mimeType.startsWith("image/") || DOCUMENT_MIME_TYPES.has(mimeType);
    if (!isAllowedExtension || !isAllowedMimeType) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "UNSUPPORTED_ATTACHMENT_TYPE",
        error: "That attachment type is not supported",
        requestId: protectedRequest.requestId,
      });
    }

    const safeBaseName = sanitizeBaseName(fileName);
    const objectPath = `${protectedRequest.auth.userId}/${Date.now()}_${crypto.randomUUID()}_${safeBaseName}${extension}`;

    const { data, error } = await protectedRequest.supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(objectPath, { upsert: false });

    if (error || !data?.token) {
      console.error("[init-quest-attachment-upload] Failed to create signed upload URL", error);
      return createSafeErrorResponse(req, {
        status: 500,
        code: "UPLOAD_INIT_FAILED",
        error: "Upload could not be prepared right now",
        requestId: protectedRequest.requestId,
      });
    }

    return jsonSuccess(req, {
      path: objectPath,
      token: data.token,
      contentType: mimeType || "application/octet-stream",
      requestId: protectedRequest.requestId,
    });
  } catch (error) {
    console.error("[init-quest-attachment-upload] Unexpected error", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "UPLOAD_INIT_FAILED",
      error: "Upload could not be prepared right now",
      requestId: protectedRequest.requestId,
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleInitQuestAttachmentUpload(req));
}
