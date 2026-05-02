import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PickedFile } from '@capawesome/capacitor-file-picker';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from "@/components/ui/sonner";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  ATTACHMENT_INPUT_ACCEPT,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_TASK,
  NATIVE_ATTACHMENT_FILE_PICKER_TYPES,
} from '@/constants/questAttachments';
import { validateAttachmentFiles } from '@/utils/questAttachmentValidation';
import type { QuestAttachmentInput } from '@/types/questAttachments';
import { createQuestAttachmentSignedUrl, extractQuestAttachmentFilePath } from '@/utils/questAttachmentUrls';

interface AttachmentPickerOptions {
  currentCount?: number;
  maxCount?: number;
}

interface UseQuestImagePickerReturn {
  pickImage: () => Promise<string | null>;
  pickAttachments: (options?: AttachmentPickerOptions) => Promise<QuestAttachmentInput[]>;
  pickPhotoAttachments: (options?: AttachmentPickerOptions) => Promise<QuestAttachmentInput[]>;
  pickFileAttachments: (options?: AttachmentPickerOptions) => Promise<QuestAttachmentInput[]>;
  uploadImage: (file: File | Blob, fileName?: string) => Promise<string | null>;
  uploadAttachment: (file: File | Blob, fileName?: string) => Promise<QuestAttachmentInput | null>;
  deleteImage: (imageUrl: string) => Promise<boolean>;
  deleteAttachment: (attachment: Pick<QuestAttachmentInput, 'filePath'> | string) => Promise<boolean>;
  isNativeAttachmentPicker: boolean;
  isUploading: boolean;
  error: string | null;
}

interface NativeAttachmentCandidate {
  pickedFile: PickedFile;
  name: string;
  type: string;
  size: number;
}

const FALLBACK_MIME_TYPE = 'application/octet-stream';

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'text/csv': '.csv',
  'text/plain': '.txt',
};

const ALLOWED_NATIVE_ATTACHMENT_EXTENSIONS = new Set<string>(ALLOWED_ATTACHMENT_EXTENSIONS);

const getFileExtension = (fileName: string): string => {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex < 0) return '';
  return fileName.slice(dotIndex).toLowerCase();
};

const normalizeNativePickedFileName = (
  fileName: string | undefined,
  mimeType: string,
  fallbackName: string,
): string => {
  const trimmedName = typeof fileName === 'string' && fileName.trim().length > 0
    ? fileName.trim()
    : fallbackName;
  const fallbackExtension = EXTENSION_BY_MIME_TYPE[mimeType.toLowerCase()];
  const existingExtension = getFileExtension(trimmedName);

  if (!fallbackExtension || existingExtension === fallbackExtension) {
    return trimmedName;
  }

  if (!existingExtension) {
    return `${trimmedName}${fallbackExtension}`;
  }

  if (mimeType.toLowerCase().startsWith('image/')) {
    return `${trimmedName.slice(0, -existingExtension.length)}${fallbackExtension}`;
  }

  if (!ALLOWED_NATIVE_ATTACHMENT_EXTENSIONS.has(existingExtension)) {
    return `${trimmedName.slice(0, -existingExtension.length)}${fallbackExtension}`;
  }

  return trimmedName;
};

const getNativePickedFileSourcePath = (pickedFile: PickedFile): string | null => {
  if (typeof pickedFile.path === 'string' && pickedFile.path.length > 0) {
    return pickedFile.path;
  }

  return null;
};

