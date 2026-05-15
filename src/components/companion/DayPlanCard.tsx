import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlarmClock,
  Brain,
  CheckCircle2,
  Coffee,
  Dumbbell,
  Home,
  Leaf,
  Loader2,
  Lock,
  Palette,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { plannerPathfinderTheme } from "@/components/companion/plannerPathfinderTheme";
import { formatTime12 } from "@/components/quest-shared";
import { formatDurationLabel } from "@/components/scheduling/shared";
import { cn } from "@/lib/utils";
import type {
  CompanionDayPlan,
  CompanionDayPlanBlock,
  CompanionDayPlanBlockEnergyType,
} from "@/types/companionPlanner";

interface DayPlanCardProps {
  dayPlan: CompanionDayPlan;
  committed: boolean;
  committing: boolean;
  onCommit: () => void;
  /** Current local minute-of-day, used to flag overdue blocks. Defaults to live wall-clock. */
  nowMinutes?: number;
  /** Quest ids the caller knows are completed; overrides "overdue" to false. */
  completedQuestIds?: ReadonlySet<string>;
}

const minutesOfDay = (date: Date): number =>
  date.getHours() * 60 + date.getMinutes();

const blockEndMinutes = (block: CompanionDayPlanBlock): number | null => {
  if (!block.startTime) return null;
  const [hh, mm] = block.startTime.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm + Math.max(5, Math.round(block.durationMinutes));
};

export const isBlockOverdue = (
  block: CompanionDayPlanBlock,
  options: {
    isCommitted: boolean;
    nowMinutes: number;
    completedQuestIds?: ReadonlySet<string>;
  },
): boolean => {
  if (!options.isCommitted) return false;
  if (!block.startTime) return false;
  if (
    block.questId &&
    options.completedQuestIds?.has(block.questId)
  ) {
    return false;
  }
  const end = blockEndMinutes(block);
  return end !== null && options.nowMinutes >= end;
};

const energyMeta: Record<
  CompanionDayPlanBlockEnergyType,
  { label: string; icon: typeof Brain; tint: string }
> = {
  deep: { label: "Deep", icon: Brain, tint: "bg-celestial-blue/10 text-celestial-blue" },
  admin: { label: "Admin", icon: Home, tint: "bg-stage-tier-2/10 text-stage-tier-2" },
  physical: {
    label: "Physical",
    icon: Dumbbell,
    tint: "bg-category-body/10 text-category-body",
  },
  errand: { label: "Errand", icon: Home, tint: "bg-stardust-gold/10 text-stardust-gold" },
  social: { label: "Social", icon: Users, tint: "bg-nebula-pink/10 text-nebula-pink" },
  creative: {
    label: "Creative",
    icon: Palette,
    tint: "bg-category-soul/10 text-category-soul",
  },
  recovery: {
    label: "Recovery",
    icon: Leaf,
    tint: "bg-epic-nature/10 text-epic-nature",
  },
};

const formatBlockTime = (block: CompanionDayPlanBlock): string => {
  if (!block.startTime) return "Flexible";
  return formatTime12(block.startTime);
};

const formatBlockDuration = (block: CompanionDayPlanBlock): string =>
  formatDurationLabel(block.durationMinutes) ?? `${block.durationMinutes} min`;

