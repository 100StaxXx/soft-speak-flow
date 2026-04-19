import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  Send,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompanionPlannerStarterIntent } from "@/types/companionPlanner";

interface Task {
  id: string;
  task_text: string;
  scheduled_time?: string | null;
  completed?: boolean | null;
  ai_generated?: boolean | null;
}

interface QuickAdjustDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  selectedDate: Date;
  onLaunchPlanner: (message: string, starterIntent: CompanionPlannerStarterIntent) => void;
  onComplete: () => void;
}

interface QuickAction {
  icon: ReactNode;
  label: string;
  prompt: string;
  starterIntent: CompanionPlannerStarterIntent;
}

export function QuickAdjustDrawer({
  open,
  onOpenChange,
  tasks,
  onLaunchPlanner,
  onComplete,
}: QuickAdjustDrawerProps) {
  const [input, setInput] = useState("");

  const incompleteTasks = useMemo(
    () => tasks.filter((task) => !task.completed),
    [tasks],
  );

  const quickActions = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const actions: QuickAction[] = [];

    if (incompleteTasks.length > 3 && currentHour > 14) {
      actions.push({
        icon: <Target className="h-4 w-4" />,
        label: "Focus on top 3",
        prompt: "Keep only the 3 most important remaining tasks for today and move the rest to tomorrow.",
        starterIntent: "what_matters",
      });
    }

    if (incompleteTasks.length > 0) {
      actions.push({
        icon: <Clock className="h-4 w-4" />,
        label: "Push all by 1 hour",
        prompt: "Push all remaining tasks back by 1 hour.",
        starterIntent: "adjust_today",
      });
    }

    if (incompleteTasks.length > 2) {
      actions.push({
        icon: <Calendar className="h-4 w-4" />,
        label: "Move rest to tomorrow",
        prompt: "Move all remaining incomplete tasks to tomorrow.",
        starterIntent: "adjust_today",
      });
    }

    actions.push({
      icon: <Sparkles className="h-4 w-4" />,
      label: "Reschedule smarter",
      prompt: "I am tired today. Reorganize the remaining tasks based on current time and energy optimization.",
      starterIntent: "low_energy_adjust",
    });

    return actions.slice(0, 4);
  }, [incompleteTasks]);

  const handleAdjust = (
    prompt: string,
    starterIntent: CompanionPlannerStarterIntent,
  ) => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    onLaunchPlanner(trimmedPrompt, starterIntent);
    setInput("");
    onComplete();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[70vh]">
        <DrawerHeader className="pb-2 text-center">
          <div className="mb-2 flex justify-center">
            <div className="rounded-full bg-primary/10 p-2">
              <Wand2 className="h-5 w-5 text-primary" />
            </div>
          </div>
          <DrawerTitle>Quick Adjust</DrawerTitle>
          <DrawerDescription>
            {incompleteTasks.length} task{incompleteTasks.length !== 1 ? "s" : ""} remaining
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-6" data-vaul-no-drag>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action, index) => (
              <motion.button
                key={`${action.label}-${index}`}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleAdjust(action.prompt, action.starterIntent)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-border/50 bg-muted/50 p-3 text-left text-sm",
                  "transition-all hover:border-primary/30 hover:bg-muted",
                )}
              >
                <div className="text-primary">{action.icon}</div>
                <span className="font-medium">{action.label}</span>
              </motion.button>
            ))}
          </div>

          <div className="relative">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Or describe what to change..."
              className="pr-12"
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                handleAdjust(input, "adjust_today");
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
              onClick={() => handleAdjust(input, "adjust_today")}
              disabled={!input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              "Move workout to 6pm",
              "Free me up after 5",
              "I'm tired today, make it light",
            ].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setInput(example)}
                className="rounded-full bg-muted/50 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
