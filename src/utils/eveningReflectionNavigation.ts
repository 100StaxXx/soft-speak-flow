export const EVENING_REFLECTION_OPEN_PARAM = "open";
export const EVENING_REFLECTION_OPEN_VALUE = "evening-reflection";
export const EVENING_REFLECTION_CANONICAL_PATH =
  `/mentor?${EVENING_REFLECTION_OPEN_PARAM}=${EVENING_REFLECTION_OPEN_VALUE}`;

export function isEveningReflectionOpenRequest(search: string): boolean {
  return (
    new URLSearchParams(search).get(EVENING_REFLECTION_OPEN_PARAM) ===
    EVENING_REFLECTION_OPEN_VALUE
  );
}

export function clearEveningReflectionOpenRequest(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(EVENING_REFLECTION_OPEN_PARAM);

  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
}
