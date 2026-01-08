import { memo } from "react";
// import { BondProgress } from "./BondProgress"; // Hidden - now integrated into Overview tab
// import { MemoryTimeline } from "./MemoryTimeline"; // Hidden - will implement differently later
import { MemoryWhisper } from "./MemoryWhisper";
// import { ParallaxCard } from "@/components/ui/parallax-card"; // No longer needed

/**
 * Bond tab content - currently showing only MemoryWhisper.
 * Bond progress and milestones moved to Overview tab.
 */
export const BondTab = memo(() => {
  return (
    <div className="space-y-6 mt-6">
      {/* Memory whisper - occasional "remember when" message */}
      <MemoryWhisper chance={0.3} />
      
      {/* Bond progress hidden - now displayed in Overview tab via CompanionBondBadge and NextEvolutionPreview
      <ParallaxCard offset={24}>
        <div className="p-4">
          <BondProgress showMilestones />
        </div>
      </ParallaxCard>
      */}
      
      {/* Memory timeline hidden - will implement differently later
      <ParallaxCard offset={18}>
        <div className="p-4">
          <h3 className="font-heading font-bold text-lg mb-4">Special Memories</h3>
          <MemoryTimeline limit={5} />
        </div>
      </ParallaxCard>
      */}
      
      <div className="text-center text-muted-foreground text-sm py-8">
        <p>Bond features are now integrated into the Overview tab.</p>
        <p className="text-xs mt-1">More bond experiences coming soon...</p>
      </div>
    </div>
  );
});

BondTab.displayName = 'BondTab';
