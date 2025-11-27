import { Button } from "@/components/ui/button";
import { Share2, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toPng } from "html-to-image";

interface EnhancedShareButtonProps {
  title: string;
  text: string;
  url?: string;
  className?: string;
  imageElementId?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export const EnhancedShareButton = ({ 
  title, 
  text, 
  url, 
  className = "",
  imageElementId,
  variant = "outline",
  size = "icon"
}: EnhancedShareButtonProps) => {
  
  const handleShare = async (platform?: string) => {
    const shareUrl = url || window.location.href;
    const shareText = `${text}\n\n${shareUrl}`;

    try {
      if (platform === "copy") {
        await navigator.clipboard.writeText(shareText);
        toast.success("Copied to clipboard!");
        return;
      }

      if (platform === "download" && imageElementId) {
        const element = document.getElementById(imageElementId);
        if (element) {
          const dataUrl = await toPng(element);
          const link = document.createElement("a");
          link.download = `${title.toLowerCase().replace(/\s+/g, "-")}.png`;
          link.href = dataUrl;
          link.click();
          toast.success("Image downloaded!");
          return;
        }
      }

      // Platform-specific sharing
      if (platform === "twitter") {
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
        window.open(twitterUrl, "_blank");
        return;
      }

      // Native share
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
        toast.success("Shared successfully!");
      } else {
        await navigator.clipboard.writeText(shareText);
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
          await navigator.clipboard.writeText(shareText);
          toast.info("Couldn't share, but link was copied to clipboard!");
        } catch (clipboardError) {
          console.error("Clipboard error:", clipboardError);
          toast.error("Failed to share. Please try again.");
        }
      }
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          aria-label={`Share ${title}`}
          aria-haspopup="menu"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" role="menu" aria-label="Share options">
        <div className="space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => handleShare()}
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => handleShare("copy")}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy Link
          </Button>
          {imageElementId && (
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => handleShare("download")}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Image
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
