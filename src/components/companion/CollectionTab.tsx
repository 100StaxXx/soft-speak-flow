import { memo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, Sparkles, Gift } from "lucide-react";
import { BadgesCollectionPanel } from "@/components/BadgesCollectionPanel";
import { EvolutionCardGallery } from "@/components/EvolutionCardGallery";
import { RewardInventory } from "@/components/RewardInventory";

export const CollectionTab = memo(() => {
  const [activeSection, setActiveSection] = useState<"badges" | "cards" | "loot">("badges");

  return (
    <div className="space-y-4 mt-4">
      <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as "badges" | "cards" | "loot")}>
        <TabsList className="grid w-full grid-cols-3 h-10">
          <TabsTrigger value="badges" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">Badges</span>
          </TabsTrigger>
          <TabsTrigger value="cards" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Cards</span>
          </TabsTrigger>
          <TabsTrigger value="loot" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            <span className="hidden sm:inline">Loot</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="badges" className="mt-4">
          <BadgesCollectionPanel />
        </TabsContent>

        <TabsContent value="cards" className="mt-4">
          <EvolutionCardGallery />
        </TabsContent>

        <TabsContent value="loot" className="mt-4">
          <RewardInventory />
        </TabsContent>
      </Tabs>
    </div>
  );
});

CollectionTab.displayName = 'CollectionTab';
