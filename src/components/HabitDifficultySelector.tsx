import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Flame, Zap, Mountain } from "lucide-react";
import { HABIT_XP_REWARDS } from "@/config/xpRewards";

interface HabitDifficultySelectorProps {
  value: "easy" | "medium" | "hard";
  onChange: (value: "easy" | "medium" | "hard") => void;
}

export const HabitDifficultySelector = ({ value, onChange }: HabitDifficultySelectorProps) => {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-bold">Difficulty (affects XP reward)</Label>
      <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-3 gap-3">
        <div className="relative">
          <RadioGroupItem value="easy" id="easy" className="peer sr-only" />
          <Label
            htmlFor="easy"
            className="flex flex-col items-center gap-2 rounded-lg border-2 border-muted bg-background p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-all"
          >
            <Zap className="h-5 w-5 text-green-500" />
            <span className="font-semibold">Easy</span>
            <span className="text-xs text-muted-foreground">+{HABIT_XP_REWARDS.EASY} XP</span>
          </Label>
        </div>

        <div className="relative">
          <RadioGroupItem value="medium" id="medium" className="peer sr-only" />
          <Label
            htmlFor="medium"
            className="flex flex-col items-center gap-2 rounded-lg border-2 border-muted bg-background p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-all"
          >
            <Flame className="h-5 w-5 text-orange-500" />
            <span className="font-semibold">Medium</span>
            <span className="text-xs text-muted-foreground">+{HABIT_XP_REWARDS.MEDIUM} XP</span>
          </Label>
        </div>

        <div className="relative">
          <RadioGroupItem value="hard" id="hard" className="peer sr-only" />
          <Label
            htmlFor="hard"
            className="flex flex-col items-center gap-2 rounded-lg border-2 border-muted bg-background p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-all"
          >
            <Mountain className="h-6 w-6 text-red-500" />
            <span className="font-semibold">Hard</span>
            <span className="text-xs text-muted-foreground">+{HABIT_XP_REWARDS.HARD} XP</span>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
};
