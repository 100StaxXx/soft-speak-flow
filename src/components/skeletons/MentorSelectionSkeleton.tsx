import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export const MentorSelectionSkeleton = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-obsidian py-16 px-4 md:px-8"
    >
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Header skeleton */}
        <div className="text-center space-y-6">
          <Skeleton className="h-1 w-24 mx-auto bg-royal-gold/30" />
          <Skeleton className="h-16 w-80 mx-auto" />
          <Skeleton className="h-7 w-64 mx-auto" />
        </div>

        {/* Mentor Grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-border/30 p-6 space-y-4 bg-muted/5"
            >
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
