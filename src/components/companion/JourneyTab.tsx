import { memo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, MapPin } from "lucide-react";
import { CompanionStoryJournal } from "@/components/CompanionStoryJournal";
import { CompanionPostcards } from "@/components/companion/CompanionPostcards";

interface JourneyTabProps {
  unreadStoryCount?: number;
}

export const JourneyTab = memo(({ unreadStoryCount = 0 }: JourneyTabProps) => {
  const [activeSection, setActiveSection] = useState<"stories" | "postcards">("stories");

  return (
    <div className="space-y-4 mt-4">
      <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as "stories" | "postcards")}>
        <TabsList className="grid w-full grid-cols-2 h-10">
          <TabsTrigger value="stories" className="flex items-center gap-2 relative">
            <BookOpen className="h-4 w-4" />
            <span>Stories</span>
            {unreadStoryCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                {unreadStoryCount > 9 ? '9+' : unreadStoryCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="postcards" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>Postcards</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stories" className="mt-4">
          <CompanionStoryJournal />
        </TabsContent>

        <TabsContent value="postcards" className="mt-4">
          <CompanionPostcards />
        </TabsContent>
      </Tabs>
    </div>
  );
});

JourneyTab.displayName = 'JourneyTab';
