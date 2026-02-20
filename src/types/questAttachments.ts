export interface QuestAttachmentInput {
  fileUrl: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  isImage: boolean;
  sortOrder?: number;
}

export interface TaskAttachment extends QuestAttachmentInput {
  id?: string;
  taskId?: string;
  createdAt?: string;
}
