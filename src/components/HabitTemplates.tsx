import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Dumbbell, Droplet, Sun, Smartphone, Cigarette, Plus } from "lucide-react";

const HABIT_TEMPLATES = [
  {
    id: "gym",
    title: "Hit the gym",
    icon: Dumbbell,
    frequency: "daily",
  },
  {
    id: "water",
    title: "Drink more water",
    icon: Droplet,
    frequency: "daily",
  },
  {
    id: "wake",
    title: "Wake up earlier",
    icon: Sun,
    frequency: "daily",
  },
  {
    id: "phone",
    title: "No phone after midnight",
    icon: Smartphone,
    frequency: "daily",
  },
  {
    id: "smoking",
    title: "Stop smoking",
    icon: Cigarette,
    frequency: "daily",
  },
];

interface HabitTemplatesProps {
  onSelect: (title: string, frequency: string) => void;
  onCustom: () => void;
}

export const HabitTemplates = ({ onSelect, onCustom }: HabitTemplatesProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-heading font-bold text-foreground">Choose a habit</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {HABIT_TEMPLATES.map((template) => {
          const Icon = template.icon;
          return (
            <Card
              key={template.id}
              className="p-4 cursor-pointer hover:border-primary/50 transition-all hover:bg-card/80"
              onClick={() => onSelect(template.title, template.frequency)}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">{template.title}</span>
              </div>
            </Card>
          );
        })}
        <Card
          className="p-4 cursor-pointer hover:border-primary/50 transition-all hover:bg-card/80 border-dashed"
          onClick={onCustom}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Plus className="w-5 h-5 text-accent" />
            </div>
            <span className="text-sm font-medium text-foreground">Create custom habit</span>
          </div>
        </Card>
      </div>
    </div>
  );
};