const formatBlockRange = (block: CompanionDayPlanBlock): string => {
  if (!block.startTime) return "Flexible";
  const [hh, mm] = block.startTime.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return formatBlockTime(block);
  const startMinutes = hh * 60 + mm;
  const endMinutes = startMinutes + block.durationMinutes;
  const endH = Math.floor(endMinutes / 60) % 24;
  const endM = endMinutes % 60;
  const endLabel = formatTime12(
    `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
  );
  return `${formatBlockTime(block)} – ${endLabel}`;
};

const SOURCE_LABELS: Record<CompanionDayPlanBlock["source"], string> = {
  campaign: "Campaign",
  habit: "Habit",
  recovery: "Recovery",
  optimization: "Smart pick",
};

const formatPlanDateLabel = (date: string): string => {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
};

const totalDuration = (blocks: CompanionDayPlanBlock[]): number =>
  blocks.reduce((sum, block) => sum + block.durationMinutes, 0);

export function DayPlanCard({
  dayPlan,
  committed,
  committing,
  onCommit,
  nowMinutes,
  completedQuestIds,
}: DayPlanCardProps) {
  const blocks = dayPlan.blocks;
  const dateLabel = formatPlanDateLabel(dayPlan.date);
  const total = totalDuration(blocks);
  const isCommitted = committed || dayPlan.status === "committed";
  const [liveNowMinutes, setLiveNowMinutes] = useState<number>(() =>
    minutesOfDay(new Date())
  );
  useEffect(() => {
    if (!isCommitted) return;
    if (typeof nowMinutes === "number") return;
    const interval = setInterval(() => {
      setLiveNowMinutes(minutesOfDay(new Date()));
    }, 60_000);
    return () => clearInterval(interval);
  }, [isCommitted, nowMinutes]);
  const effectiveNowMinutes = typeof nowMinutes === "number"
    ? nowMinutes
    : liveNowMinutes;
  const overdueBlockIds = new Set<string>(
    blocks
      .filter((block) =>
        isBlockOverdue(block, {
          isCommitted,
          nowMinutes: effectiveNowMinutes,
          completedQuestIds,
        })
      )
      .map((block) => block.id),
  );
  const overdueCount = overdueBlockIds.size;

  return (
    <motion.section
      data-testid="companion-day-plan-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(plannerPathfinderTheme.raisedPanel, "w-full p-4 sm:p-5")}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={plannerPathfinderTheme.sectionEyebrow}>
            {isCommitted ? "Plan locked in" : "Cosmiq's draft plan"}
          </p>
          <h3 className="mt-1 truncate text-base font-semibold text-foreground sm:text-lg">
            {dateLabel}
          </h3>
        </div>
        <Badge
          variant="outline"
          className={cn(
            plannerPathfinderTheme.chip,
            "px-3 py-1 text-[11px] font-medium",
          )}
        >
          {blocks.length} {blocks.length === 1 ? "quest" : "quests"} ·{" "}
          {formatDurationLabel(total) ?? `${total} min`}
        </Badge>
      </header>

      {overdueCount > 0
        ? (
          <div
            data-testid="companion-day-plan-overdue-hint"
            className={cn(
              "mt-3 flex items-center gap-2 rounded-2xl border-[2px] border-category-body/45 bg-category-body/10 px-3 py-2 text-[12px] font-medium text-category-body",
            )}
          >
            <AlarmClock className="h-4 w-4" aria-hidden />
            <span>
              {overdueCount === 1
                ? "1 block is past its time — chat to adjust if it shifted."
                : `${overdueCount} blocks are past their time — chat to adjust if any shifted.`}
            </span>
          </div>
        )
        : null}

      <ol className="mt-4 space-y-2">
        <AnimatePresence initial={false}>
          {blocks.map((block, index) => {
            const energyKey = block.energyType ?? null;
            const energy = energyKey ? energyMeta[energyKey] : null;
            const Icon = energy?.icon ?? Coffee;
            const overdue = overdueBlockIds.has(block.id);
            return (
              <motion.li
                key={block.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 4 }}
                transition={{ delay: index * 0.04, duration: 0.18 }}
                data-overdue={overdue ? "true" : undefined}
                className={cn(
                  plannerPathfinderTheme.mutedPanel,
                  "flex items-stretch gap-3 p-3",
                  overdue && "ring-2 ring-category-body/45",
                )}
              >
                <div className="flex w-20 shrink-0 flex-col justify-center text-foreground">
                  <span className="text-sm font-semibold leading-tight">
                    {formatBlockTime(block)}
                  </span>
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {formatBlockDuration(block)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {block.title}
                  </p>
                  {block.reasoning
                    ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                        {block.reasoning}
                      </p>
                    )
                    : null}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {energy
                      ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border border-celestial-blue/25 px-2 py-0.5",
                            energy.tint,
                          )}
                        >
                          <Icon className="h-3 w-3" aria-hidden />
                          {energy.label}
                        </span>
                      )
                      : null}
                    <span className="rounded-full border border-stardust-gold/25 bg-card/60 px-2 py-0.5 text-foreground">
                      {SOURCE_LABELS[block.source]}
                    </span>
                    {block.startTime
                      ? (
                        <span className="rounded-full border border-celestial-blue/25 bg-card/50 px-2 py-0.5 text-muted-foreground">
                          {formatBlockRange(block)}
                        </span>
                      )
                      : null}
                    {overdue
                      ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-category-body/45 bg-category-body/10 px-2 py-0.5 text-category-body"
                          data-testid="companion-day-plan-overdue-badge"
                        >
                          <AlarmClock className="h-3 w-3" aria-hidden />
                          Past time
                        </span>
                      )
                      : null}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {isCommitted
            ? "These are now in today's quests."
            : "Review the plan, then lock it in to drop these into today's quests."}
        </p>
        {isCommitted
          ? (
            <Badge
              className={cn(
                plannerPathfinderTheme.successCard,
                "gap-1 border px-3 py-1 text-[12px] font-semibold",
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Locked in
            </Badge>
          )
          : (
            <Button
              type="button"
              size="sm"
              onClick={onCommit}
              disabled={committing || blocks.length === 0}
              className={cn(plannerPathfinderTheme.primaryButton, "px-4")}
              data-testid="companion-day-plan-commit"
            >
              {committing
                ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                : <Lock className="mr-1.5 h-4 w-4" />}
              {committing ? "Locking in…" : "Lock in plan"}
            </Button>
          )}
      </div>
    </motion.section>
  );
}
