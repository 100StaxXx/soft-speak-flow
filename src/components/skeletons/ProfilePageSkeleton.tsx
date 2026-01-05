import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const ProfilePageSkeleton = () => (
  <div className="min-h-screen bg-background">
    {/* Header */}
    <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border/50 safe-area-top">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 w-40 mb-1" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
    </div>

    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Quick Actions */}
      <section className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[...Array(3)].map((_, i) => (
            <QuickActionSkeleton key={i} />
          ))}
        </div>
      </section>

      {/* Tabs */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        
        {/* Card Skeletons */}
        {[...Array(3)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  </div>
);

const QuickActionSkeleton = () => (
  <div className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card/50">
    <Skeleton className="h-10 w-10 rounded-lg" />
    <div className="flex-1 space-y-1.5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-32" />
    </div>
    <Skeleton className="h-4 w-4" />
  </div>
);

const CardSkeleton = () => (
  <Card className="border-border/50">
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  </Card>
);

export default ProfilePageSkeleton;
