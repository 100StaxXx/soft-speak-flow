import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toast } from 'sonner';

interface ShareOptions {
  title?: string;
  text?: string;
  dialogTitle?: string;
}

/**
 * Download or share an image, with iOS native support
 */
export const downloadImage = async (
  imageUrl: string, 
  filename: string,
  shareOptions?: ShareOptions
) => {
  try {
    if (Capacitor.isNativePlatform()) {
      // Native iOS/Android: Use Filesystem + Share
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);
      
      // Save to cache directory
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });

      // Share the file using native share sheet
      await Share.share({
        title: shareOptions?.title || 'Companion Card',
        text: shareOptions?.text || 'Check out my companion!',
        url: savedFile.uri,
        dialogTitle: shareOptions?.dialogTitle || 'Share Companion Card',
      });

      toast.success('Image ready to share!');
    } else {
      // Web: Standard download
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = filename;
      a.click();
      toast.success('Image downloaded!');
    }
  } catch (error) {
    console.error('Error downloading image:', error);
    toast.error('Failed to save image');
  }
};

/**
 * Convert blob to base64 string (without data URL prefix)
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data URL prefix (data:image/png;base64,)
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
