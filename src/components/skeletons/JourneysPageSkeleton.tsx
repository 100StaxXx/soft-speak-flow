import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const JourneysPageSkeleton = () => (
  <div className="min-h-screen bg-background p-4 space-y-4 pt-safe">
    {/* Header */}
    <div className="text-center mb-6">
      <Skeleton className="h-10 w-32 mx-auto mb-2" />
      <Skeleton className="h-4 w-48 mx-auto" />
    </div>

    {/* Date Pills */}
    <div className="flex gap-2 overflow-hidden pb-2">
      {[...Array(7)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-12 rounded-xl flex-shrink-0" />
      ))}
    </div>

    {/* Stats Row */}
    <div className="flex gap-3">
      <Skeleton className="h-12 flex-1 rounded-lg" />
      <Skeleton className="h-12 flex-1 rounded-lg" />
    </div>

    {/* Quest Sections */}
    {['Morning', 'Afternoon', 'Evening'].map((section) => (
      <div key={section} className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <QuestCardSkeleton key={i} />
          ))}
        </div>
      </div>
    ))}
  </div>
);

const QuestCardSkeleton = () => (
  <Card className="p-4 space-y-3">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3 flex-1">
        <Skeleton className="h-5 w-5 rounded" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        </div>
      </div>
      <Skeleton className="h-8 w-8 rounded" />
    </div>
  </Card>
);

export default JourneysPageSkeleton;
