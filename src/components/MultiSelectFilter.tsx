import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  mutuallyExclusiveGroups?: string[][];
}

export const MultiSelectFilter = ({
  label,
  options,
  selectedValues,
  onSelectionChange,
  mutuallyExclusiveGroups = [],
}: MultiSelectFilterProps) => {
  const toggleOption = (value: string) => {
    let newValues: string[];
    
    if (selectedValues.includes(value)) {
      // Deselect the value
      newValues = selectedValues.filter(v => v !== value);
    } else {
      // Check if this value is in any mutually exclusive group
      const exclusiveGroup = mutuallyExclusiveGroups.find(group => group.includes(value));
      
      if (exclusiveGroup) {
        // Remove any other values from the same exclusive group
        newValues = selectedValues.filter(v => !exclusiveGroup.includes(v));
        newValues.push(value);
      } else {
        newValues = [...selectedValues, value];
      }
    }
    
    onSelectionChange(newValues);
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        {selectedValues.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-7 text-xs"
          >
            Clear all
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selectedValues.includes(option);
          return (
            <Badge
              key={option}
              variant={isSelected ? "default" : "outline"}
              className={`cursor-pointer transition-all duration-200 hover:scale-105 capitalize ${
                isSelected
                  ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-soft"
                  : "hover:bg-accent/50"
              }`}
              onClick={() => toggleOption(option)}
            >
              {option}
              {isSelected && <X className="ml-1 h-3 w-3" />}
            </Badge>
          );
        })}
      </div>
    </div>
  );
};
