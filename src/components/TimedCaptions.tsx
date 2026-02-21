import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/glass-card";
import { FileText } from "lucide-react";
import { getActiveWordIndex } from "@/utils/captionTiming";

interface CaptionWord {
  word: string;
  start: number;
  end: number;
}

interface TimedCaptionsProps {
  transcript: CaptionWord[];
  currentTime: number;
  className?: string;
}

export const TimedCaptions = ({ transcript, currentTime, className }: TimedCaptionsProps) => {
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const sortedTranscript = useMemo(
    () => [...transcript].sort((a, b) => (a.start - b.start) || (a.end - b.end)),
    [transcript],
  );

  useEffect(() => {
    setActiveWordIndex((previousIndex) =>
      getActiveWordIndex(sortedTranscript, currentTime, previousIndex),
    );
  }, [currentTime, sortedTranscript]);

  useEffect(() => {
    if (activeWordIndex < 0) {
      return;
    }

    // Auto-scroll to keep active word in upper portion of container
    if (activeWordRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeWord = activeWordRef.current;
      
      const containerRect = container.getBoundingClientRect();
      const wordRect = activeWord.getBoundingClientRect();
      
      // Calculate the word's position relative to the container
      const wordOffsetTop = wordRect.top - containerRect.top;
      const containerHeight = containerRect.height;
      
      // Keep active word in the top third of the container
      const targetPosition = containerHeight * 0.3;
      
      // If word is below the target position or out of view, scroll
      if (wordOffsetTop > targetPosition || wordRect.bottom > containerRect.bottom || wordRect.top < containerRect.top) {
        const scrollOffset = activeWord.offsetTop - container.offsetTop - targetPosition;
        container.scrollTo({
          top: Math.max(0, scrollOffset),
          behavior: 'smooth'
        });
      }
    }
  }, [activeWordIndex]);

  if (!transcript || transcript.length === 0) {
    return (
      <GlassCard variant="default" glow="soft" className={cn("p-6", className)}>
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Transcript
          </h3>
        </div>
        <p className="text-muted-foreground text-center italic py-4">
          No transcript available for this pep talk.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard 
      variant="default" 
      glow="soft"
      className={cn("p-6", className)}
    >
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-4 w-4 text-stardust-gold" />
        <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Transcript
        </h3>
      </div>
      <div 
        ref={containerRef}
        className="max-h-[300px] overflow-y-auto scroll-smooth pr-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
      >
        <div className="text-base leading-relaxed">
          {sortedTranscript.map((word, index) => (
            <span
              key={index}
              ref={index === activeWordIndex ? activeWordRef : null}
              className={cn(
                "transition-all duration-200 px-0.5 py-0.5 rounded",
                index === activeWordIndex
                  ? "bg-stardust-gold/30 text-foreground font-semibold shadow-[0_0_8px_rgba(255,215,0,0.3)]"
                  : index < activeWordIndex
                  ? "text-muted-foreground/70"
                  : "text-muted-foreground"
              )}
            >
              {word.word}{" "}
            </span>
          ))}
        </div>
      </div>
    </GlassCard>
  );
};
