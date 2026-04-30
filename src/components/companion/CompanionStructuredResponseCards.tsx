import { memo } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  CompanionCampaignHealthSnapshot,
  CompanionStructuredResponse,
  CompanionSuggestedQuest,
} from "@/shared/companionStructuredOutput";

type CompanionStructuredResponseCardsVariant = "journeys" | "companion";

interface CompanionStructuredResponseCardsProps {
  structuredResponse?: CompanionStructuredResponse | null;
  variant: CompanionStructuredResponseCardsVariant;
  className?: string;
  onConfirmSuggestion?: (proposalId: string) => void | Promise<void>;
  actionDisabled?: boolean;
  savedProposalIds?: string[];
  pendingProposalId?: string | null;
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
    card:
      "rounded-[1.5rem] border border-white/10 bg-white/[0.06] text-white shadow-[0_24px_50px_-38px_rgba(59,130,246,0.55)]",
    title:
      "text-[0.72rem] font-black uppercase tracking-[0.2em] text-sky-100/70",
    body: "text-sm leading-6 text-white",
    subtext: "text-sm text-white/70",
    item:
      "rounded-[1.15rem] border border-white/10 bg-white/[0.05] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
    accent:
      "rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.18em] text-white/70",
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
      ? `${snapshot.activeCampaignCount} active campaigns`
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
  variant: CompanionStructuredResponseCardsVariant,
  styles: (typeof variantStyles)[CompanionStructuredResponseCardsVariant],
  options?: {
    onConfirmSuggestion?: (proposalId: string) => void | Promise<void>;
    actionDisabled?: boolean;
    savedProposalIds?: string[];
    pendingProposalId?: string | null;
  },
) => {
  const isSaved = Boolean(
    quest.proposalId && options?.savedProposalIds?.includes(quest.proposalId),
  );
  const isPending = Boolean(
    quest.proposalId &&
      options?.pendingProposalId &&
      quest.proposalId === options.pendingProposalId,
  );
  const actionLabel = isSaved ? "Saved" : isPending ? "Saving" : "Save";

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
        {quest.proposalId && options?.onConfirmSuggestion
          ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "h-8 rounded-full px-3 text-[0.68rem] font-black uppercase tracking-[0.16em]",
                variant === "journeys"
                  ? "border-[#6d3518] bg-white/70 text-[#6d3518] hover:bg-white"
                  : "border-white/15 bg-white/[0.07] text-white hover:bg-white/[0.12]",
              )}
              onClick={() => {
                void options.onConfirmSuggestion?.(quest.proposalId!);
              }}
              disabled={options.actionDisabled || isSaved || isPending}
              data-tour="companion-plan-day-suggestion-save"
              data-tour-shape="pill"
              data-testid={`structured-suggestion-confirm-${quest.suggestionId}`}
            >
              {actionLabel}
            </Button>
          )
          : null}
      </div>
    </div>
  );
};

