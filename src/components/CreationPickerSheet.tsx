import { memo } from "react";
import { Sword, Map } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

interface CreationPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectQuest: () => void;
  onSelectCampaign: () => void;
}

export const CreationPickerSheet = memo(function CreationPickerSheet({
  open,
  onOpenChange,
  onSelectQuest,
  onSelectCampaign,
}: CreationPickerSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[300px]">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle>Create</DrawerTitle>
          <DrawerDescription>What would you like to add?</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              onOpenChange(false);
              onSelectQuest();
            }}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-muted/50 active:scale-[0.97] transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
              <Sword className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-medium">Quest</span>
            <span className="text-xs text-muted-foreground text-center leading-tight">
              A task for today or any day
            </span>
          </button>

          <button
            onClick={() => {
              onOpenChange(false);
              onSelectCampaign();
            }}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-muted/50 active:scale-[0.97] transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center">
              <Map className="w-5 h-5 text-accent" />
            </div>
            <span className="text-sm font-medium">Campaign</span>
            <span className="text-xs text-muted-foreground text-center leading-tight">
              A multi-day journey with rituals
            </span>
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
});
