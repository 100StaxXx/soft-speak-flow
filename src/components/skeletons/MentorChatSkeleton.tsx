import { Skeleton } from "@/components/ui/skeleton";

export const MentorChatSkeleton = () => (
  <div className="min-h-screen bg-background flex flex-col">
    {/* Hero Header */}
    <div className="relative h-32 bg-gradient-to-b from-primary/20 to-background">
      <div className="absolute inset-0 flex items-center justify-center pt-safe">
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
      {/* Back button */}
      <Skeleton className="absolute top-4 left-4 h-8 w-8 rounded-full mt-safe" />
    </div>

    {/* Chat Messages Area */}
    <div className="flex-1 px-4 py-6 space-y-4">
      {/* Incoming message */}
      <div className="flex gap-3">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="space-y-2 max-w-[80%]">
          <Skeleton className="h-16 w-64 rounded-2xl rounded-tl-sm" />
        </div>
      </div>

      {/* Outgoing message */}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-48 rounded-2xl rounded-tr-sm" />
      </div>

      {/* Incoming message */}
      <div className="flex gap-3">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="space-y-2 max-w-[80%]">
          <Skeleton className="h-24 w-72 rounded-2xl rounded-tl-sm" />
        </div>
      </div>
    </div>

    {/* Input Area */}
    <div className="sticky bottom-0 bg-background border-t border-border/50 p-4 pb-nav-safe">
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 flex-1 rounded-full" />
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    </div>
  </div>
);

export default MentorChatSkeleton;
