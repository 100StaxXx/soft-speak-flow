import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { safeClipboardWrite, getClipboardErrorMessage } from "@/utils/clipboard";

interface ShareButtonProps {
  title: string;
  text: string;
  url?: string;
  className?: string;
}

export const ShareButton = ({ title, text, url, className = "" }: ShareButtonProps) => {
  const [isSharing, setIsSharing] = useState(false);
  
  const handleShare = async () => {
    if (isSharing) return; // Prevent double-click
    
    setIsSharing(true);
    
    try {
      const shareData = {
        title,
        text,
        url: url || window.location.href,
      };
      
      const shareText = `${text}\n\n${shareData.url}`;

      if (navigator.share) {
        await navigator.share(shareData);
        toast.success("Shared successfully!");
      } else {
        // Fallback: copy to clipboard (safe for all contexts)
        const success = await safeClipboardWrite(shareText);
        if (success) {
          toast.success("Link copied to clipboard!");
        } else {
          toast.error("Failed to copy to clipboard");
        }
      }
    } catch (error) {
      console.error("Error sharing:", error);
      
      // Check if user cancelled (case-insensitive)
      const errorMsg = error?.message?.toLowerCase() || error?.toString?.()?.toLowerCase() || '';
      const isCancelled = errorMsg.includes('cancel') || 
                         errorMsg.includes('abort') || 
                         errorMsg.includes('dismissed') ||
                         error?.name === 'AbortError';
      
      if (!isCancelled) {
        // Try fallback to clipboard as last resort
        const fallbackText = `${text}\n\n${url || window.location.href}`;
        const success = await safeClipboardWrite(fallbackText);
        
        if (success) {
          toast.info("Couldn't share, but link was copied to clipboard!");
        } else {
          toast.error(getClipboardErrorMessage(error));
        }
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleShare}
      disabled={isSharing}
      className={className}
      aria-label="Share"
    >
      <Share2 className={`h-4 w-4 ${isSharing ? 'animate-pulse' : ''}`} />
    </Button>
  );
};
