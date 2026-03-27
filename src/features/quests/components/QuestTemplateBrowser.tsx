import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Clock3,
  Mountain,
  Search,
  Sparkles,
  Flame,
  History,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COMMON_QUEST_TEMPLATES, QUEST_TEMPLATE_CATEGORY_LABELS } from "@/features/quests/data/questTemplates";
import type {
  PersonalQuestTemplate,
  QuestDifficulty,
  QuestTemplateBrowserTab,
  QuestTemplateCategory,
  QuestTemplatePrefill,
} from "@/features/quests/types";
import { cn } from "@/lib/utils";

interface QuestTemplateBrowserProps {
  initialTab?: QuestTemplateBrowserTab;
  personalTemplates: PersonalQuestTemplate[];
  onBack: () => void;
  onSelectTemplate: (template: QuestTemplatePrefill) => void;
}

type CategoryFilter = "all" | QuestTemplateCategory;

const difficultyConfig: Record<QuestDifficulty, { icon: typeof Zap; label: string; className: string }> = {
  easy: {
    icon: Zap,
    label: "Easy",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  },
  medium: {
    icon: Flame,
    label: "Medium",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  },
  hard: {
    icon: Mountain,
    label: "Hard",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-600",
  },
};

const commonCategoryOptions: CategoryFilter[] = [
  "all",
  "work",
  "health",
  "home",
  "admin",
  "personal",
];

const filterCommonTemplates = (
  searchQuery: string,
  category: CategoryFilter,
) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return COMMON_QUEST_TEMPLATES.filter((template) => {
    if (category !== "all" && template.category !== category) return false;
    if (!normalizedQuery) return true;

    const haystack = [
      template.title,
      template.description,
      template.notes ?? "",
      template.keywords.join(" "),
    ].join(" ").toLowerCase();

    return haystack.includes(normalizedQuery);
  }).sort((left, right) => {
    if (left.featured !== right.featured) return left.featured ? -1 : 1;
    return left.title.localeCompare(right.title);
  });
};

const filterPersonalTemplates = (
  templates: PersonalQuestTemplate[],
  searchQuery: string,
) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) return templates;

  return templates.filter((template) =>
    template.title.toLowerCase().includes(normalizedQuery),
  );
};

export function QuestTemplateBrowser({
  initialTab = "common",
  personalTemplates,
  onBack,
  onSelectTemplate,
}: QuestTemplateBrowserProps) {
  const [activeTab, setActiveTab] = useState<QuestTemplateBrowserTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [commonCategory, setCommonCategory] = useState<CategoryFilter>("all");

  useEffect(() => {
    setActiveTab(initialTab);
    setSearchQuery("");
    setCommonCategory("all");
  }, [initialTab]);

  const filteredCommonTemplates = useMemo(
    () => filterCommonTemplates(searchQuery, commonCategory),
    [searchQuery, commonCategory],
  );
  const filteredPersonalTemplates = useMemo(
    () => filterPersonalTemplates(personalTemplates, searchQuery),
    [personalTemplates, searchQuery],
  );

  const searchPlaceholder = activeTab === "common"
    ? "Search common quests"
    : "Search your repeat quests";

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-border/50 bg-background/95">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1.5 px-2 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="min-w-0 text-center">
            <p className="text-sm font-semibold text-foreground">Quest shortcuts</p>
            <p className="text-xs text-muted-foreground">Pick one to prefill your draft</p>
          </div>
          <div className="w-14" aria-hidden="true" />
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value as QuestTemplateBrowserTab);
            setSearchQuery("");
          }}
          className="mt-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="common">Common</TabsTrigger>
            <TabsTrigger value="yours">Yours</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-3 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>

        {activeTab === "common" && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {commonCategoryOptions.map((category) => {
              const label = category === "all" ? "All" : QUEST_TEMPLATE_CATEGORY_LABELS[category];
              const isActive = commonCategory === category;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCommonCategory(category)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/60 bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {activeTab === "common" ? (
          filteredCommonTemplates.length > 0 ? (
            <div className="space-y-3">
              {filteredCommonTemplates.map((template) => (
                <TemplateRow
                  key={template.id}
                  title={template.title}
                  description={template.description}
                  difficulty={template.difficulty}
                  duration={template.estimatedDuration}
                  metaBadge={QUEST_TEMPLATE_CATEGORY_LABELS[template.category]}
                  highlighted={template.featured}
                  onSelect={() => onSelectTemplate(template)}
                />
              ))}
            </div>
          ) : (
            <TemplateEmptyState
              icon={Sparkles}
              title="No common quests found"
              description="Try a different search or switch categories."
            />
          )
        ) : filteredPersonalTemplates.length > 0 ? (
          <div className="space-y-3">
            {filteredPersonalTemplates.map((template) => (
              <TemplateRow
                key={template.id}
                title={template.title}
                description={buildPersonalDescription(template.lastUsedAt)}
                difficulty={template.difficulty}
                duration={template.estimatedDuration}
                metaBadge={`${template.frequency}x`}
                highlighted={template.frequency >= 3}
                onSelect={() => onSelectTemplate(template)}
              />
            ))}
          </div>
        ) : (
          <TemplateEmptyState
            icon={History}
            title="Your repeat quests will show up here"
            description="Create the same quest a couple of times and we will surface it for quick re-use."
          />
        )}
      </div>
    </div>
  );
}

interface TemplateRowProps {
  title: string;
  description: string;
  difficulty: QuestDifficulty;
  duration: number | null;
  metaBadge: string;
  highlighted?: boolean;
  onSelect: () => void;
}

function TemplateRow({
  title,
  description,
  difficulty,
  duration,
  metaBadge,
  highlighted = false,
  onSelect,
}: TemplateRowProps) {
  const config = difficultyConfig[difficulty];
  const DifficultyIcon = config.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border px-4 py-3 text-left transition-all",
        highlighted
          ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
          : "border-border/60 bg-card hover:bg-muted/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {metaBadge}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge variant="outline" className={cn("gap-1 border", config.className)}>
            <DifficultyIcon className="h-3 w-3" />
            {config.label}
          </Badge>
          {duration !== null && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock3 className="h-3 w-3" />
              {formatDuration(duration)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function TemplateEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-5 py-10 text-center">
      <Icon className="mx-auto h-10 w-10 text-muted-foreground/70" />
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function buildPersonalDescription(lastUsedAt: string | null) {
  if (!lastUsedAt) return "A quest you have used before.";

  const timestamp = Date.parse(lastUsedAt);
  if (Number.isNaN(timestamp)) return "A quest you have used before.";

  return `Last used ${formatDistanceToNow(timestamp, { addSuffix: true })}.`;
}

function formatDuration(duration: number) {
  if (duration >= 60 && duration % 60 === 0) {
    return `${duration / 60}h`;
  }
  if (duration >= 60) {
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    return `${hours}h ${minutes}m`;
  }
  return `${duration}m`;
}
