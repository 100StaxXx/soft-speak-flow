import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const HabitCardSkeleton = () => (
  <Card className="p-5 md:p-6 space-y-4 animate-pulse">
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-4">
          <Skeleton className="h-16 w-24 rounded-full" />
          <Skeleton className="h-16 w-24 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-10 w-10 rounded-full" />
    </div>
  </Card>
);

export const MissionCardSkeleton = () => (
  <Card className="p-5 md:p-6 space-y-4 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
    <Skeleton className="h-2 w-full" />
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-3 flex-1">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 w-full max-w-xs" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
      ))}
    </div>
  </Card>
);

export const CompanionSkeleton = () => (
  <Card className="p-6 md:p-8 space-y-6 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="text-right space-y-2">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
    <div className="flex justify-center">
      <Skeleton className="h-80 w-80 rounded-3xl" />
    </div>
    <div className="space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-3 w-full rounded-full" />
    </div>
  </Card>
);