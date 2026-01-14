import { useState, useCallback } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface UseQuestImagePickerReturn {
  pickImage: () => Promise<string | null>;
  uploadImage: (file: File | Blob, fileName?: string) => Promise<string | null>;
  deleteImage: (imageUrl: string) => Promise<boolean>;
  isUploading: boolean;
  error: string | null;
}

export function useQuestImagePicker(): UseQuestImagePickerReturn {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadImage = useCallback(async (file: File | Blob, fileName?: string): Promise<string | null> => {
    if (!user?.id) {
      setError('User not authenticated');
      return null;
    }

    setIsUploading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const extension = fileName?.split('.').pop() || 'jpg';
      const filePath = `${user.id}/${timestamp}_quest.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('quest-attachments')
        .upload(filePath, file, {
          contentType: file.type || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('quest-attachments')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload image';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [user?.id]);

  const pickImage = useCallback(async (): Promise<string | null> => {
    if (!user?.id) {
      setError('User not authenticated');
      return null;
    }

    setError(null);

    try {
      // Check if we're on a native platform
      if (Capacitor.isNativePlatform()) {
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
      } else {
        // Web fallback - create a file input
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
      }
    } catch (err) {
      // Handle user cancellation gracefully
      if (err instanceof Error && err.message.includes('cancelled')) {
        return null;
      }
      const message = err instanceof Error ? err.message : 'Failed to pick image';
      setError(message);
      toast.error(message);
      return null;
    }
  }, [user?.id, uploadImage]);

  const deleteImage = useCallback(async (imageUrl: string): Promise<boolean> => {
    if (!user?.id) {
      setError('User not authenticated');
      return false;
    }

    try {
      // Extract path from URL
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.findIndex(p => p === 'quest-attachments');
      if (bucketIndex === -1) return false;
      
      const filePath = pathParts.slice(bucketIndex + 1).join('/');

      const { error: deleteError } = await supabase.storage
        .from('quest-attachments')
        .remove([filePath]);

      if (deleteError) {
        throw deleteError;
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete image';
      setError(message);
      console.error('Delete image error:', err);
      return false;
    }
  }, [user?.id]);

  return {
    pickImage,
    uploadImage,
    deleteImage,
    isUploading,
    error,
  };
}
