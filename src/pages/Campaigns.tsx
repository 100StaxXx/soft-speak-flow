import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { BottomNav } from "@/components/BottomNav";
import { EpicsTab } from "@/features/epics/components/EpicsTab";

const Campaigns = () => {
  return (
    <PageTransition>
      <StarfieldBackground />
      <div className="min-h-screen pb-nav-safe pt-safe px-4 relative z-10">
        <EpicsTab />
      </div>
      <BottomNav />
    </PageTransition>
  );
};

export default Campaigns;
