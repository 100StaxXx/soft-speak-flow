import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ATTACHMENT_INPUT_ACCEPT, MAX_ATTACHMENTS_PER_TASK } from '@/constants/questAttachments';
import { validateAttachmentFiles } from '@/utils/questAttachmentValidation';
import type { QuestAttachmentInput } from '@/types/questAttachments';

interface UseQuestImagePickerReturn {
  pickImage: () => Promise<string | null>;
  pickAttachments: (options?: { currentCount?: number; maxCount?: number }) => Promise<QuestAttachmentInput[]>;
  uploadImage: (file: File | Blob, fileName?: string) => Promise<string | null>;
  uploadAttachment: (file: File | Blob, fileName?: string) => Promise<QuestAttachmentInput | null>;
  deleteImage: (imageUrl: string) => Promise<boolean>;
  deleteAttachment: (attachment: Pick<QuestAttachmentInput, 'filePath'> | string) => Promise<boolean>;
  isUploading: boolean;
  error: string | null;
}

export function useQuestImagePicker(): UseQuestImagePickerReturn {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const buildFilePath = useCallback((providedFileName?: string) => {
    const timestamp = Date.now();
    const extension = providedFileName?.split('.').pop() || 'jpg';
    return `${user?.id}/${timestamp}_${Math.random().toString(36).slice(2)}_quest.${extension}`;
  }, [user?.id]);

  const uploadAttachment = useCallback(async (file: File | Blob, fileName?: string): Promise<QuestAttachmentInput | null> => {
    if (!user?.id) {
      setError('User not authenticated');
      return null;
    }

    setIsUploading(true);
    setError(null);

    try {
      const path = buildFilePath(fileName);

      const { error: uploadError } = await supabase.storage
        .from('quest-attachments')
        .upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('quest-attachments')
        .getPublicUrl(path);

      return {
        fileUrl: publicUrl,
        filePath: path,
        fileName: fileName || `attachment-${Date.now()}`,
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
  }, [buildFilePath, user?.id]);

  const uploadImage = useCallback(async (file: File | Blob, fileName?: string): Promise<string | null> => {
    const attachment = await uploadAttachment(file, fileName);
    if (!attachment || !attachment.isImage) {
      return attachment?.fileUrl ?? null;
    }
    return attachment.fileUrl;
  }, [uploadAttachment]);

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
    options?: { currentCount?: number; maxCount?: number },
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

  const deleteAttachment = useCallback(async (attachment: Pick<QuestAttachmentInput, 'filePath'> | string): Promise<boolean> => {
    if (!user?.id) {
      setError('User not authenticated');
      return false;
    }

    try {
      const filePath = typeof attachment === 'string'
        ? (() => {
          const url = new URL(attachment);
          const pathParts = url.pathname.split('/');
          const bucketIndex = pathParts.findIndex((p) => p === 'quest-attachments');
          if (bucketIndex === -1) return null;
          return pathParts.slice(bucketIndex + 1).join('/');
        })()
        : attachment.filePath;

      if (!filePath) return false;

      const { error: deleteError } = await supabase.storage
        .from('quest-attachments')
        .remove([filePath]);

      if (deleteError) {
        throw deleteError;
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete attachment';
      setError(message);
      console.error('Delete attachment error:', err);
      return false;
    }
  }, [user?.id]);

  const deleteImage = useCallback(async (imageUrl: string): Promise<boolean> => {
    return deleteAttachment(imageUrl);
  }, [deleteAttachment]);

  return {
    pickImage,
    pickAttachments,
    uploadImage,
    uploadAttachment,
    deleteImage,
    deleteAttachment,
    isUploading,
    error,
  };
}
