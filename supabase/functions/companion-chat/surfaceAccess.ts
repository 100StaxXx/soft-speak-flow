export type CompanionChatSurface = "companion" | "journeys";

export const normalizeCompanionChatSurface = (
  surface?: CompanionChatSurface | null,
): CompanionChatSurface => surface === "journeys" ? "journeys" : "companion";

export const surfaceRequiresPremiumAccess = (surface: CompanionChatSurface): boolean =>
  surface !== "journeys";
