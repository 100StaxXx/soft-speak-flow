import { Sparkles, Sun } from "lucide-react";

export const MentorSkeleton = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <div className="relative z-10 min-h-screen pb-24 sm:pb-24">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 pt-48 sm:pt-32 md:pt-24 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <div>
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-3 w-48 bg-muted rounded animate-pulse mt-2" />
            </div>
          </div>
          <Sun className="h-10 w-10 text-primary animate-pulse" />
        </div>

        {[1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="cosmiq-glass rounded-2xl p-6 space-y-4 border border-border/60 bg-card/70 animate-pulse"
          >
            <div className="h-5 w-24 bg-muted rounded" />
            <div className="h-24 w-full bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  </div>
);
