import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export const CompanionPageSkeleton = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen pb-nav-safe pt-safe"
    >
      {/* Header skeleton */}
      <div className="sticky top-0 z-40 w-full cosmiq-glass-header safe-area-top">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-6 w-28" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        {/* Tabs skeleton */}
        <Skeleton className="h-10 w-full rounded-lg" />
        
        {/* Companion display skeleton */}
        <div className="rounded-2xl border border-border/50 p-6 space-y-4">
          <div className="flex justify-center">
            <Skeleton className="h-48 w-48 rounded-full" />
          </div>
          <Skeleton className="h-6 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
        
        {/* Evolution preview skeleton */}
        <div className="rounded-2xl border border-border/50 p-4 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-full" />
          <div className="flex justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        
        {/* Missions skeleton */}
        <div className="rounded-2xl border border-border/50 p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
