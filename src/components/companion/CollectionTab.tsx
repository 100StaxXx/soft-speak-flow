import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, Gift, MapPin } from "lucide-react";
import { BadgesCollectionPanel } from "@/components/BadgesCollectionPanel";
import { CompanionPostcards } from "@/components/companion/CompanionPostcards";
import { RewardInventory } from "@/components/RewardInventory";
import { cn } from "@/lib/utils";
import type { CompanionLayoutMode } from "@/hooks/useCompanionLayoutMode";

type CollectionSection = "badges" | "postcards" | "loot";

const COLLECTION_SECTIONS: CollectionSection[] = ["badges", "postcards", "loot"];

const INITIAL_MOUNTED_SECTIONS: Record<CollectionSection, boolean> = {
  badges: true,
  postcards: false,
  loot: false,
};

const isCollectionSection = (section: string): section is CollectionSection =>
  COLLECTION_SECTIONS.includes(section as CollectionSection);

interface CollectionTabProps {
  layoutMode?: CompanionLayoutMode;
}

export const CollectionTab = memo(({ layoutMode = "mobile" }: CollectionTabProps) => {
  const [activeSection, setActiveSection] = useState<CollectionSection>("badges");
  const [mountedSections, setMountedSections] = useState<Record<CollectionSection, boolean>>(
    () => INITIAL_MOUNTED_SECTIONS,
  );
  const prewarmedRef = useRef(false);
  const isDesktop = layoutMode === "desktop";

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
        setMountedSections({ badges: true, postcards: true, loot: true });
      }, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(() => {
        setMountedSections({ badges: true, postcards: true, loot: true });
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
    <div className={cn("space-y-4", isDesktop ? "pt-1" : "mt-4")}>
      <Tabs value={activeSection} onValueChange={handleSectionChange}>
        <TabsList
          className={cn(
            "grid grid-cols-3 h-10",
            isDesktop ? "inline-grid w-auto min-w-[420px]" : "w-full",
          )}
        >
          <TabsTrigger value="badges" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            <span className={cn(isDesktop ? "inline" : "hidden sm:inline")}>Badges</span>
          </TabsTrigger>
          <TabsTrigger value="postcards" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span className={cn(isDesktop ? "inline" : "hidden sm:inline")}>Postcards</span>
          </TabsTrigger>
          <TabsTrigger value="loot" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            <span className={cn(isDesktop ? "inline" : "hidden sm:inline")}>Loot</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="badges" forceMount className="mt-4 data-[state=inactive]:hidden">
          {mountedSections.badges && <BadgesCollectionPanel layoutMode={layoutMode} />}
        </TabsContent>

        <TabsContent value="postcards" forceMount className="mt-4 data-[state=inactive]:hidden">
          {mountedSections.postcards && <CompanionPostcards layoutMode={layoutMode} />}
        </TabsContent>

        <TabsContent value="loot" forceMount className="mt-4 data-[state=inactive]:hidden">
          {mountedSections.loot && <RewardInventory layoutMode={layoutMode} />}
        </TabsContent>
      </Tabs>
    </div>
  );
});

CollectionTab.displayName = 'CollectionTab';