const readNativePickedFileAsBlob = async (
  pickedFile: PickedFile,
  mimeType: string,
): Promise<Blob> => {
  if (pickedFile.blob) {
    return pickedFile.blob.type === mimeType
      ? pickedFile.blob
      : new Blob([pickedFile.blob], { type: mimeType });
  }

  if (typeof pickedFile.data === 'string' && pickedFile.data.length > 0) {
    const byteCharacters = atob(pickedFile.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  }

  const sourcePath = getNativePickedFileSourcePath(pickedFile);
  if (!sourcePath) {
    throw new Error('Selected attachment could not be read');
  }

  const response = await fetch(Capacitor.convertFileSrc(sourcePath));
  if (!response.ok) {
    throw new Error('Selected attachment could not be read');
  }

  const blob = await response.blob();
  return blob.type === mimeType
    ? blob
    : new Blob([blob], { type: mimeType });
};

export function useQuestImagePicker(): UseQuestImagePickerReturn {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNativeAttachmentPicker = Capacitor.isNativePlatform();

  const getErrorMessage = useCallback((err: unknown): string => {
    if (err instanceof Error) {
      return err.message;
    }

    if (err && typeof err === 'object' && 'message' in err) {
      const message = (err as { message?: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
    }

    return String(err ?? '');
  }, []);

  const isUserCancellationError = useCallback((err: unknown): boolean => {
    const normalized = getErrorMessage(err).toLowerCase();
    return normalized.includes('cancelled') || normalized.includes('canceled');
  }, [getErrorMessage]);

  const isUnsupportedNativePickerError = useCallback((err: unknown): boolean => {
    const normalized = getErrorMessage(err).toLowerCase();
    return (
      normalized.includes('unsupported device') ||
      normalized.includes('not supported') ||
      normalized.includes('visionkit') ||
      normalized.includes('removebackground') ||
      normalized.includes('remove background') ||
      normalized.includes('code=-8')
    );
  }, [getErrorMessage]);

  const getInvokeErrorMessage = useCallback(async (err: unknown, fallback: string): Promise<string> => {
    const maybeErrorWithContext = err as { context?: { json?: () => Promise<Record<string, unknown>> } };
    if (maybeErrorWithContext.context?.json) {
      try {
        const body = await maybeErrorWithContext.context.json();
        if (typeof body?.error === 'string' && body.error.trim()) {
          return body.error;
        }
      } catch {
        // Fall through to the generic fallback.
      }
    }

    return getErrorMessage(err) || fallback;
  }, [getErrorMessage]);

  const uploadAttachment = useCallback(async (file: File | Blob, fileName?: string): Promise<QuestAttachmentInput | null> => {
    if (!user?.id) {
      setError('User not authenticated');
      return null;
    }

    setIsUploading(true);
    setError(null);

    try {
      const resolvedFileName = fileName || `attachment-${Date.now()}`;
      const { data: uploadInit, error: initError } = await supabase.functions.invoke('init-quest-attachment-upload', {
        body: {
          fileName: resolvedFileName,
          mimeType: file.type || 'application/octet-stream',
          fileSizeBytes: typeof file.size === 'number' ? file.size : 0,
        },
      });

      if (initError) {
        throw new Error(await getInvokeErrorMessage(initError, 'Failed to prepare attachment upload'));
      }

      const path = typeof uploadInit?.path === 'string' ? uploadInit.path : null;
      const token = typeof uploadInit?.token === 'string' ? uploadInit.token : null;

      if (!path || !token) {
        throw new Error('Failed to prepare attachment upload');
      }

      const { error: uploadError } = await supabase.storage
        .from('quest-attachments')
        .uploadToSignedUrl(path, token, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const signedUrl = await createQuestAttachmentSignedUrl(path);
      if (!signedUrl) {
        throw new Error('Failed to create secure attachment URL');
      }

      return {
        fileUrl: signedUrl,
        filePath: path,
        fileName: resolvedFileName,
        mimeType: file.type || 'application/octet-stream',
        fileSizeBytes: typeof file.size === 'number' ? file.size : 0,
        isImage: !!file.type?.startsWith('image/'),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload attachment';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [getInvokeErrorMessage, user?.id]);

  const uploadImage = useCallback(async (file: File | Blob, fileName?: string): Promise<string | null> => {
    const attachment = await uploadAttachment(file, fileName);
    if (!attachment || !attachment.isImage) {
      return attachment?.fileUrl ?? null;
    }
    return attachment.fileUrl;
  }, [uploadAttachment]);

  const uploadNativePickedFiles = useCallback(async (
    pickedFiles: PickedFile[],
    options?: AttachmentPickerOptions,
  ): Promise<QuestAttachmentInput[]> => {
    if (pickedFiles.length === 0) {
      return [];
    }

    const currentCount = options?.currentCount ?? 0;
    const maxCount = options?.maxCount ?? MAX_ATTACHMENTS_PER_TASK;

    const candidates: NativeAttachmentCandidate[] = pickedFiles.map((pickedFile, index) => {
      const mimeType = pickedFile.mimeType || FALLBACK_MIME_TYPE;
      const fallbackName = `attachment-${Date.now()}-${index + 1}`;

      return {
        pickedFile,
        name: normalizeNativePickedFileName(pickedFile.name, mimeType, fallbackName),
        type: mimeType,
        size: typeof pickedFile.size === 'number' ? pickedFile.size : 0,
      };
    });

    const { accepted, errors } = validateAttachmentFiles(candidates, currentCount, maxCount);
    errors.forEach((message) => toast.error(message));

    if (accepted.length === 0) {
      return [];
    }

    const uploaded: QuestAttachmentInput[] = [];
    for (const candidate of accepted) {
      try {
        const blob = await readNativePickedFileAsBlob(candidate.pickedFile, candidate.type);
        const resolvedMimeType = candidate.type === FALLBACK_MIME_TYPE && blob.type
          ? blob.type
          : candidate.type;
        const resolvedFileName = normalizeNativePickedFileName(
          candidate.name,
          resolvedMimeType,
          candidate.name,
        );

        if (blob.size > MAX_ATTACHMENT_SIZE_BYTES) {
          toast.error(`"${resolvedFileName}" exceeds the 10MB limit.`);
          continue;
        }

        const uploadBlob = blob.type === resolvedMimeType
          ? blob
          : new Blob([blob], { type: resolvedMimeType });
        const result = await uploadAttachment(uploadBlob, resolvedFileName);
        if (result) uploaded.push(result);
      } catch (err) {
        const message = getErrorMessage(err) || 'Failed to upload attachment';
        setError(message);
        toast.error(message);
      }
    }

    return uploaded;
  }, [getErrorMessage, uploadAttachment]);

  const pickImageWithFileInput = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment'; // Prefer camera on mobile web

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const url = await uploadImage(file, file.name);
        resolve(url);
      };

      input.oncancel = () => resolve(null);
      input.click();
    });
  }, [uploadImage]);

  const pickImage = useCallback(async (): Promise<string | null> => {
    if (!user?.id) {
      setError('User not authenticated');
      return null;
    }

    setError(null);

    try {
      // Check if we're on a native platform
      if (Capacitor.isNativePlatform()) {
        // Dynamic import - only loaded when needed on native
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

        try {
          // Use Capacitor Camera for native
          const photo = await Camera.getPhoto({
            quality: 80,
            allowEditing: false,
            resultType: CameraResultType.Base64,
            source: CameraSource.Prompt, // Let user choose camera or gallery
            width: 1200,
            height: 1200,
          });

          if (!photo.base64String) {
            return null;
          }

          // Convert base64 to blob
          const byteCharacters = atob(photo.base64String);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: `image/${photo.format || 'jpeg'}` });

          return await uploadImage(blob, `photo.${photo.format || 'jpg'}`);
        } catch (nativeError) {
          if (isUserCancellationError(nativeError)) {
            return null;
          }

          // Some iOS devices throw unsupported picker errors (VisionKit fallback path).
          if (isUnsupportedNativePickerError(nativeError)) {
            console.info('Native image picker unsupported on this device, falling back to file input', nativeError);
            return await pickImageWithFileInput();
          }

          throw nativeError;
        }
      } else {
        return await pickImageWithFileInput();
      }
    } catch (err) {
      // Handle user cancellation gracefully
      if (isUserCancellationError(err)) {
        return null;
      }
      const message = getErrorMessage(err) || 'Failed to pick image';
      setError(message);
      toast.error(message);
      return null;
    }
  }, [
    user?.id,
    uploadImage,
    getErrorMessage,
    isUserCancellationError,
    isUnsupportedNativePickerError,
    pickImageWithFileInput,
  ]);

  const pickAttachments = useCallback(async (
    options?: AttachmentPickerOptions,
  ): Promise<QuestAttachmentInput[]> => {
    if (!user?.id) {
      setError('User not authenticated');
      return [];
    }

    const currentCount = options?.currentCount ?? 0;
    const maxCount = options?.maxCount ?? MAX_ATTACHMENTS_PER_TASK;

    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = ATTACHMENT_INPUT_ACCEPT;
      input.multiple = true;

      input.onchange = async (event) => {
        const selectedFiles = Array.from((event.target as HTMLInputElement).files ?? []);
        if (selectedFiles.length === 0) {
          resolve([]);
          return;
        }

        const { accepted, errors } = validateAttachmentFiles(selectedFiles, currentCount, maxCount);
        errors.forEach((message) => toast.error(message));

        if (accepted.length === 0) {
          resolve([]);
          return;
        }

        const uploaded: QuestAttachmentInput[] = [];
        for (const file of accepted) {
          const result = await uploadAttachment(file, file.name);
          if (result) uploaded.push(result);
        }
        resolve(uploaded);
      };

      input.oncancel = () => resolve([]);
      input.click();
    });
  }, [uploadAttachment, user?.id]);

  const pickPhotoAttachments = useCallback(async (
    options?: AttachmentPickerOptions,
  ): Promise<QuestAttachmentInput[]> => {
    if (!user?.id) {
      setError('User not authenticated');
      return [];
    }

    if (!isNativeAttachmentPicker) {
      return pickAttachments(options);
    }

    setError(null);

    const currentCount = options?.currentCount ?? 0;
    const maxCount = options?.maxCount ?? MAX_ATTACHMENTS_PER_TASK;
    const remaining = Math.max(0, maxCount - currentCount);
    if (remaining === 0) {
      toast.error(`You can attach up to ${MAX_ATTACHMENTS_PER_TASK} files.`);
      return [];
    }

    try {
      const { FilePicker } = await import('@capawesome/capacitor-file-picker');
      const result = await FilePicker.pickImages({
        limit: remaining,
        ordered: true,
        readData: false,
        skipTranscoding: false,
      });

      return await uploadNativePickedFiles(result.files ?? [], options);
    } catch (err) {
      if (isUserCancellationError(err)) {
        return [];
      }

      const message = getErrorMessage(err) || 'Failed to pick photos';
      setError(message);
      toast.error(message);
      return [];
    }
  }, [
    getErrorMessage,
    isNativeAttachmentPicker,
    isUserCancellationError,
    pickAttachments,
    uploadNativePickedFiles,
    user?.id,
  ]);

  const pickFileAttachments = useCallback(async (
    options?: AttachmentPickerOptions,
  ): Promise<QuestAttachmentInput[]> => {
    if (!user?.id) {
      setError('User not authenticated');
      return [];
    }

    if (!isNativeAttachmentPicker) {
      return pickAttachments(options);
    }

    setError(null);

    const currentCount = options?.currentCount ?? 0;
    const maxCount = options?.maxCount ?? MAX_ATTACHMENTS_PER_TASK;
    const remaining = Math.max(0, maxCount - currentCount);
    if (remaining === 0) {
      toast.error(`You can attach up to ${MAX_ATTACHMENTS_PER_TASK} files.`);
      return [];
    }

    try {
      const { FilePicker } = await import('@capawesome/capacitor-file-picker');
      const result = await FilePicker.pickFiles({
        types: [...NATIVE_ATTACHMENT_FILE_PICKER_TYPES],
        limit: 1,
        readData: false,
      });

      return await uploadNativePickedFiles(result.files ?? [], options);
    } catch (err) {
      if (isUserCancellationError(err)) {
        return [];
      }

      const message = getErrorMessage(err) || 'Failed to pick files';
      setError(message);
      toast.error(message);
      return [];
    }
  }, [
    getErrorMessage,
    isNativeAttachmentPicker,
    isUserCancellationError,
    pickAttachments,
    uploadNativePickedFiles,
    user?.id,
  ]);

  const deleteAttachment = useCallback(async (attachment: Pick<QuestAttachmentInput, 'filePath'> | string): Promise<boolean> => {
    if (!user?.id) {
      setError('User not authenticated');
      return false;
    }

    try {
      const filePath = typeof attachment === 'string'
        ? extractQuestAttachmentFilePath(attachment)
        : attachment.filePath;

      if (!filePath) return false;

      const { error: deleteError } = await supabase.functions.invoke('delete-quest-attachment', {
        body: {
          filePath,
        },
      });

      if (deleteError) {
        throw new Error(await getInvokeErrorMessage(deleteError, 'Failed to delete attachment'));
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete attachment';
      setError(message);
      console.error('Delete attachment error:', err);
      return false;
    }
  }, [getInvokeErrorMessage, user?.id]);

  const deleteImage = useCallback(async (imageUrl: string): Promise<boolean> => {
    return deleteAttachment(imageUrl);
  }, [deleteAttachment]);

  return {
    pickImage,
    pickAttachments,
    pickPhotoAttachments,
    pickFileAttachments,
    uploadImage,
    uploadAttachment,
    deleteImage,
    deleteAttachment,
    isNativeAttachmentPicker,
    isUploading,
    error,
  };
}
