import { Card } from "./ui/card";
import { 
  Dumbbell, Droplet, Sun, Smartphone, Cigarette, Plus, 
  Book, Utensils, Moon, Bike, Coffee, BedDouble,
  Apple, Brain, Music, MessageCircle, Heart
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

const HABIT_TEMPLATES = [
  // Top featured habits
  { id: "gym", title: "Hit the gym", icon: Dumbbell, frequency: "daily", featured: true },
  { id: "water", title: "Drink more water", icon: Droplet, frequency: "daily", featured: true },
  { id: "wake", title: "Wake up earlier", icon: Sun, frequency: "daily", featured: true },
  { id: "phone", title: "No phone after midnight", icon: Smartphone, frequency: "daily", featured: true },
  { id: "smoking", title: "Stop smoking", icon: Cigarette, frequency: "daily", featured: true },
  
  // Additional habits (in dropdown)
  { id: "read", title: "Read for 30 minutes", icon: Book, frequency: "daily", featured: false },
  { id: "meditate", title: "Meditate daily", icon: Brain, frequency: "daily", featured: false },
  { id: "cook", title: "Cook a healthy meal", icon: Utensils, frequency: "daily", featured: false },
  { id: "sleep", title: "Sleep by 10 PM", icon: Moon, frequency: "daily", featured: false },
  { id: "exercise", title: "Exercise 30 minutes", icon: Bike, frequency: "daily", featured: false },
  { id: "no_coffee", title: "No coffee after 2 PM", icon: Coffee, frequency: "daily", featured: false },
  { id: "bed_time", title: "Consistent bedtime", icon: BedDouble, frequency: "daily", featured: false },
  { id: "fruits", title: "Eat 2 servings of fruit", icon: Apple, frequency: "daily", featured: false },
  { id: "journal", title: "Write in journal", icon: Book, frequency: "daily", featured: false },
  { id: "music", title: "Practice instrument", icon: Music, frequency: "daily", featured: false },
  { id: "call", title: "Call a friend/family", icon: MessageCircle, frequency: "weekly", featured: false },
  { id: "stretch", title: "Stretch for 10 minutes", icon: Heart, frequency: "daily", featured: false },
  { id: "walk", title: "Take a 15-min walk", icon: Bike, frequency: "daily", featured: false },
];

interface HabitTemplatesProps {
  onSelect: (title: string, frequency: string) => void;
  onCustom: () => void;
  existingHabits: Array<{ title: string }>;
}

export const HabitTemplates = ({ onSelect, onCustom, existingHabits }: HabitTemplatesProps) => {
  const [selectedFromDropdown, setSelectedFromDropdown] = useState<string>("");
  
  const featuredTemplates = HABIT_TEMPLATES.filter(t => t.featured);
  const dropdownTemplates = HABIT_TEMPLATES.filter(t => !t.featured);
  
  // Check if a habit already exists
  const isHabitUsed = (title: string) => {
    return existingHabits.some(h => h.title.toLowerCase() === title.toLowerCase());
  };

  const handleDropdownSelect = (templateId: string) => {
    const template = dropdownTemplates.find(t => t.id === templateId);
    if (template && !isHabitUsed(template.title)) {
      onSelect(template.title, template.frequency);
      setSelectedFromDropdown("");
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-heading font-bold text-foreground">Choose a habit</h3>
      
      {/* Featured habits grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {featuredTemplates.map((template) => {
          const Icon = template.icon;
          const isUsed = isHabitUsed(template.title);
          
          const handleSelect = () => {
            if (!isUsed) onSelect(template.title, template.frequency);
          };

          const handleTouchEnd = (e: React.TouchEvent) => {
            e.preventDefault();
            handleSelect();
          };
          
          return (
            <Card
              key={template.id}
              className={`p-4 transition-all select-none ${
                isUsed 
                  ? 'opacity-50 cursor-not-allowed bg-muted' 
                  : 'cursor-pointer sm:hover:border-primary/50 sm:hover:bg-card/80 active:scale-[0.98]'
              }`}
              onClick={handleSelect}
              onTouchEnd={handleTouchEnd}
              role="button"
              tabIndex={isUsed ? -1 : 0}
              style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isUsed ? 'bg-muted-foreground/10' : 'bg-primary/10'}`}>
                  <Icon className={`w-5 h-5 ${isUsed ? 'text-muted-foreground' : 'text-primary'}`} />
                </div>
                <div className="flex-1">
                  <span className={`text-sm font-medium ${isUsed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                    {template.title}
                  </span>
                  {isUsed && <span className="text-xs text-muted-foreground block">Already added</span>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* More habits dropdown */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Or choose from more habits</label>
        <Select value={selectedFromDropdown} onValueChange={handleDropdownSelect}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Browse more habit ideas..." />
          </SelectTrigger>
          <SelectContent className="max-h-80 bg-card border-border">
            {dropdownTemplates.map((template) => {
              const Icon = template.icon;
              const isUsed = isHabitUsed(template.title);
              
              return (
                <SelectItem 
                  key={template.id} 
                  value={template.id}
                  disabled={isUsed}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-3 py-1">
                    <Icon className={`w-4 h-4 ${isUsed ? 'text-muted-foreground' : 'text-primary'}`} />
                    <span className={isUsed ? 'line-through text-muted-foreground' : ''}>
                      {template.title}
                      {isUsed && ' (Already added)'}
                    </span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Custom habit button */}
      <Card
        className="p-4 cursor-pointer sm:hover:border-primary/50 transition-all sm:hover:bg-card/80 border-dashed select-none active:scale-[0.98]"
        onClick={onCustom}
        onTouchEnd={(e) => {
          e.preventDefault();
          onCustom();
        }}
        role="button"
        tabIndex={0}
        style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <Plus className="w-5 h-5 text-accent" />
          </div>
          <span className="text-sm font-medium text-foreground">Create custom habit</span>
        </div>
      </Card>
    </div>
  );
};
