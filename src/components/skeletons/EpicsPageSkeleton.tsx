import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export const EpicsPageSkeleton = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen pb-nav-safe pt-safe px-4"
    >
      {/* Hero Header skeleton */}
      <div className="mb-8 text-center space-y-3">
        <Skeleton className="h-8 w-40 mx-auto rounded-full" />
        <Skeleton className="h-10 w-48 mx-auto" />
        <Skeleton className="h-5 w-64 mx-auto" />
      </div>

      {/* Action Buttons skeleton */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
      </div>

      {/* Create buttons skeleton */}
      <div className="mb-6 space-y-3">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>

      {/* Tabs skeleton */}
      <Skeleton className="h-10 w-full rounded-lg mb-6" />

      {/* Epic cards skeleton */}
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border/50 p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
