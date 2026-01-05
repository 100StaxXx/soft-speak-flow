import { List, LayoutGrid } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface CalendarViewToggleProps {
  view: 'timeline' | 'grid';
  onChange: (view: 'timeline' | 'grid') => void;
}

export const CalendarViewToggle = ({ view, onChange }: CalendarViewToggleProps) => {
  return (
    <ToggleGroup 
      type="single" 
      value={view} 
      onValueChange={(value) => value && onChange(value as 'timeline' | 'grid')}
      className="bg-muted/50 rounded-lg p-0.5"
    >
      <ToggleGroupItem 
        value="timeline" 
        aria-label="Timeline view"
        className="h-7 w-7 data-[state=on]:bg-background data-[state=on]:shadow-sm"
      >
        <List className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem 
        value="grid" 
        aria-label="Grid view"
        className="h-7 w-7 data-[state=on]:bg-background data-[state=on]:shadow-sm"
      >
        <LayoutGrid className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
};
