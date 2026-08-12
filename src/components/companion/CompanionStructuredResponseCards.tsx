import { memo, useState, type KeyboardEvent, type ReactNode } from "react";
import { Maximize2, X } from "lucide-react";

import { plannerPathfinderTheme } from "@/components/companion/plannerPathfinderTheme";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type {
  CompanionCampaignHealthSnapshot,
  CompanionStructuredResponse,
  CompanionSuggestedQuest,
} from "@/shared/companionStructuredOutput";

type CompanionStructuredResponseCardsVariant = "journeys" | "companion";
type ComingUpOutput = NonNullable<CompanionStructuredResponse["comingUp"]>;
type ComingUpScheduleItem = ComingUpOutput["remainingToday"][number];
type ComingUpMissedItem = ComingUpOutput["missedItems"][number];
type CompanionStructuredResponseCardStyles =
  (typeof variantStyles)[CompanionStructuredResponseCardsVariant];

interface CompanionStructuredResponseCardsProps {
  structuredResponse?: CompanionStructuredResponse | null;
  variant: CompanionStructuredResponseCardsVariant;
  className?: string;
}

const variantStyles = {
  journeys: {
    card:
      "rounded-[1.7rem] border-[3px] border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,247,229,0.96),rgba(255,215,137,0.92))] text-[#5b2e13] shadow-[0_10px_0_rgba(77,40,17,0.82),0_24px_40px_-28px_rgba(36,12,4,0.45)]",
    title:
      "text-[0.72rem] font-black uppercase tracking-[0.22em] text-[#8c5a25]",
    body: "text-sm leading-6 text-[#5b2e13]",
    subtext: "text-sm text-[#7a4a21]",
    item:
      "rounded-[1.25rem] border-[3px] border-[#6d3518] bg-[linear-gradient(180deg,#fff9ef_0%,#ffe5af_100%)] px-4 py-3 shadow-[0_6px_0_rgba(109,53,24,0.82)]",
    accent:
      "rounded-full border-[2px] border-[#6d3518] bg-white/60 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#8b4d1d]",
  },
  companion: {
    card: plannerPathfinderTheme.raisedPanel,
    title: plannerPathfinderTheme.sectionEyebrow,
    body: "text-sm leading-6 text-foreground",
    subtext: "text-sm text-muted-foreground",
    item:
      "rounded-[1.35rem] border border-[hsl(var(--celestial-blue)_/_0.36)] bg-card/[0.82] px-4 py-3 text-foreground shadow-[0_12px_30px_-28px_rgba(var(--primary-rgb),0.34),inset_0_1px_0_rgba(255,255,255,0.7)]",
    accent:
      "rounded-full border border-[hsl(var(--celestial-blue)_/_0.38)] bg-card/[0.78] px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.18em] text-foreground",
  },
} as const;

const formatCampaignInterventionLabel = (
  level: NonNullable<
    NonNullable<CompanionStructuredResponse["campaignMomentum"]>["interventionLevel"]
  >,
): string =>
  level === "reset"
    ? "reset"
    : level === "protect"
    ? "protect"
    : level === "nudge"
    ? "nudge"
    : "steady";

const formatPlanDayStatusLabel = (
  value: string | null | undefined,
): string => {
  if (!value) return "Open";
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
};

const normalizeComingUpKeyPart = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const normalizeComingUpTimestamp = (
  value: string | null | undefined,
): string =>
  normalizeComingUpKeyPart(value).replace(/\.\d{3}z$/i, "z").slice(0, 16);

const parseComingUpClockMinutes = (
  value: string | null | undefined,
): number | null => {
  if (!value) return null;

  const twelveHourMatch = value.match(
    /\b(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i,
  );
  if (twelveHourMatch) {
    const rawHour = Number(twelveHourMatch[1]);
    const minute = Number(twelveHourMatch[2] ?? "0");
    if (rawHour >= 1 && rawHour <= 12) {
      const meridiem = twelveHourMatch[3].toLowerCase();
      const normalizedHour = rawHour % 12;
      const hour = meridiem.startsWith("p")
        ? normalizedHour + 12
        : normalizedHour;
      return hour * 60 + minute;
    }
  }

  const twentyFourHourMatch = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!twentyFourHourMatch) return null;

  return Number(twentyFourHourMatch[1]) * 60 +
    Number(twentyFourHourMatch[2]);
};

