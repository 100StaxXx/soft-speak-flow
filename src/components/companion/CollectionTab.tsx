import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, Sparkles, Gift } from "lucide-react";
import { BadgesCollectionPanel } from "@/components/BadgesCollectionPanel";
import { EvolutionCardGallery } from "@/components/EvolutionCardGallery";
import { RewardInventory } from "@/components/RewardInventory";

type CollectionSection = "badges" | "cards" | "loot";

const COLLECTION_SECTIONS: CollectionSection[] = ["badges", "cards", "loot"];

const INITIAL_MOUNTED_SECTIONS: Record<CollectionSection, boolean> = {
  badges: true,
  cards: false,
  loot: false,
};

const isCollectionSection = (section: string): section is CollectionSection =>
  COLLECTION_SECTIONS.includes(section as CollectionSection);

export const CollectionTab = memo(() => {
  const [activeSection, setActiveSection] = useState<CollectionSection>("badges");
  const [mountedSections, setMountedSections] = useState<Record<CollectionSection, boolean>>(
    () => INITIAL_MOUNTED_SECTIONS,
  );
  const prewarmedRef = useRef(false);

  const markSectionMounted = useCallback((section: CollectionSection) => {
    setMountedSections((previous) =>
      previous[section] ? previous : { ...previous, [section]: true },
    );
  }, []);

  const handleSectionChange = useCallback(
    (value: string) => {
      if (!isCollectionSection(value)) return;
      setActiveSection(value);
      markSectionMounted(value);
    },
    [markSectionMounted],
  );

  useEffect(() => {
    if (prewarmedRef.current) return;
    prewarmedRef.current = true;

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    let timeoutId: number | null = null;
    let idleHandle: number | null = null;

    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(() => {
        setMountedSections({ badges: true, cards: true, loot: true });
      }, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(() => {
        setMountedSections({ badges: true, cards: true, loot: true });
      }, 400);
    }

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (idleHandle !== null && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleHandle);
      }
    };
  }, []);

  return (
    <div className="space-y-4 mt-4">
      <Tabs value={activeSection} onValueChange={handleSectionChange}>
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

        <TabsContent value="badges" forceMount className="mt-4 data-[state=inactive]:hidden">
          {mountedSections.badges && <BadgesCollectionPanel />}
        </TabsContent>

        <TabsContent value="cards" forceMount className="mt-4 data-[state=inactive]:hidden">
          {mountedSections.cards && <EvolutionCardGallery />}
        </TabsContent>

        <TabsContent value="loot" forceMount className="mt-4 data-[state=inactive]:hidden">
          {mountedSections.loot && <RewardInventory />}
        </TabsContent>
      </Tabs>
    </div>
  );
});

CollectionTab.displayName = 'CollectionTab';
