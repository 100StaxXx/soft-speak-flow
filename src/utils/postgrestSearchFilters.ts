const POSTGREST_OR_VALUE_RESERVED_PATTERN = /[",.:()\\]/;

export const buildPostgrestIlikeOr = (columns: string[], query: string): string => {
  const pattern = `%${query}%`;
  const escapedPattern = pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const filterValue = POSTGREST_OR_VALUE_RESERVED_PATTERN.test(pattern)
    ? `"${escapedPattern}"`
    : pattern;

  return columns.map((column) => `${column}.ilike.${filterValue}`).join(",");
};