export const CompanionStructuredResponseCards = memo(
  function CompanionStructuredResponseCards({
    structuredResponse,
    variant,
    className,
    onConfirmSuggestion,
    actionDisabled = false,
    savedProposalIds = [],
    pendingProposalId = null,
  }: CompanionStructuredResponseCardsProps) {
    if (!structuredResponse) return null;

    const styles = variantStyles[variant];
    const planDayCampaignFocus =
      structuredResponse.planDay?.campaignFocus ?? null;

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
                {structuredResponse.planDay.dayAssessment.replace(/_/g, " ")}
              </p>
              {planDayCampaignFocus
                ? (
                  <div
                    className={cn("mt-4", styles.item)}
                    data-testid="structured-plan-day-campaign-focus"
                  >
                    <p className={styles.title}>Campaign Focus</p>
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
                    renderQuestRow(quest, variant, styles, {
                      onConfirmSuggestion,
                      actionDisabled,
                      savedProposalIds,
                      pendingProposalId,
                    })
                  )
                  : (
                    <p className={styles.subtext}>
                      No strong quest suggestions right now without crowding the
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
                    <p className={styles.title}>Campaign Focus</p>
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
                      renderQuestRow(quest, variant, styles, {
                        onConfirmSuggestion,
                        actionDisabled,
                        savedProposalIds,
                        pendingProposalId,
                      })
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
                    <p className={styles.title}>Focus Campaign</p>
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
                    <p className={styles.title}>Campaign Pressure</p>
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
                        renderQuestRow(quest, variant, styles, {
                          onConfirmSuggestion,
                          actionDisabled,
                          savedProposalIds,
                          pendingProposalId,
                        })
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
                  Tomorrow looks {structuredResponse.reflectionBridge.tomorrowSummary}
                </span>
              </div>
              {structuredResponse.reflectionBridge.firstAction
                ? (
                  <div className="mt-4">
                    <p className={styles.title}>First Move</p>
                    <div className="mt-2">
                      {renderQuestRow(
                        structuredResponse.reflectionBridge.firstAction,
                        variant,
                        styles,
                        {
                          onConfirmSuggestion,
                          actionDisabled,
                          savedProposalIds,
                          pendingProposalId,
                        },
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
            <section
              className={cn("p-4", styles.card)}
              data-testid="structured-coming-up"
            >
              <p className={styles.title}>Coming Up</p>
              <p className={cn("mt-2", styles.body)}>
                {structuredResponse.comingUp.message}
              </p>
              {structuredResponse.comingUp.nextEvent
                ? (
                  <div className={cn("mt-4", styles.item)}>
                    <p className={styles.title}>Next</p>
                    <p className="mt-1 text-sm font-semibold">
                      {structuredResponse.comingUp.nextEvent.title}
                    </p>
                    <p className={cn("mt-1", styles.subtext)}>
                      {structuredResponse.comingUp.nextEvent.label}
                    </p>
                  </div>
                )
                : null}
              {structuredResponse.comingUp.nextBestAction
                ? (
                  <div className="mt-4">
                    <p className={styles.title}>Before That</p>
                    <div className="mt-2">
                      {renderQuestRow(
                        structuredResponse.comingUp.nextBestAction,
                        variant,
                        styles,
                        {
                          onConfirmSuggestion,
                          actionDisabled,
                          savedProposalIds,
                          pendingProposalId,
                        },
                      )}
                    </div>
                  </div>
                )
                : null}
              <div className="mt-4 space-y-2">
                {structuredResponse.comingUp.remainingToday.length > 0
                  ? structuredResponse.comingUp.remainingToday.map((item) => (
                    <div key={item.id} className={styles.item}>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className={cn("mt-1", styles.subtext)}>{item.label}</p>
                    </div>
                  ))
                  : (
                    <p className={styles.subtext}>
                      Nothing else is scheduled for the rest of today.
                    </p>
                  )}
              </div>
              <p className={cn("mt-4", styles.subtext)}>
                Tomorrow looks {structuredResponse.comingUp.tomorrowSummary}.
              </p>
              {structuredResponse.comingUp.missedItems.length > 0
                ? (
                  <div className="mt-3 space-y-2">
                    {structuredResponse.comingUp.missedItems.map((item) => (
                      <div key={item.id} className={styles.item}>
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className={cn("mt-1", styles.subtext)}>
                          {item.label}
                        </p>
                      </div>
                    ))}
                  </div>
                )
                : null}
            </section>
          )
          : null}

        {structuredResponse.campaignMomentum
          ? (
            <section
              className={cn("p-4", styles.card)}
              data-testid="structured-campaign-momentum"
            >
              <p className={styles.title}>Advance My Campaign</p>
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
                        variant,
                        styles,
                        {
                          onConfirmSuggestion,
                          actionDisabled,
                          savedProposalIds,
                          pendingProposalId,
                        },
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
                        renderQuestRow(quest, variant, styles, {
                          onConfirmSuggestion,
                          actionDisabled,
                          savedProposalIds,
                          pendingProposalId,
                        })
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
