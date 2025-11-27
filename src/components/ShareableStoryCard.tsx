import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Download, BookOpen } from "lucide-react";
import { toPng } from 'html-to-image';
import { toast } from "sonner";
import { CompanionStory } from "@/hooks/useCompanionStory";

interface ShareableStoryCardProps {
  story: CompanionStory;
  companionImage?: string;
  companionName?: string;
  stage: number;
}

export const ShareableStoryCard = ({ 
  story, 
  companionImage,
  companionName = "Your Companion",
  stage
}: ShareableStoryCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const downloadCard = async () => {
    if (!cardRef.current) return;
    
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
      });
      
      const link = document.createElement('a');
      link.download = `${story.chapter_title.replace(/\s+/g, '-').toLowerCase()}-story.png`;
      link.href = dataUrl;
      link.click();
      
      setTimeout(() => link.remove(), 100);
      toast.success("Story card downloaded!");
    } catch (error) {
      console.error('Error generating card:', error);
      toast.error("Failed to download card");
    }
  };

  const shareCard = async () => {
    if (!cardRef.current || isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
      });
      
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${story.chapter_title}-story.png`, { type: 'image/png' });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: story.chapter_title,
          text: `Check out this chapter from my companion's story! 📖`,
        });
        toast.success("Shared successfully!");
      } else {
        await downloadCard();
      }
    } catch (error: any) {
      console.error('Error sharing card:', error);
      
      const errorMsg = error?.message?.toLowerCase() || error?.toString?.()?.toLowerCase() || '';
      const isCancelled = errorMsg.includes('cancel') || 
                         errorMsg.includes('abort') || 
                         errorMsg.includes('dismissed') ||
                         error?.name === 'AbortError';
      
      if (!isCancelled) {
        try {
          toast.info("Couldn't share, downloading instead...");
          await downloadCard();
        } catch (downloadError) {
          console.error('Download fallback failed:', downloadError);
          toast.error('Failed to share or download card. Please try again.');
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Card Preview */}
      <div 
        ref={cardRef} 
        className="w-full aspect-[3/4] bg-gradient-to-br from-primary/20 via-accent/30 to-primary/20 p-6 rounded-2xl relative overflow-hidden"
      >
        {/* Mystical Border Effects */}
        <div className="absolute inset-0 border-2 border-primary/30 rounded-2xl" />
        <div className="absolute inset-0 border border-accent/20 rounded-2xl m-1" />
        
        {/* Background Glow */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative h-full flex flex-col text-foreground">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium opacity-80">
                {stage === 0 ? "Prologue" : `Chapter ${stage}`}
              </span>
            </div>
            <div className="text-xs px-3 py-1 bg-primary/20 rounded-full border border-primary/30">
              Stage {stage}
            </div>
          </div>

          {/* Companion Image */}
          {companionImage && (
            <div className="flex-1 flex items-center justify-center mb-4">
              <div className="relative w-48 h-48">
                {/* Glow effect behind companion */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30 rounded-full blur-2xl" />
                <img 
                  src={companionImage} 
                  alt={companionName}
                  className="relative w-full h-full object-contain drop-shadow-2xl"
                />
              </div>
            </div>
          )}

          {/* Story Title */}
          <div className="space-y-2 text-center">
            <h3 className="text-xl font-bold leading-tight">{story.chapter_title}</h3>
            <p className="text-sm italic opacity-90 line-clamp-2">
              "{story.intro_line}"
            </p>
          </div>

          {/* Footer */}
          <div className="mt-auto pt-4 border-t border-foreground/10">
            <p className="text-xs text-center opacity-75">
              {companionName}'s Journey • R-Evolution
            </p>
          </div>
        </div>

        {/* Decorative Corner Elements */}
        <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-primary/40 rounded-tl-lg" />
        <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-primary/40 rounded-tr-lg" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-primary/40 rounded-bl-lg" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-primary/40 rounded-br-lg" />
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          onClick={downloadCard}
          disabled={isProcessing}
          className="w-full"
        >
          <Download className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-pulse' : ''}`} />
          Download
        </Button>
        <Button
          onClick={shareCard}
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
