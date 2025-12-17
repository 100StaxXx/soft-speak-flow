import { Skeleton } from "@/components/ui/skeleton";

export const MiniGameSkeleton = () => (
  <div className="w-full max-w-md mx-auto space-y-4 p-4">
    {/* Game HUD */}
    <div className="flex justify-between items-center">
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>

    {/* Timer Bar */}
    <Skeleton className="h-2 w-full rounded-full" />

    {/* Game Area */}
    <div className="relative aspect-square rounded-2xl overflow-hidden">
      <Skeleton className="absolute inset-0" />
      
      {/* Center element */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Skeleton className="h-24 w-24 rounded-full" />
      </div>

      {/* Corner elements */}
      <Skeleton className="absolute top-4 left-4 h-10 w-10 rounded-full" />
      <Skeleton className="absolute top-4 right-4 h-10 w-10 rounded-full" />
      <Skeleton className="absolute bottom-4 left-4 h-10 w-10 rounded-full" />
      <Skeleton className="absolute bottom-4 right-4 h-10 w-10 rounded-full" />
    </div>

    {/* Instructions/Status */}
    <div className="text-center space-y-2">
      <Skeleton className="h-5 w-48 mx-auto" />
      <Skeleton className="h-4 w-32 mx-auto" />
    </div>

    {/* Action Button */}
    <Skeleton className="h-12 w-full rounded-lg" />
  </div>
);

export default MiniGameSkeleton;
