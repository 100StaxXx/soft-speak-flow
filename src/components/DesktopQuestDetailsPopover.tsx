import { useCallback, useEffect, useRef, type ReactElement } from "react";
import {
  Brain,
  CalendarArrowUp,
  CalendarPlus,
  Check,
  Circle,
  Clock,
  Dumbbell,
  FileImage,
  FileText,
  Heart,
  Paperclip,
  Pencil,
  Repeat,
  Sparkles,
  Timer,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { QuestLocationLink } from "@/components/QuestLocationLink";
import type { DisplayQuest } from "@/features/quests/display";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn, formatDisplayLabel, stripMarkdown } from "@/lib/utils";

export interface DesktopQuestDetailsPopoverProps {
  quest: DisplayQuest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: ReactElement;
  hasCalendarLink?: boolean;
  onEdit?: () => void;
  onSendToCalendar?: (questId: string) => void;
  onMoveQuestToNextDay?: () => void;
  onDelete?: () => void;
  onToggleSubtask?: (questId: string, subtaskId: string, completed: boolean) => void;
}

const FALLBACK_ATTACHMENT_NAME = "Photo attachment";

const formatTime = (time: string | null | undefined) => {
  if (!time) return "Anytime";
  const [hours, minutes] = time.split(":");
  const hour = Number.parseInt(hours, 10);
  if (!Number.isFinite(hour)) return time;
  const meridiem = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${meridiem}`;
};

const formatDuration = (minutes: number | null | undefined) => {
  if (!minutes) return null;
  if (minutes === 1440) return "All day";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
};

const normalizeDisplayAttachments = (
  quest: Pick<DisplayQuest, "attachments" | "imageUrl">,
) => {
  const normalized = (quest.attachments ?? [])
    .filter((attachment) => typeof attachment.fileUrl === "string" && attachment.fileUrl.trim().length > 0)
    .map((attachment) => ({
      fileUrl: attachment.fileUrl,
      fileName: attachment.fileName?.trim() || FALLBACK_ATTACHMENT_NAME,
      isImage: !!attachment.isImage,
    }));

  if (normalized.length > 0) return normalized;

  if (quest.imageUrl) {
    return [
      {
        fileUrl: quest.imageUrl,
        fileName: FALLBACK_ATTACHMENT_NAME,
        isImage: true,
      },
    ];
  }

  return [];
};

const CATEGORY_META = {
  mind: {
    icon: Brain,
    label: "Mind",
  },
  body: {
    icon: Dumbbell,
    label: "Body",
  },
  soul: {
    icon: Heart,
    label: "Soul",
  },
  default: {
    icon: Sparkles,
    label: "Quest",
  },
} as const;

export function useDesktopQuestCardClickHandlers<T>(
  task: T,
  options: {
    onSingleClick: (task: T) => void;
    onDoubleClick?: (task: T) => void;
    delayMs?: number;
  },
) {
  const { onSingleClick, onDoubleClick, delayMs = 200 } = options;
  const pendingClickTimeoutRef = useRef<number | null>(null);

  const clearPendingClick = useCallback(() => {
    if (pendingClickTimeoutRef.current !== null) {
      window.clearTimeout(pendingClickTimeoutRef.current);
      pendingClickTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearPendingClick, [clearPendingClick]);

  const handleClick = useCallback(() => {
    clearPendingClick();
    pendingClickTimeoutRef.current = window.setTimeout(() => {
      onSingleClick(task);
      pendingClickTimeoutRef.current = null;
    }, delayMs);
  }, [clearPendingClick, delayMs, onSingleClick, task]);

  const handleDoubleClick = useCallback(() => {
    clearPendingClick();
    onDoubleClick?.(task);
  }, [clearPendingClick, onDoubleClick, task]);

  return {
    clearPendingClick,
    handleClick,
    handleDoubleClick,
  };
}

export function DesktopQuestDetailsPopover({
  quest,
  open,
  onOpenChange,
  anchor,
  hasCalendarLink = false,
  onEdit,
  onSendToCalendar,
  onMoveQuestToNextDay,
  onDelete,
  onToggleSubtask,
}: DesktopQuestDetailsPopoverProps) {
  const attachments = normalizeDisplayAttachments(quest);
  const duration = formatDuration(quest.estimatedDuration);
  const categoryMeta = CATEGORY_META[quest.category as keyof typeof CATEGORY_META] ?? CATEGORY_META.default;
  const CategoryIcon = categoryMeta.icon;
  const subtasks = quest.subtasks ?? [];

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{anchor}</PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={10}
        className="z-[80] w-[360px] rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(23,20,38,0.98),rgba(15,13,26,0.96))] p-4 text-white shadow-[0_28px_60px_rgba(0,0,0,0.34)]"
      >
        <div
          className="space-y-4"
          data-testid={`desktop-quest-popover-${quest.id}`}
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-base font-semibold leading-tight text-foreground",
                    quest.completed && "text-muted-foreground line-through",
                  )}
                >
                  {quest.title}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(quest.scheduledTime)}
                  </span>
                  {duration ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-1">
                      <Timer className="h-3 w-3" />
                      {duration}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-stardust-gold/25 bg-stardust-gold/10 px-2 py-1 font-semibold text-stardust-gold">
                    +{quest.xpReward} XP
                  </span>
                </div>
              </div>

              <div className="rounded-full border border-white/10 bg-white/[0.05] p-2">
                <CategoryIcon className="h-4 w-4 text-primary" />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {quest.isMainQuest ? (
                <Badge variant="outline" className="border-primary/35 bg-primary/10 text-primary">
                  Main quest
                </Badge>
              ) : null}
              {quest.habitSourceId ? (
                <Badge variant="outline" className="border-accent/35 bg-accent/10 text-accent">
                  <Repeat className="mr-1 h-3 w-3" />
                  Ritual
                </Badge>
              ) : null}
              {quest.category ? (
                <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-foreground">
                  <CategoryIcon className="mr-1 h-3 w-3" />
                  {categoryMeta.label}
                </Badge>
              ) : null}
              {quest.difficulty ? (
                <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-foreground capitalize">
                  {quest.difficulty}
                </Badge>
              ) : null}
              {quest.priority ? (
                <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-foreground capitalize">
                  {quest.priority} priority
                </Badge>
              ) : null}
              {quest.isRecurring && quest.recurrencePattern ? (
                <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-foreground">
                  <Repeat className="mr-1 h-3 w-3" />
                  {formatDisplayLabel(quest.recurrencePattern)}
                </Badge>
              ) : null}
            </div>
          </div>

          {quest.notes ? (
            <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                <FileText className="h-3.5 w-3.5" />
                Notes
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {stripMarkdown(quest.notes)}
              </p>
            </div>
          ) : null}

          {quest.location ? (
            <QuestLocationLink
              location={quest.location}
              label="Address"
              className="bg-white/[0.04]"
              textClassName="text-muted-foreground"
            />
          ) : null}

          {subtasks.length > 0 ? (
            <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                  Subtasks
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {subtasks.filter((subtask) => !!subtask.completed).length}/{subtasks.length}
                </p>
              </div>
              <div className="space-y-2">
                {subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center gap-2 rounded-xl bg-black/10 px-2 py-1.5 text-sm text-foreground"
                  >
                    {onToggleSubtask ? (
                      <Checkbox
                        checked={!!subtask.completed}
                        onCheckedChange={(checked) => onToggleSubtask(quest.id, subtask.id, !!checked)}
                        className="h-4 w-4"
                      />
                    ) : subtask.completed ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={cn(subtask.completed && "text-muted-foreground line-through")}>
                      {subtask.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {attachments.length > 0 ? (
            <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                  Attachments
                </p>
                <p className="text-[11px] text-muted-foreground">{attachments.length}</p>
              </div>
              <div className="space-y-2">
                {attachments.map((attachment, index) => (
                  <a
                    key={`${attachment.fileUrl}-${index}`}
                    href={attachment.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-xl bg-black/10 px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
                  >
                    {attachment.isImage ? (
                      <FileImage className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <Paperclip className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span className="truncate">{attachment.fileName}</span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {(onEdit || onSendToCalendar || onMoveQuestToNextDay || onDelete) ? (
            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
              {onEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-2xl border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit();
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              ) : null}
              {onSendToCalendar ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-2xl border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                  onClick={() => {
                    onOpenChange(false);
                    onSendToCalendar(quest.id);
                  }}
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  {hasCalendarLink ? "Re-send to calendar" : "Send to calendar"}
                </Button>
              ) : null}
              {onMoveQuestToNextDay ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-2xl border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                  onClick={() => {
                    onOpenChange(false);
                    onMoveQuestToNextDay();
                  }}
                >
                  <CalendarArrowUp className="h-3.5 w-3.5" />
                  Move to tomorrow
                </Button>
              ) : null}
              {onDelete ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-2xl border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
                  onClick={() => {
                    onOpenChange(false);
                    onDelete();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
