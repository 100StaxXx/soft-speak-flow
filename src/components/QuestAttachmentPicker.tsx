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
  const {
    pickAttachments,
    pickPhotoAttachments,
    pickFileAttachments,
    deleteAttachment,
    isNativeAttachmentPicker,
    isUploading,
  } = useQuestImagePicker();
  const isQuestSoft = visualStyle === "quest-soft";

  const remaining = Math.max(0, MAX_ATTACHMENTS_PER_TASK - attachments.length);
  const canAdd = !disabled && remaining > 0 && !isUploading;
  const addButtonClassName = cn(
    "gap-2",
    isQuestSoft
      ? "rounded-[16px] border-[3px] border-[#6b3416] bg-white/60 text-[#6b3416] shadow-[0_4px_0_rgba(77,40,17,0.16)] hover:bg-white/75 hover:text-[#4f240c]"
      : "",
  );

  const handleAdd = async () => {
    if (!canAdd) return;
    const picked = await pickAttachments({
      currentCount: attachments.length,
      maxCount: MAX_ATTACHMENTS_PER_TASK,
    });
    if (picked.length === 0) return;
    onAttachmentsChange([...attachments, ...picked]);
  };

  const handleAddPhotos = async () => {
    if (!canAdd) return;
    const picked = await pickPhotoAttachments({
      currentCount: attachments.length,
      maxCount: MAX_ATTACHMENTS_PER_TASK,
    });
    if (picked.length === 0) return;
    onAttachmentsChange([...attachments, ...picked]);
  };

  const handleAddFiles = async () => {
    if (!canAdd) return;
    const picked = await pickFileAttachments({
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
        <div className="flex flex-wrap items-center gap-2">
          {isNativeAttachmentPicker ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canAdd}
                onClick={handleAddPhotos}
                className={addButtonClassName}
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileImage className="h-4 w-4" />}
                {isUploading ? "Uploading..." : "Add Photos"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canAdd}
                onClick={handleAddFiles}
                className={addButtonClassName}
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {isUploading ? "Uploading..." : "Add Files"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canAdd}
              onClick={handleAdd}
              className={addButtonClassName}
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              {isUploading ? "Uploading..." : "Add Photo/File"}
            </Button>
          )}
        </div>
        <span className={cn("text-xs", isQuestSoft ? "text-[#7f4a1d]/80" : "text-muted-foreground")}>
          {attachments.length}/{MAX_ATTACHMENTS_PER_TASK}
        </span>
      </div>

      {helperText && (
        <p className={cn("text-xs", isQuestSoft ? "text-[#7f4a1d]/80" : "text-muted-foreground")}>Up to 10 files, 10MB each.</p>
      )}

      {attachments.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.fileUrl}
              className={cn(
                "relative p-2",
                isQuestSoft
                  ? "rounded-[16px] border-[3px] border-[#6b3416]/60 bg-white/55 shadow-[0_4px_0_rgba(77,40,17,0.16)]"
                  : "rounded-lg border border-border/60 bg-card",
              )}
            >
              <button
                type="button"
                onClick={() => handleRemove(attachment)}
                className={cn(
                  "absolute right-1 top-1 rounded-full p-1",
                  isQuestSoft
                    ? "bg-white/75 text-[#7f4a1d] hover:bg-white hover:text-[#4f240c]"
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
                    isQuestSoft ? "bg-white/55" : "bg-muted/30",
                  )}
                >
                  <FileText className={cn("h-5 w-5", isQuestSoft ? "text-[#7f4a1d]/80" : "text-muted-foreground")} />
                </a>
              )}

              <div className="mt-2 flex items-center gap-1">
                {attachment.isImage ? (
                  <FileImage className={cn("h-3.5 w-3.5", isQuestSoft ? "text-[#7f4a1d]/80" : "text-muted-foreground")} />
                ) : (
                  <FileText className={cn("h-3.5 w-3.5", isQuestSoft ? "text-[#7f4a1d]/80" : "text-muted-foreground")} />
                )}
                <span className={cn("truncate text-xs", isQuestSoft ? "text-[#6b3416]" : "text-muted-foreground")}>{attachment.fileName}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
