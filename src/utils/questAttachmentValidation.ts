import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENTS_PER_TASK,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "@/constants/questAttachments";

interface ValidateAttachmentsResult {
  accepted: File[];
  errors: string[];
}

const IMAGE_MIME_PREFIX = "image/";

const getFileExtension = (name: string): string => {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex < 0) return "";
  return name.slice(dotIndex).toLowerCase();
};

export const isAllowedAttachmentType = (file: File): boolean => {
  const extension = getFileExtension(file.name);
  if (ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension as (typeof ALLOWED_ATTACHMENT_EXTENSIONS)[number])) {
    return true;
  }

  if (file.type?.startsWith(IMAGE_MIME_PREFIX)) {
    return true;
  }

  return ALLOWED_ATTACHMENT_MIME_TYPES.includes(
    file.type as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
  );
};

export const validateAttachmentFiles = (
  files: File[],
  currentCount = 0,
  maxCount = MAX_ATTACHMENTS_PER_TASK,
): ValidateAttachmentsResult => {
  const errors: string[] = [];
  const accepted: File[] = [];
  const remaining = Math.max(0, maxCount - currentCount);

  if (remaining === 0) {
    return {
      accepted: [],
      errors: [`You can attach up to ${MAX_ATTACHMENTS_PER_TASK} files.`],
    };
  }

  files.forEach((file) => {
    if (accepted.length >= remaining) return;

    if (!isAllowedAttachmentType(file)) {
      errors.push(`"${file.name}" is not a supported file type.`);
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      errors.push(`"${file.name}" exceeds the 10MB limit.`);
      return;
    }

    accepted.push(file);
  });

  if (files.length > remaining) {
    errors.push(`Only ${remaining} more file(s) can be attached (max ${MAX_ATTACHMENTS_PER_TASK}).`);
  }

  return { accepted, errors };
};

