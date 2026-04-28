import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Flame, Zap, Mountain } from "lucide-react";
import { HABIT_XP_REWARDS } from "@/config/xpRewards";

interface HabitDifficultySelectorProps {
  value: "easy" | "medium" | "hard";
  onChange: (value: "easy" | "medium" | "hard") => void;
}

const difficultyOptions: Array<{
  value: "easy" | "medium" | "hard";
  label: string;
  xp: number;
  icon: typeof Zap;
  defaultIconClassName: string;
}> = [
  {
    value: "easy",
    label: "Easy",
    xp: HABIT_XP_REWARDS.EASY,
    icon: Zap,
    defaultIconClassName: "h-5 w-5 text-green-500",
  },
  {
    value: "medium",
    label: "Medium",
    xp: HABIT_XP_REWARDS.MEDIUM,
    icon: Flame,
    defaultIconClassName: "h-5 w-5 text-orange-500",
  },
  {
    value: "hard",
    label: "Hard",
    xp: HABIT_XP_REWARDS.HARD,
    icon: Mountain,
    defaultIconClassName: "h-6 w-6 text-red-500",
  },
];

export const HabitDifficultySelector = ({
  value,
  onChange,
}: HabitDifficultySelectorProps) => {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-bold">Difficulty (affects XP reward)</Label>
      <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-3 gap-3">
        {difficultyOptions.map((option) => {
          const Icon = option.icon;

          return (
            <div key={option.value} className="relative">
              <RadioGroupItem value={option.value} id={option.value} className="peer sr-only" />
              <Label
                htmlFor={option.value}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-muted bg-background p-4 transition-all hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary"
              >
                <Icon className={option.defaultIconClassName} />
                <span className="font-semibold">{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  +{option.xp} XP
                </span>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
};
