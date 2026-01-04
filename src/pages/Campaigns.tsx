import { motion } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { BottomNav } from "@/components/BottomNav";
import { EpicsTab } from "@/features/epics/components/EpicsTab";

const Campaigns = () => {
  return (
    <PageTransition>
      <StarfieldBackground />
      <div className="min-h-screen pb-nav-safe pt-safe px-4 relative z-10">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center"
        >
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Campaigns
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Chart your course. One step at a time.
          </p>
        </motion.div>

        <EpicsTab />
      </div>
      <BottomNav />
    </PageTransition>
  );
};

export default Campaigns;
