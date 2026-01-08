import { memo } from "react";
import { BondProgress } from "./BondProgress";
// import { MemoryTimeline } from "./MemoryTimeline"; // Hidden for now - will implement differently later
import { MemoryWhisper } from "./MemoryWhisper";
import { ParallaxCard } from "@/components/ui/parallax-card";

/**
 * Bond tab content showing bond progress and memory timeline.
 */
export const BondTab = memo(() => {
  return (
    <div className="space-y-6 mt-6">
      {/* Memory whisper - occasional "remember when" message */}
      <MemoryWhisper chance={0.3} />
      
      {/* Bond progress with milestone timeline */}
      <ParallaxCard offset={24}>
        <div className="p-4">
          <BondProgress showMilestones />
        </div>
      </ParallaxCard>
      
      {/* Hidden for now - will implement differently later
      <ParallaxCard offset={18}>
        <div className="p-4">
          <h3 className="font-heading font-bold text-lg mb-4">Special Memories</h3>
          <MemoryTimeline limit={5} />
        </div>
      </ParallaxCard>
      */}
    </div>
  );
});

BondTab.displayName = 'BondTab';
