import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    // Find the current active word based on audio time
    const currentIndex = transcript.findIndex(
      (word) => currentTime >= word.start && currentTime < word.end
    );
    
    if (currentIndex !== activeWordIndex) {
      setActiveWordIndex(currentIndex);
    }
  }, [currentTime, transcript, activeWordIndex]);

  useEffect(() => {
    // Auto-scroll to active word
    if (activeWordRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeWord = activeWordRef.current;
      
      const containerRect = container.getBoundingClientRect();
      const wordRect = activeWord.getBoundingClientRect();
      
      // Check if word is out of view
      if (wordRect.top < containerRect.top || wordRect.bottom > containerRect.bottom) {
        activeWord.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [activeWordIndex]);

  if (!transcript || transcript.length === 0) {
    return (
      <div className={cn("bg-card rounded-3xl p-6 shadow-soft", className)}>
        <p className="text-muted-foreground text-center italic">
          No transcript available for this pep talk.
        </p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "bg-card rounded-3xl p-6 shadow-soft max-h-[400px] overflow-y-auto scroll-smooth",
        className
      )}
    >
      <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
        Transcript
      </h3>
      <div className="text-base leading-relaxed">
        {transcript.map((word, index) => (
          <span
            key={index}
            ref={index === activeWordIndex ? activeWordRef : null}
            className={cn(
              "transition-all duration-200 px-0.5",
              index === activeWordIndex
                ? "bg-blush-rose/30 text-foreground font-semibold scale-105 inline-block"
                : "text-muted-foreground"
            )}
          >
            {word.word}{" "}
          </span>
        ))}
      </div>
    </div>
  );
};
