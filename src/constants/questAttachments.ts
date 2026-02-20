export const MAX_ATTACHMENTS_PER_TASK = 10;
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
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
] as const;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
] as const;

export const ATTACHMENT_INPUT_ACCEPT = "image/*,.pdf,.doc,.docx,.txt,.csv";
