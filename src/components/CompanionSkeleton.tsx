import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const CompanionSkeleton = () => {
  return (
    <Card className="relative overflow-hidden shadow-glow-lg border-primary/40 animate-pulse bg-gradient-to-br from-card via-card to-secondary/50">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 opacity-60" />
      
      <div className="relative p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>

        {/* Companion Image */}
        <div className="flex justify-center py-8">
          <Skeleton className="h-64 w-64 rounded-2xl" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>

        {/* Progress Section */}
        <div className="space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </div>
      </div>
    </Card>
  );
};
