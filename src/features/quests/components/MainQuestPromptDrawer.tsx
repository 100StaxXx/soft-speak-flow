import { Star, Scroll } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface MainQuestPromptDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetMainQuest: () => void;
  onSetSideQuest: () => void;
  isAdding: boolean;
}

export function MainQuestPromptDrawer({
  open,
  onOpenChange,
  onSetMainQuest,
  onSetSideQuest,
  isAdding,
}: MainQuestPromptDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-[hsl(45,100%,60%)]" />
            Set as Main Quest?
          </DrawerTitle>
          <DrawerDescription>
            Main Quests get 1.5x XP and appear prominently at the top. You can only have one Main Quest per day.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button 
            onClick={onSetMainQuest}
            disabled={isAdding}
            className="gap-2"
          >
            <Star className="h-4 w-4" />
            Set as Main Quest
          </Button>
          <Button 
            variant="outline" 
            onClick={onSetSideQuest}
            disabled={isAdding}
            className="gap-2"
          >
            <Scroll className="h-4 w-4" />
            Add as Side Quest
          </Button>
          <DrawerClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
