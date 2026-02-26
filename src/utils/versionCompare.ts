const VERSION_SEGMENT_PATTERN = /^\d+$/;

const parseVersion = (version: string): number[] | null => {
  if (!version || typeof version !== "string") return null;

  const segments = version
    .trim()
    .split(".")
    .map((segment) => segment.trim());

  if (segments.length === 0) return null;
  if (segments.some((segment) => !VERSION_SEGMENT_PATTERN.test(segment))) return null;

  return segments.map((segment) => Number(segment));
};

export const compareVersions = (left: string, right: string): -1 | 0 | 1 => {
  const leftSegments = parseVersion(left);
  const rightSegments = parseVersion(right);

  if (!leftSegments || !rightSegments) return 0;

  const maxLength = Math.max(leftSegments.length, rightSegments.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftSegments[index] ?? 0;
    const rightValue = rightSegments[index] ?? 0;

    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }

  return 0;
};

export const isVersionNewer = (currentVersion: string | null, latestVersion: string | null): boolean => {
  if (!currentVersion || !latestVersion) return false;
  return compareVersions(currentVersion, latestVersion) === -1;
};
