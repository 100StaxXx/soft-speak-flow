import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export const CampaignsPageSkeleton = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen pb-nav-safe pt-safe px-4"
    >
      {/* Hero Header skeleton */}
      <div className="mb-6 text-center space-y-3">
        <Skeleton className="h-10 w-48 mx-auto" />
        <Skeleton className="h-5 w-56 mx-auto" />
      </div>

      {/* Journey cards skeleton */}
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-2xl border border-border/50 overflow-hidden"
          >
            {/* Journey path background skeleton */}
            <Skeleton className="h-32 w-full" />
            
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <Skeleton className="h-12 w-12 rounded-full" />
              </div>
              
              {/* Progress bar skeleton */}
              <Skeleton className="h-2 w-full rounded-full" />
              
              {/* Stats skeleton */}
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};
