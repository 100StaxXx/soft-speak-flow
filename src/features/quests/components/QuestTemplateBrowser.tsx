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
import { DIFFICULTY_COLORS, QUEST_TEMPLATE_BROWSER_STYLES } from "@/components/quest-shared";

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
    className: cn(DIFFICULTY_COLORS.easy.pill, "border-transparent text-white"),
  },
  medium: {
    icon: Flame,
    label: "Medium",
    className: cn(DIFFICULTY_COLORS.medium.pill, "border-transparent text-white"),
  },
  hard: {
    icon: Mountain,
    label: "Hard",
    className: cn(DIFFICULTY_COLORS.hard.pill, "border-transparent text-white"),
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
    : "Search your templates";

  return (
    <div className="flex h-full flex-col">
      <div className={cn("px-4 pt-4 pb-3", QUEST_TEMPLATE_BROWSER_STYLES.header)}>
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1.5 px-2 text-white/72 hover:text-white hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="min-w-0 text-center">
            <p className="font-fredoka text-[1.05rem] text-white">Quest shortcuts</p>
            <p className="text-xs text-white/60">Pick one to prefill your draft</p>
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
          <TabsList className={QUEST_TEMPLATE_BROWSER_STYLES.tabList}>
            <TabsTrigger value="common" className={QUEST_TEMPLATE_BROWSER_STYLES.tabTrigger}>Common</TabsTrigger>
            <TabsTrigger value="yours" className={QUEST_TEMPLATE_BROWSER_STYLES.tabTrigger}>Yours</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-3 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/44" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className={cn("pl-9", QUEST_TEMPLATE_BROWSER_STYLES.searchInput)}
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
                    QUEST_TEMPLATE_BROWSER_STYLES.filterChip,
                    isActive
                      ? QUEST_TEMPLATE_BROWSER_STYLES.filterChipActive
                      : QUEST_TEMPLATE_BROWSER_STYLES.filterChipInactive,
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
                description={buildPersonalDescription(template)}
                difficulty={template.difficulty}
                duration={template.estimatedDuration}
                metaBadge={template.templateOrigin === "personal_explicit" ? "Saved" : `${template.frequency}x`}
                highlighted={template.frequency >= 3}
                onSelect={() => onSelectTemplate(template)}
              />
            ))}
          </div>
        ) : (
          <TemplateEmptyState
            icon={History}
            title="Your templates will show up here"
            description="Save a customized template or repeat a quest a couple of times and it will show up here."
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
        QUEST_TEMPLATE_BROWSER_STYLES.row,
        highlighted
          ? QUEST_TEMPLATE_BROWSER_STYLES.rowHighlighted
          : QUEST_TEMPLATE_BROWSER_STYLES.rowDefault,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">{title}</span>
            <Badge variant="outline" className="border-white/10 bg-white/[0.06] text-[10px] text-white/64">
              {metaBadge}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-white/58">{description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge variant="outline" className={cn("gap-1 border shadow-[0_8px_14px_rgba(0,0,0,0.12)]", config.className)}>
            <DifficultyIcon className="h-3 w-3" />
            {config.label}
          </Badge>
          {duration !== null && (
            <span className="inline-flex items-center gap-1 text-[11px] text-white/54">
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
    <div className={QUEST_TEMPLATE_BROWSER_STYLES.emptyState}>
      <Icon className="mx-auto h-10 w-10 text-white/44" />
      <p className="mt-3 text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs text-white/58">{description}</p>
    </div>
  );
}

function buildPersonalDescription(template: PersonalQuestTemplate) {
  if (template.templateOrigin === "personal_explicit") {
    return "Saved to your personal template library.";
  }

  const { lastUsedAt } = template;
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
