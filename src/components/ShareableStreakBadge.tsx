import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Download, Flame } from "lucide-react";
import { toPng } from 'html-to-image';
import { toast } from "sonner";

interface ShareableStreakBadgeProps {
  streak: number;
  habitTitle: string;
  mentorName?: string;
  mentorQuote?: string;
}

export const ShareableStreakBadge = ({ 
  streak, 
  habitTitle, 
  mentorName,
  mentorQuote = "Consistency beats intensity." 
}: ShareableStreakBadgeProps) => {
  const badgeRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const downloadBadge = async () => {
    if (!badgeRef.current) return;
    
    try {
      const dataUrl = await toPng(badgeRef.current, {
        quality: 1,
        pixelRatio: 2,
      });
      
      const link = document.createElement('a');
      link.download = `${streak}-day-streak.png`;
      link.href = dataUrl;
      link.click();
      
      // Clean up link element
      setTimeout(() => link.remove(), 100);
      
      toast.success("Badge downloaded!");
    } catch (error) {
      console.error('Error generating badge:', error);
      toast.error("Failed to download badge");
    }
  };

  const shareBadge = async () => {
    if (!badgeRef.current || isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      const dataUrl = await toPng(badgeRef.current, {
        quality: 1,
        pixelRatio: 2,
      });
      
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${streak}-day-streak.png`, { type: 'image/png' });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${streak} Day Streak!`,
          text: `I just hit a ${streak}-day streak on ${habitTitle}! 🔥`,
        });
        toast.success("Shared successfully!");
      } else {
        // Fallback to download if sharing not supported
        await downloadBadge();
      }
    } catch (error: any) {
      console.error('Error sharing badge:', error);
      
      // Check if user cancelled (case-insensitive)
      const errorMsg = error?.message?.toLowerCase() || error?.toString?.()?.toLowerCase() || '';
      const isCancelled = errorMsg.includes('cancel') || 
                         errorMsg.includes('abort') || 
                         errorMsg.includes('dismissed') ||
                         error?.name === 'AbortError';
      
      if (!isCancelled) {
        // Fallback to download on error (with proper error handling)
        try {
          toast.info("Couldn't share, downloading instead...");
          await downloadBadge();
        } catch (downloadError) {
          console.error('Download fallback failed:', downloadError);
          toast.error('Failed to share or download badge. Please try again.');
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Badge Preview */}
      <div 
        ref={badgeRef} 
        className="w-full aspect-square bg-gradient-to-br from-primary via-accent to-primary p-8 rounded-2xl relative overflow-hidden"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative h-full flex flex-col items-center justify-center text-white text-center space-y-4">
          <Flame className="h-16 w-16 text-orange-300" />
          
          <div>
            <div className="text-6xl font-black mb-2">{streak}</div>
            <div className="text-2xl font-bold">DAY STREAK</div>
          </div>
          
          <div className="text-lg font-medium max-w-[80%]">
            {habitTitle}
          </div>
          
          <div className="absolute bottom-8 left-8 right-8">
            <p className="text-sm italic opacity-90">"{mentorQuote}"</p>
            {mentorName && (
              <p className="text-xs mt-2 opacity-75">— {mentorName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          onClick={downloadBadge}
          disabled={isProcessing}
          className="w-full"
        >
          <Download className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-pulse' : ''}`} />
          Download
        </Button>
        <Button
          onClick={shareBadge}
          disabled={isProcessing}
          className="w-full bg-gradient-to-r from-primary to-accent"
        >
          <Share2 className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-pulse' : ''}`} />
          {isProcessing ? 'Processing...' : 'Share'}
        </Button>
      </div>
    </div>
  );
};
