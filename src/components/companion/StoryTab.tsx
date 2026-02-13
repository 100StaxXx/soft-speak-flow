import { memo, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Milestone, GitBranchPlus } from "lucide-react";
import { CompanionStoryJournal } from "@/components/CompanionStoryJournal";
import { CompanionPostcards } from "@/components/companion/CompanionPostcards";
import { useCompanionLife } from "@/hooks/useCompanionLife";

const formatChoiceLabel = (choice: string) => choice.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
const formatNodeKeyLabel = (nodeKey: string) =>
  nodeKey
    .replace(/^chapter_\d+_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
const formatRecapTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

export const StoryTab = memo(() => {
  const { campaignProgress, advanceCampaign } = useCompanionLife();
  const [recapFilter, setRecapFilter] = useState<string>("all");
  const [showAllRecaps, setShowAllRecaps] = useState(false);

  const choiceEntries = campaignProgress?.availableBranches ?? [];
  const hasChoices = choiceEntries.length > 0;
  const eligibleChoices = choiceEntries.filter((entry) => entry.eligible);
  const hasEligibleChoice = eligibleChoices.length > 0;
  const recapCards = campaignProgress?.recapCards ?? [];

  const recapFilters = useMemo(() => {
    const keys = Array.from(new Set(recapCards.map((recap) => recap.choiceKey)));
    return ["all", ...keys];
  }, [recapCards]);

  const filteredRecaps = useMemo(() => {
    if (recapFilter === "all") return recapCards;
    return recapCards.filter((recap) => recap.choiceKey === recapFilter);
  }, [recapCards, recapFilter]);

  const visibleRecaps = showAllRecaps ? filteredRecaps : filteredRecaps.slice(0, 6);
  const hasMoreRecaps = filteredRecaps.length > 6;

  return (
    <div className="space-y-4 mt-6">
      <Card className="p-4 bg-card/70 border-border/60">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Campaign Director</p>
            <h3 className="text-lg font-semibold mt-1 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Chapter {campaignProgress?.currentChapter ?? 0}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {campaignProgress?.currentNode?.summary ?? "Your campaign arc will appear as your care rhythm stabilizes."}
            </p>
          </div>
          <Badge variant="secondary">Deep arc</Badge>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => advanceCampaign.mutate("steady")}
            disabled={advanceCampaign.isPending || (hasChoices && !hasEligibleChoice)}
          >
            {advanceCampaign.isPending ? "Advancing..." : "Advance Chapter"}
          </Button>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Milestone className="h-3.5 w-3.5" />
            {campaignProgress?.choiceHistory.length ?? 0} recorded choices
          </p>
        </div>
        {hasChoices && (
          <p className="mt-2 text-xs text-muted-foreground">
            Branch readiness: {eligibleChoices.length}/{choiceEntries.length} path{choiceEntries.length === 1 ? "" : "s"} available now.
          </p>
        )}
        {hasChoices && !hasEligibleChoice && (
          <p className="mt-1 text-xs text-destructive">
            No branch is currently eligible. Improve the listed requirements to unlock progression.
          </p>
        )}

        <div className="mt-4 border-t border-border/50 pt-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
            <GitBranchPlus className="h-3.5 w-3.5" />
            Branch Choices
          </p>
          {!hasChoices ? (
            <p className="text-sm text-muted-foreground">No explicit branch choices for this chapter yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {choiceEntries.map((entry) => (
                <div key={entry.choiceKey} className="space-y-1">
                  <Button
                    size="sm"
                    variant={entry.eligible ? "outline" : "secondary"}
                    onClick={() => advanceCampaign.mutate(entry.choiceKey)}
                    disabled={advanceCampaign.isPending || !entry.eligible}
                  >
                    {formatChoiceLabel(entry.choiceKey)}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Leads to {entry.toNodeTitle ? formatNodeKeyLabel(entry.toNodeKey) : "Unknown branch"}
                  </p>
                  {entry.blockedReasons.length > 0 && (
                    <p className="text-[11px] text-destructive">
                      {entry.blockedReasons[0]}
                    </p>
                  )}
                  {entry.toNodeChapter !== null && (
                    <p className="text-[11px] text-muted-foreground">
                      Target chapter {entry.toNodeChapter}
                    </p>
                  )}
                  {!entry.eligible && entry.blockedReasons.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Branch currently unavailable
                    </p>
                  )}
                  {entry.eligible && (
                    <p className="text-[11px] text-emerald-300">
                      Ready
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-border/50 pt-3 space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Chapter Recaps</p>
          {recapCards.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recapFilters.map((filterKey) => {
                const count = filterKey === "all"
                  ? recapCards.length
                  : recapCards.filter((recap) => recap.choiceKey === filterKey).length;
                return (
                  <Button
                    key={filterKey}
                    size="sm"
                    variant={recapFilter === filterKey ? "secondary" : "outline"}
                    onClick={() => {
                      setRecapFilter(filterKey);
                      setShowAllRecaps(false);
                    }}
                  >
                    {formatChoiceLabel(filterKey)} ({count})
                  </Button>
                );
              })}
            </div>
          )}
          {recapCards.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recap cards yet. Advance your chapter to log the first campaign milestone.
            </p>
          ) : filteredRecaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recap cards for this branch yet.
            </p>
          ) : (
            <div className="space-y-2">
              {visibleRecaps.map((recap) => (
                <div key={recap.id} className="rounded-lg border border-border/40 bg-background/20 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Chapter {recap.chapter}: {recap.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{recap.summary}</p>
                    </div>
                    <Badge variant="outline">{formatChoiceLabel(recap.choiceKey)}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {formatRecapTimestamp(recap.at)}
                    {recap.fromNodeTitle ? ` · from ${recap.fromNodeTitle}` : ""}
                  </p>
                </div>
              ))}
              {hasMoreRecaps && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAllRecaps((value) => !value)}
                >
                  {showAllRecaps ? "Show Recent" : `Show All (${filteredRecaps.length})`}
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      <CompanionStoryJournal campaignRecaps={recapCards} />
      <CompanionPostcards />
    </div>
  );
});

StoryTab.displayName = "StoryTab";
