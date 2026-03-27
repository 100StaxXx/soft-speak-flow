const collapseWhitespace = (value: string) => value.trim().replace(/\s+/g, " ");

export const normalizeQuestTemplateTitleForIdentity = (value: string) =>
  collapseWhitespace(value).toLowerCase();

export const normalizeQuestTemplateTitleForDisplay = (value: string) =>
  collapseWhitespace(value);

export const normalizeQuestTemplateTextField = (value: string | null | undefined) => {
  const normalized = collapseWhitespace(value ?? "");
  return normalized.length > 0 ? normalized : null;
};

export const normalizeQuestTemplateSubtasks = (subtasks: string[]) =>
  subtasks
    .map((subtask) => collapseWhitespace(subtask))
    .filter((subtask) => subtask.length > 0);
