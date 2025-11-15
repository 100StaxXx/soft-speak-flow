import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface FilterBarProps {
  categories: string[];
  selectedCategory: string | null;
  onCategorySelect: (category: string | null) => void;
}

export const FilterBar = ({ categories, selectedCategory, onCategorySelect }: FilterBarProps) => {
  return (
    <div className="flex gap-2 flex-wrap">
      {selectedCategory && (
        <Badge
          variant="default"
          className="cursor-pointer hover:bg-primary/80 transition-colors"
          onClick={() => onCategorySelect(null)}
        >
          {selectedCategory}
          <X className="h-3 w-3 ml-1" />
        </Badge>
      )}
      {!selectedCategory && categories.map((category) => (
        <Button
          key={category}
          variant="outline"
          size="sm"
          onClick={() => onCategorySelect(category)}
          className="rounded-full"
        >
          {category}
        </Button>
      ))}
    </div>
  );
};
