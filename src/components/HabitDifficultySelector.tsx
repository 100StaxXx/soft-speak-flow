import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Flame, Zap, Mountain } from "lucide-react";
import { HABIT_XP_REWARDS } from "@/config/xpRewards";
import { DIFFICULTY_COLORS } from "@/components/quest-shared";
import { cn } from "@/lib/utils";

interface HabitDifficultySelectorProps {
  value: "easy" | "medium" | "hard";
  onChange: (value: "easy" | "medium" | "hard") => void;
  variant?: "default" | "quest-soft";
  idPrefix?: string;
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
  variant = "default",
  idPrefix,
}: HabitDifficultySelectorProps) => {
  const isQuestSoft = variant === "quest-soft";

  return (
    <div className="space-y-3">
      <Label className={cn("text-sm font-bold", isQuestSoft && "text-[#5d2a0f]")}>
        Difficulty (affects XP reward)
      </Label>
      <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-3 gap-3">
        {difficultyOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;
          const optionId = idPrefix ? `${idPrefix}-${option.value}` : option.value;

          return (
            <div key={option.value} className="relative">
              <RadioGroupItem value={option.value} id={optionId} className="peer sr-only" />
              <Label
                htmlFor={optionId}
                className={cn(
                  isQuestSoft
                    ? "flex min-h-[5.75rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-[16px] border-[3px] px-2.5 py-3 text-center transition-all duration-200 ease-out active:scale-[0.98] motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    : "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-muted bg-background p-4 transition-all hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary",
                  isQuestSoft && (
                    isSelected
                      ? DIFFICULTY_COLORS[option.value].difficultyActive
                      : "border-[#6b3416] bg-white/60 text-[#6b3416]/82 shadow-[0_4px_0_rgba(77,40,17,0.16)] hover:bg-white/75 hover:text-[#4f240c]"
                  ),
                )}
              >
                <span
                  className={cn(
                    isQuestSoft
                      ? "flex h-7 w-7 items-center justify-center rounded-full border-2"
                      : "",
                    isQuestSoft && (
                      isSelected
                        ? DIFFICULTY_COLORS[option.value].iconBubble
                        : "border-[#6b3416]/35 bg-white/55 text-[#7f4a1d]/80"
                    ),
                  )}
                >
                  <Icon className={isQuestSoft ? "h-[1.125rem] w-[1.125rem]" : option.defaultIconClassName} />
                </span>
                <span className="font-semibold">{option.label}</span>
                <span className={cn("text-xs", isQuestSoft ? "text-[#7f4a1d]/80" : "text-muted-foreground")}>
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
