import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuestImagePicker } from "@/hooks/useQuestImagePicker";
import type { QuestAttachmentInput } from "@/types/questAttachments";
import { MAX_ATTACHMENTS_PER_TASK } from "@/constants/questAttachments";
import { FileImage, FileText, Loader2, Paperclip, X } from "lucide-react";

interface QuestAttachmentPickerProps {
  attachments: QuestAttachmentInput[];
  onAttachmentsChange: (attachments: QuestAttachmentInput[]) => void;
  className?: string;
  disabled?: boolean;
  helperText?: boolean;
  visualStyle?: "default" | "quest-soft";
}

export function QuestAttachmentPicker({
  attachments,
  onAttachmentsChange,
  className,
  disabled = false,
  helperText = true,
  visualStyle = "default",
}: QuestAttachmentPickerProps) {
  const { pickAttachments, deleteAttachment, isUploading } = useQuestImagePicker();
  const isQuestSoft = visualStyle === "quest-soft";

  const remaining = Math.max(0, MAX_ATTACHMENTS_PER_TASK - attachments.length);
  const canAdd = !disabled && remaining > 0 && !isUploading;

  const handleAdd = async () => {
    if (!canAdd) return;
    const picked = await pickAttachments({
      currentCount: attachments.length,
      maxCount: MAX_ATTACHMENTS_PER_TASK,
    });
    if (picked.length === 0) return;
    onAttachmentsChange([...attachments, ...picked]);
  };

  const handleRemove = async (attachment: QuestAttachmentInput) => {
    await deleteAttachment(attachment);
    onAttachmentsChange(
      attachments.filter((item) => item.fileUrl !== attachment.fileUrl),
    );
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canAdd}
          onClick={handleAdd}
          className={cn(
            "gap-2",
            isQuestSoft
              ? "rounded-[22px] border-white/10 bg-white/[0.06] text-white shadow-[0_10px_18px_rgba(0,0,0,0.12)] hover:bg-white/[0.1]"
              : "",
          )}
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          {isUploading ? "Uploading..." : "Add Photo/File"}
        </Button>
        <span className={cn("text-xs", isQuestSoft ? "text-white/54" : "text-muted-foreground")}>
          {attachments.length}/{MAX_ATTACHMENTS_PER_TASK}
        </span>
      </div>

      {helperText && (
        <p className={cn("text-xs", isQuestSoft ? "text-white/54" : "text-muted-foreground")}>Up to 10 files, 10MB each.</p>
      )}

      {attachments.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.fileUrl}
              className={cn(
                "relative p-2",
                isQuestSoft
                  ? "rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04))] shadow-[0_10px_18px_rgba(0,0,0,0.12)]"
                  : "rounded-lg border border-border/60 bg-card",
              )}
            >
              <button
                type="button"
                onClick={() => handleRemove(attachment)}
                className={cn(
                  "absolute right-1 top-1 rounded-full p-1",
                  isQuestSoft
                    ? "bg-black/20 text-white/70 hover:bg-black/30 hover:text-white"
                    : "bg-background/80 text-muted-foreground hover:text-destructive",
                )}
                aria-label={`Remove ${attachment.fileName}`}
              >
                <X className="h-3 w-3" />
              </button>

              {attachment.isImage ? (
                <a href={attachment.fileUrl} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={attachment.fileUrl}
                    alt={attachment.fileName}
                    className="h-16 w-full rounded object-cover"
                  />
                </a>
              ) : (
                <a
                  href={attachment.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "flex h-16 items-center justify-center rounded",
                    isQuestSoft ? "bg-white/[0.08]" : "bg-muted/30",
                  )}
                >
                  <FileText className={cn("h-5 w-5", isQuestSoft ? "text-white/58" : "text-muted-foreground")} />
                </a>
              )}

              <div className="mt-2 flex items-center gap-1">
                {attachment.isImage ? (
                  <FileImage className={cn("h-3.5 w-3.5", isQuestSoft ? "text-white/58" : "text-muted-foreground")} />
                ) : (
                  <FileText className={cn("h-3.5 w-3.5", isQuestSoft ? "text-white/58" : "text-muted-foreground")} />
                )}
                <span className={cn("truncate text-xs", isQuestSoft ? "text-white/66" : "text-muted-foreground")}>{attachment.fileName}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
