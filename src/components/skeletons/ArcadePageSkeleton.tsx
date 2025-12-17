import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const ArcadePageSkeleton = () => (
  <div className="min-h-screen bg-background p-4 space-y-6">
    {/* Header */}
    <div className="text-center pt-4 space-y-2">
      <Skeleton className="h-8 w-40 mx-auto" />
      <Skeleton className="h-4 w-56 mx-auto" />
    </div>

    {/* Stats Cards */}
    <div className="grid grid-cols-2 gap-3">
      <Card className="p-4 space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-12" />
        <Skeleton className="h-3 w-20" />
      </Card>
      <Card className="p-4 space-y-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-24" />
      </Card>
    </div>

    {/* High Scores Card */}
    <Card className="p-4 space-y-3">
      <Skeleton className="h-5 w-32" />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </Card>

    {/* Difficulty Selector */}
    <div className="flex justify-center gap-2">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-10 w-20 rounded-full" />
      ))}
    </div>

    {/* Game Grid */}
    <div className="grid grid-cols-2 gap-3">
      {[...Array(8)].map((_, i) => (
        <GameCardSkeleton key={i} />
      ))}
    </div>

    {/* Return Button */}
    <Skeleton className="h-10 w-full rounded-md" />
  </div>
);

const GameCardSkeleton = () => (
  <Card className="p-4 space-y-3">
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div className="space-y-1 flex-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
    <Skeleton className="h-6 w-20" />
  </Card>
);

export default ArcadePageSkeleton;