const getComingUpDateClockMinutes = (
  value: string | null | undefined,
): number | null => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.getHours() * 60 + date.getMinutes();
};

const getComingUpStartMinutes = (item: ComingUpScheduleItem): number | null =>
  parseComingUpClockMinutes(item.label) ??
    getComingUpDateClockMinutes(item.startsAt);

const getMissedItemStartMinutes = (item: ComingUpMissedItem): number | null =>
  parseComingUpClockMinutes(item.label);

const getScheduleItemDedupeKey = (item: ComingUpScheduleItem): string => {
  const title = normalizeComingUpKeyPart(item.title);
  const startMinutes = getComingUpStartMinutes(item);
  const label = normalizeComingUpKeyPart(item.label);
  const start = normalizeComingUpTimestamp(item.startsAt);
  const end = normalizeComingUpTimestamp(item.endsAt);
  let temporalKey = label;
  if (startMinutes !== null) {
    temporalKey = `minute:${startMinutes}`;
  } else if (start || end) {
    temporalKey = `${start}|${end}`;
  }

  return `${title}|${temporalKey}|${item.isAllDay ? "all-day" : "timed"}`;
};

const dedupeScheduleItems = (
  items: ComingUpScheduleItem[],
): ComingUpScheduleItem[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getScheduleItemDedupeKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getMissedItemDedupeKey = (item: ComingUpMissedItem): string => {
  const title = normalizeComingUpKeyPart(item.title);
  const startMinutes = getMissedItemStartMinutes(item);
  const label = normalizeComingUpKeyPart(item.label);
  const temporalKey = startMinutes !== null ? `minute:${startMinutes}` : label;
  return `${title}|${temporalKey}`;
};

const dedupeMissedItems = (
  items: ComingUpMissedItem[],
): ComingUpMissedItem[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getMissedItemDedupeKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const scheduleItemMatchesMissedItem = (
  scheduleItem: ComingUpScheduleItem,
  missedItem: ComingUpMissedItem,
): boolean => {
  if (scheduleItem.id === missedItem.id) return true;

  if (
    normalizeComingUpKeyPart(scheduleItem.title) !==
      normalizeComingUpKeyPart(missedItem.title)
  ) {
    return false;
  }

  if (
    normalizeComingUpKeyPart(scheduleItem.label) ===
      normalizeComingUpKeyPart(missedItem.label)
  ) {
    return true;
  }

  const scheduleStartMinutes = getComingUpStartMinutes(scheduleItem);
  const missedStartMinutes = getMissedItemStartMinutes(missedItem);
  return scheduleStartMinutes !== null && missedStartMinutes !== null &&
    scheduleStartMinutes === missedStartMinutes;
};

const scheduleItemsMatch = (
  left: ComingUpScheduleItem,
  right: ComingUpScheduleItem,
): boolean =>
  left.id === right.id ||
  getScheduleItemDedupeKey(left) === getScheduleItemDedupeKey(right);

const formatComingUpScheduleLabel = (
  item: ComingUpScheduleItem,
  section: "today" | "tomorrow",
): string => {
  const label = item.label.trim();
  if (section !== "tomorrow") return label;
  if (/\btomorrow\b/i.test(label)) return label;
  return `Tomorrow, ${label}`;
};

const formatTomorrowSummarySentence = (
  summary: ComingUpOutput["tomorrowSummary"],
): string => {
  switch (summary) {
    case "open":
      return "Tomorrow looks open.";
    case "light":
      return "Tomorrow looks light.";
    case "productive":
      return "Tomorrow looks productive.";
    case "busy":
      return "Tomorrow looks busy. Be intentional with your open gaps.";
    case "overwhelming":
      return "Tomorrow may need a reset before things slip.";
  }
};

const renderCampaignHealthSnapshot = (
  snapshot: CompanionCampaignHealthSnapshot,
  styles: (typeof variantStyles)[CompanionStructuredResponseCardsVariant],
  testId?: string,
) => {
  const chips = [
    `${snapshot.overdueQuestCount} overdue`,
    `${snapshot.protectedTodayCount} protected today`,
    snapshot.recentCompletedQuestCount > 0
      ? `${snapshot.recentCompletedQuestCount} recent ${
        snapshot.recentCompletedQuestCount === 1 ? "win" : "wins"
      }`
      : null,
    snapshot.daysWithoutMomentum !== null
      ? `${snapshot.daysWithoutMomentum} ${
        snapshot.daysWithoutMomentum === 1 ? "day" : "days"
      } quiet`
      : null,
    snapshot.activeCampaignCount > 1
      ? `${snapshot.activeCampaignCount} active commitments`
      : null,
  ].filter((value): value is string => Boolean(value));

  if (chips.length === 0) return null;

  return (
    <div className="mt-3" data-testid={testId}>
      <p className={styles.title}>Health Snapshot</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span key={chip} className={styles.accent}>
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
};

const renderQuestRow = (
  quest: CompanionSuggestedQuest,
  styles: CompanionStructuredResponseCardStyles,
) => {
  return (
    <div key={quest.suggestionId} className={styles.item}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{quest.title}</p>
          <p className={cn("mt-1", styles.subtext)}>{quest.reason}</p>
        </div>
        <span className={styles.accent}>{quest.type}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div
          className={cn(
            "flex flex-wrap gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em]",
            styles.subtext,
          )}
        >
          <span>{quest.estimatedDuration}</span>
          <span>{quest.source.replace(/_/g, " ")}</span>
        </div>
      </div>
    </div>
  );
};

const renderComingUpContent = ({
  comingUp,
  comingUpNextEvent,
  comingUpRemainingToday,
  comingUpTomorrowSchedule,
  comingUpMissedItems,
  styles,
  titleAccessory,
  expanded = false,
}: {
  comingUp: ComingUpOutput;
  comingUpNextEvent: ComingUpOutput["nextEvent"];
  comingUpRemainingToday: ComingUpScheduleItem[];
  comingUpTomorrowSchedule: ComingUpScheduleItem[];
  comingUpMissedItems: ComingUpMissedItem[];
  styles: CompanionStructuredResponseCardStyles;
  titleAccessory?: ReactNode;
  expanded?: boolean;
}) => {
  const itemClassName = cn(styles.item, expanded && "px-5 py-4");
  const bodyClassName = cn(
    "mt-2",
    styles.body,
    expanded && "text-base leading-7",
  );
  const subtextClassName = cn(
    styles.subtext,
    expanded && "text-base leading-7",
  );
  const titleClassName = cn(styles.title, expanded && "text-[0.78rem]");

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={titleClassName}>Coming Up</p>
          <p className={bodyClassName}>{comingUp.message}</p>
        </div>
        {titleAccessory ? (
          <div className="shrink-0 pt-1">{titleAccessory}</div>
        ) : null}
      </div>
      {comingUpNextEvent
        ? (
          <div className={cn("mt-4", itemClassName)}>
            <p className={titleClassName}>Next</p>
            <p className={cn("mt-1 font-semibold", expanded ? "text-base" : "text-sm")}>
              {comingUpNextEvent.title}
            </p>
            <p className={cn("mt-1", subtextClassName)}>
              {comingUpNextEvent.label}
            </p>
          </div>
        )
        : null}
      {comingUp.nextBestAction
        ? (
          <div className={expanded ? "mt-5" : "mt-4"}>
            <p className={titleClassName}>Before That</p>
            <div className="mt-2">
              {renderQuestRow(
                comingUp.nextBestAction,
                styles,
              )}
            </div>
          </div>
        )
        : null}
      <div className={cn(expanded ? "mt-5" : "mt-4", "space-y-2")}>
        {comingUpRemainingToday.length > 0
          ? comingUpRemainingToday.map((item) => (
            <div key={item.id} className={itemClassName}>
              <p className={cn("font-semibold", expanded ? "text-base" : "text-sm")}>
                {item.title}
              </p>
              <p className={cn("mt-1", subtextClassName)}>
                {formatComingUpScheduleLabel(item, "today")}
              </p>
            </div>
          ))
          : (
            <p className={subtextClassName}>
              Nothing else is scheduled for the rest of today.
            </p>
          )}
      </div>
      <p className={cn(expanded ? "mt-5" : "mt-4", subtextClassName)}>
        {formatTomorrowSummarySentence(comingUp.tomorrowSummary)}
      </p>
      {comingUpTomorrowSchedule.length > 0
        ? (
          <div className={expanded ? "mt-4" : "mt-3"}>
            <p className={titleClassName}>Tomorrow</p>
            <div className="mt-2 space-y-2">
              {comingUpTomorrowSchedule.map((item) => (
                <div key={item.id} className={itemClassName}>
                  <p className={cn("font-semibold", expanded ? "text-base" : "text-sm")}>
                    {item.title}
                  </p>
                  <p className={cn("mt-1", subtextClassName)}>
                    {formatComingUpScheduleLabel(item, "tomorrow")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
        : null}
      {comingUpMissedItems.length > 0
        ? (
          <div className={expanded ? "mt-4" : "mt-3"}>
            <p className={titleClassName}>Earlier Today</p>
            <div className="mt-2 space-y-2">
              {comingUpMissedItems.map((item) => (
                <div key={item.id} className={itemClassName}>
                  <p className={cn("font-semibold", expanded ? "text-base" : "text-sm")}>
                    {item.title}
                  </p>
                  <p className={cn("mt-1", subtextClassName)}>
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
        : null}
    </>
  );
};

export const CompanionStructuredResponseCards = memo(
  function CompanionStructuredResponseCards({
    structuredResponse,
    variant,
    className,
  }: CompanionStructuredResponseCardsProps) {
    const [isComingUpExpanded, setIsComingUpExpanded] = useState(false);
    if (!structuredResponse) return null;

    const styles = variantStyles[variant];
    const planDayCampaignFocus =
      structuredResponse.planDay?.campaignFocus ?? null;
    const rawComingUpMissedItems = dedupeMissedItems(
      structuredResponse.comingUp?.missedItems ?? [],
    );
    const rawComingUpNextEvent = structuredResponse.comingUp?.nextEvent ?? null;
    const comingUpNextEvent = rawComingUpNextEvent;
    const comingUpRemainingToday = dedupeScheduleItems(
      structuredResponse.comingUp?.remainingToday ?? [],
    ).filter((item) =>
      (!comingUpNextEvent || !scheduleItemsMatch(item, comingUpNextEvent))
    );
    const comingUpTomorrowSchedule = dedupeScheduleItems(
      structuredResponse.comingUp?.tomorrowSchedule ?? [],
    );
    const comingUpMissedItems = rawComingUpMissedItems.filter((missedItem) =>
      !(comingUpNextEvent &&
        scheduleItemMatchesMissedItem(comingUpNextEvent, missedItem)) &&
      !comingUpRemainingToday.some((item) =>
        scheduleItemMatchesMissedItem(item, missedItem)
      )
    );
    const handleComingUpKeyDown = (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      setIsComingUpExpanded(true);
    };
    const comingUpExpandIcon = (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border text-current shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
          variant === "journeys"
            ? "border-[#6d3518]/55 bg-white/45"
            : "border-[hsl(var(--celestial-blue)_/_0.36)] bg-card/70",
        )}
      >
        <Maximize2 className="h-4 w-4" />
      </span>
    );

    return (
      <div className={cn("space-y-3", className)}>
        {structuredResponse.planDay
          ? (
            <section
              className={cn("p-4", styles.card)}
              data-testid="structured-plan-day"
            >
              <p className={styles.title}>Plan My Day</p>
              <p className={cn("mt-2", styles.body)}>
                {structuredResponse.planDay.message}
              </p>
              <p className={cn("mt-3 text-sm font-medium", styles.subtext)}>
                Day status:{" "}
                {formatPlanDayStatusLabel(
                  structuredResponse.planDay.dailyLoad?.label ??
                    structuredResponse.planDay.dayAssessment,
                )}
              </p>
              {planDayCampaignFocus
                ? (
                  <div
                    className={cn("mt-4", styles.item)}
                    data-testid="structured-plan-day-campaign-focus"
                  >
                    <p className={styles.title}>Journey Focus</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={styles.accent}>
                        {planDayCampaignFocus.campaignTitle}
                      </span>
                      {planDayCampaignFocus.campaignStatus
                        ? (
                          <span className={styles.accent}>
                            {planDayCampaignFocus.campaignStatus.replace(
                              /_/g,
                              " ",
                            )}
                          </span>
                        )
                        : null}
                      {planDayCampaignFocus.campaignInterventionLevel
                        ? (
                          <span className={styles.accent}>
                            {formatCampaignInterventionLabel(
                              planDayCampaignFocus.campaignInterventionLevel,
                            )}
                          </span>
                        )
                        : null}
                    </div>
                    {planDayCampaignFocus.campaignReason
                      ? (
                        <p className={cn("mt-3", styles.subtext)}>
                          {planDayCampaignFocus.campaignReason}
                        </p>
                      )
                      : null}
                    {planDayCampaignFocus.focusItems.length > 0
                      ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {planDayCampaignFocus.focusItems.map((item) => (
                            <span key={item} className={styles.accent}>
                              {item}
                            </span>
                          ))}
                        </div>
                      )
                      : null}
                    {planDayCampaignFocus.campaignHealth
                      ? renderCampaignHealthSnapshot(
                        planDayCampaignFocus.campaignHealth,
                        styles,
                        "structured-plan-day-campaign-health",
                      )
                      : null}
                  </div>
                )
                : null}
              <div className="mt-4 space-y-3">
                {structuredResponse.planDay.suggestedQuests.length > 0
                  ? structuredResponse.planDay.suggestedQuests.map((quest) =>
                    renderQuestRow(quest, styles)
                  )
                  : (
                    <p className={styles.subtext}>
                      No useful action suggestions right now without crowding the
                      day.
                    </p>
                  )}
              </div>
            </section>
          )
          : null}

        {structuredResponse.weeklyPlan
          ? (
            <section
              className={cn("p-4", styles.card)}
              data-testid="structured-weekly-plan"
            >
              <p className={styles.title}>Plan My Week</p>
              <p className={cn("mt-2", styles.body)}>
                {structuredResponse.weeklyPlan.message}
              </p>
              {structuredResponse.weeklyPlan.weeklyTheme
                ? (
                  <div className={cn("mt-4", styles.item)}>
                    <p className={styles.title}>Theme</p>
                    <p className="mt-1 text-sm font-semibold">
                      {structuredResponse.weeklyPlan.weeklyTheme}
                    </p>
                  </div>
                )
                : null}
              {structuredResponse.weeklyPlan.focusCampaignTitle
                ? (
                  <div className={cn("mt-4", styles.item)}>
                    <p className={styles.title}>Journey Focus</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={styles.accent}>
                        {structuredResponse.weeklyPlan.focusCampaignTitle}
                      </span>
                      {structuredResponse.weeklyPlan.focusCampaignStatus
                        ? (
                          <span className={styles.accent}>
                            {structuredResponse.weeklyPlan.focusCampaignStatus.replace(
                              /_/g,
                              " ",
                            )}
                          </span>
                        )
                        : null}
                      {structuredResponse.weeklyPlan.focusCampaignInterventionLevel
                        ? (
                          <span className={styles.accent}>
                            {formatCampaignInterventionLabel(
                              structuredResponse.weeklyPlan.focusCampaignInterventionLevel,
                            )}
                          </span>
                        )
                        : null}
                    </div>
                    {structuredResponse.weeklyPlan.focusCampaignReason
                      ? (
                        <p className={cn("mt-2", styles.subtext)}>
                          {structuredResponse.weeklyPlan.focusCampaignReason}
                        </p>
                      )
                      : null}
                    {structuredResponse.weeklyPlan.focusCampaignHealth
                      ? renderCampaignHealthSnapshot(
                        structuredResponse.weeklyPlan.focusCampaignHealth,
                        styles,
                        "structured-weekly-campaign-health",
                      )
                      : null}
                  </div>
                )
                : null}
              <div className="mt-4">
                <p className={styles.title}>Top Priorities</p>
                <div className="mt-2 space-y-3">
                  {structuredResponse.weeklyPlan.topPriorities.length > 0
                    ? structuredResponse.weeklyPlan.topPriorities.map((quest) =>
                      renderQuestRow(quest, styles)
                    )
                    : (
                      <p className={styles.subtext}>
                        Nothing needs heavy planning here yet.
                      </p>
                    )}
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className={styles.title}>Busy Days</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {structuredResponse.weeklyPlan.busyDays.length > 0
                      ? structuredResponse.weeklyPlan.busyDays.map((day) => (
                        <span key={day} className={styles.accent}>
                          {day}
                        </span>
                      ))
                      : (
                        <p className={styles.subtext}>
                          No heavy pinch points yet.
                        </p>
                      )}
                  </div>
                </div>
                <div>
                  <p className={styles.title}>Open Days</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {structuredResponse.weeklyPlan.openDays.length > 0
                      ? structuredResponse.weeklyPlan.openDays.map((day) => (
                        <span key={day} className={styles.accent}>
                          {day}
                        </span>
                      ))
                      : (
                        <p className={styles.subtext}>
                          No wide-open days right now.
                        </p>
                      )}
                  </div>
                </div>
              </div>
            </section>
          )
          : null}

        {structuredResponse.priorityOverview
          ? (
            <section
              className={cn("p-4", styles.card)}
              data-testid="structured-priority-overview"
            >
              <p className={styles.title}>
                {structuredResponse.priorityOverview.title}
              </p>
              <p className={cn("mt-2", styles.body)}>
                {structuredResponse.priorityOverview.message}
              </p>
              {structuredResponse.priorityOverview.focusCampaignTitle
                ? (
                  <div className={cn("mt-4", styles.item)}>
                    <p className={styles.title}>Focus commitment</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={styles.accent}>
                        {structuredResponse.priorityOverview.focusCampaignTitle}
                      </span>
                      {structuredResponse.priorityOverview.focusCampaignStatus
                        ? (
                          <span className={styles.accent}>
                            {structuredResponse.priorityOverview.focusCampaignStatus.replace(
                              /_/g,
                              " ",
                            )}
                          </span>
                        )
                        : null}
                      {structuredResponse.priorityOverview.focusCampaignInterventionLevel
                        ? (
                          <span className={styles.accent}>
                            {formatCampaignInterventionLabel(
                              structuredResponse.priorityOverview.focusCampaignInterventionLevel,
                            )}
                          </span>
                        )
                        : null}
                    </div>
                    {structuredResponse.priorityOverview.focusCampaignHealth
                      ? renderCampaignHealthSnapshot(
                        structuredResponse.priorityOverview.focusCampaignHealth,
                        styles,
                        "structured-priority-campaign-health",
                      )
                      : null}
                  </div>
                )
                : null}
              {structuredResponse.priorityOverview.campaignPressure
                ? (
                  <div className={cn("mt-4", styles.item)}>
                    <p className={styles.title}>Commitment pressure</p>
                    <p className={cn("mt-1", styles.subtext)}>
                      {structuredResponse.priorityOverview.campaignPressure}
                    </p>
                  </div>
                )
                : null}
              <div className="mt-4">
                <p className={styles.title}>Top Priorities</p>
                <div className="mt-2 space-y-3">
                  {structuredResponse.priorityOverview.topPriorities.length > 0
                    ? structuredResponse.priorityOverview.topPriorities.map(
                      (quest) =>
                        renderQuestRow(quest, styles)
                    )
                    : (
                      <p className={styles.subtext}>
                        Nothing needs a strong push right now.
                      </p>
                    )}
                </div>
              </div>
            </section>
          )
          : null}

        {structuredResponse.reflectionBridge
          ? (
            <section
              className={cn("p-4", styles.card)}
              data-testid="structured-reflection-bridge"
            >
              <p className={styles.title}>Prepare Tomorrow</p>
              <p className={cn("mt-2", styles.body)}>
                {structuredResponse.reflectionBridge.message}
              </p>
              {structuredResponse.reflectionBridge.carryForward
                ? (
                  <div className={cn("mt-4", styles.item)}>
                    <p className={styles.title}>Carry Forward</p>
                    <p className="mt-1 text-sm font-semibold">
                      {structuredResponse.reflectionBridge.carryForward}
                    </p>
                  </div>
                )
                : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={styles.accent}>
                  {formatTomorrowSummarySentence(
                    structuredResponse.reflectionBridge.tomorrowSummary,
                  )}
                </span>
              </div>
              {structuredResponse.reflectionBridge.firstAction
                ? (
                  <div className="mt-4">
                    <p className={styles.title}>First Move</p>
                    <div className="mt-2">
                      {renderQuestRow(
                        structuredResponse.reflectionBridge.firstAction,
                        styles,
                      )}
                    </div>
                  </div>
                )
                : null}
              <div className="mt-4">
                <p className={styles.title}>Tomorrow</p>
                <div className="mt-2 space-y-2">
                  {structuredResponse.reflectionBridge.tomorrowSchedule.length > 0
                    ? structuredResponse.reflectionBridge.tomorrowSchedule.map(
                      (item) => (
                        <div key={item.id} className={styles.item}>
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className={cn("mt-1", styles.subtext)}>
                            {item.label}
                          </p>
                        </div>
                      ),
                    )
                    : (
                      <p className={styles.subtext}>
                        Nothing is locked onto tomorrow yet.
                      </p>
                    )}
                </div>
              </div>
            </section>
          )
          : null}

        {structuredResponse.comingUp
          ? (
            <>
              <section
                className={cn(
                  "cursor-pointer p-4 outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[hsl(var(--celestial-blue)_/_0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0",
                  styles.card,
                )}
                role="button"
                tabIndex={0}
                aria-expanded={isComingUpExpanded}
                aria-label="Expand coming up schedule"
                onClick={() => setIsComingUpExpanded(true)}
                onKeyDown={handleComingUpKeyDown}
                data-testid="structured-coming-up"
              >
                {renderComingUpContent({
                  comingUp: structuredResponse.comingUp,
                  comingUpNextEvent,
                  comingUpRemainingToday,
                  comingUpTomorrowSchedule,
                  comingUpMissedItems,
                  styles,
                  titleAccessory: comingUpExpandIcon,
                })}
              </section>
              <Sheet
                open={isComingUpExpanded}
                onOpenChange={setIsComingUpExpanded}
              >
                <SheetContent
                  side="bottom"
                  className="flex h-[min(88dvh,52rem)] max-h-[88dvh] flex-col overflow-hidden rounded-t-[2rem] border-[hsl(var(--celestial-blue)_/_0.44)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.98)_0%,hsl(var(--secondary)_/_0.82)_100%)] p-0 shadow-[0_-20px_48px_-30px_rgba(var(--primary-rgb),0.55)]"
                >
                  <SheetHeader className="sr-only">
                    <SheetTitle>Coming Up Schedule</SheetTitle>
                    <SheetDescription>
                      Expanded view of your upcoming schedule.
                    </SheetDescription>
                  </SheetHeader>
                  <SheetClose asChild>
                    <button
                      type="button"
                      className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[hsl(var(--celestial-blue)_/_0.36)] bg-card/90 text-foreground shadow-[0_12px_28px_-22px_rgba(var(--primary-rgb),0.5),inset_0_1px_0_rgba(255,255,255,0.8)] transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--celestial-blue)_/_0.45)]"
                      aria-label="Close expanded coming up schedule"
                      data-testid="structured-coming-up-expanded-close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </SheetClose>
                  <div
                    className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-8 sm:px-6"
                    data-testid="structured-coming-up-expanded"
                  >
                    <section className={cn("p-5 sm:p-6", styles.card)}>
                      {renderComingUpContent({
                        comingUp: structuredResponse.comingUp,
                        comingUpNextEvent,
                        comingUpRemainingToday,
                        comingUpTomorrowSchedule,
                        comingUpMissedItems,
                        styles,
                        expanded: true,
                      })}
                    </section>
                  </div>
                </SheetContent>
              </Sheet>
            </>
          )
          : null}

        {structuredResponse.campaignMomentum
          ? (
            <section
              className={cn("p-4", styles.card)}
              data-testid="structured-campaign-momentum"
            >
              <p className={styles.title}>Continue My Journey</p>
              <p className={cn("mt-2", styles.body)}>
                {structuredResponse.campaignMomentum.message}
              </p>
              {structuredResponse.campaignMomentum.campaignTitle
                ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={styles.accent}>
                      {structuredResponse.campaignMomentum.campaignTitle}
                    </span>
                    {structuredResponse.campaignMomentum.status
                      ? (
                        <span className={styles.accent}>
                          {structuredResponse.campaignMomentum.status.replace(
                            /_/g,
                            " ",
                          )}
                        </span>
                      )
                      : null}
                    {structuredResponse.campaignMomentum.interventionLevel
                      ? (
                        <span
                          className={styles.accent}
                          data-testid="structured-campaign-intervention"
                        >
                          {formatCampaignInterventionLabel(
                            structuredResponse.campaignMomentum.interventionLevel,
                          )}
                        </span>
                      )
                      : null}
                  </div>
                )
                : null}
              {structuredResponse.campaignMomentum.statusReason
                ? (
                  <p className={cn("mt-3", styles.subtext)}>
                    {structuredResponse.campaignMomentum.statusReason}
                  </p>
                )
                : null}
              {structuredResponse.campaignMomentum.healthSnapshot
                ? renderCampaignHealthSnapshot(
                  structuredResponse.campaignMomentum.healthSnapshot,
                  styles,
                  "structured-campaign-health",
                )
                : null}
              {structuredResponse.campaignMomentum.pressureSignals.length > 0
                ? (
                  <div className="mt-3">
                    <p className={styles.title}>Pressure Signals</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {structuredResponse.campaignMomentum.pressureSignals.map(
                        (signal) => (
                          <span key={signal} className={styles.accent}>
                            {signal}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                )
                : null}
              {structuredResponse.campaignMomentum.nextStep
                ? (
                  <div className="mt-4">
                    <p className={styles.title}>Next Step</p>
                    <div className="mt-2">
                      {renderQuestRow(
                        structuredResponse.campaignMomentum.nextStep,
                        styles,
                      )}
                    </div>
                  </div>
                )
                : null}
              <div className="mt-4">
                <p className={styles.title}>Support</p>
                <div className="mt-2 space-y-2">
                  {structuredResponse.campaignMomentum.supportActions.length > 0
                    ? structuredResponse.campaignMomentum.supportActions.map(
                      (quest) =>
                        renderQuestRow(quest, styles)
                    )
                    : (
                      <p className={styles.subtext}>
                        No extra support moves are needed right now.
                      </p>
                    )}
                </div>
              </div>
            </section>
          )
          : null}
      </div>
    );
  },
);
