import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { toast } from "sonner";

interface ShareButtonProps {
  title: string;
  text: string;
  url?: string;
  className?: string;
}

export const ShareButton = ({ title, text, url, className = "" }: ShareButtonProps) => {
  const handleShare = async () => {
    const shareData = {
      title,
      text,
      url: url || window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success("Shared successfully!");
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(`${text}\n\n${shareData.url}`);
        toast.success("Link copied to clipboard!");
      }
    } catch (error: any) {
      console.error("Error sharing:", error);
      
      // Check if user cancelled (case-insensitive)
      const errorMsg = error?.message?.toLowerCase() || error?.toString?.()?.toLowerCase() || '';
      const isCancelled = errorMsg.includes('cancel') || 
                         errorMsg.includes('abort') || 
                         errorMsg.includes('dismissed') ||
                         error?.name === 'AbortError';
      
      if (!isCancelled) {
        // Try fallback to clipboard as last resort
        try {
          await navigator.clipboard.writeText(`${text}\n\n${shareData.url}`);
          toast.info("Couldn't share, but link was copied to clipboard!");
        } catch (clipboardError) {
          console.error("Clipboard error:", clipboardError);
          toast.error("Failed to share. Please try again.");
        }
      }
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleShare}
      className={className}
      aria-label="Share"
    >
      <Share2 className="h-4 w-4" />
    </Button>
  );
};
