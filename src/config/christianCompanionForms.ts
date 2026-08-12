import doveImage from "@/assets/companions/symbolic/dove.webp";
import eagleImage from "@/assets/companions/symbolic/eagle.webp";
import lambImage from "@/assets/companions/symbolic/lamb.webp";
import lionImage from "@/assets/companions/symbolic/lion.webp";
import stagImage from "@/assets/companions/symbolic/stag.webp";
import wolfImage from "@/assets/companions/symbolic/wolf.webp";

export interface ChristianCompanionForm {
  id: "lamb" | "lion" | "stag" | "dove" | "eagle" | "wolf";
  displayName: string;
  role: string;
  meaning: string;
  image: string;
}

export const CHRISTIAN_COMPANION_ART_BIBLE_VERSION =
  "graceward_companion_v3_biblical_species_lock";

// These are visual symbols of practiced consistency. Graceward never treats a
// companion as sacred, divine, or as a measure of God's approval.
export const CHRISTIAN_COMPANION_FORMS: readonly ChristianCompanionForm[] = [
  {
    id: "lamb",
    displayName: "Lamb",
    role: "humble trust",
    meaning:
      "A reminder to receive grace and keep returning with trust.",
    image: lambImage,
  },
  {
    id: "lion",
    displayName: "Lion",
    role: "steadfast courage",
    meaning: "A courageous reminder to face the next faithful step with heart.",
    image: lionImage,
  },
  {
    id: "stag",
    displayName: "Stag",
    role: "renewal and seeking",
    meaning: "A watchful reminder to seek what restores and leads you forward.",
    image: stagImage,
  },
  {
    id: "dove",
    displayName: "Dove",
    role: "peace and hope",
    meaning:
      "A peaceful reminder to make room for hope, prayer, and reconciliation.",
    image: doveImage,
  },
  {
    id: "eagle",
    displayName: "Eagle",
    role: "vision and strength",
    meaning:
      "A clear-eyed reminder to rise above noise and return to what matters.",
    image: eagleImage,
  },
  {
    id: "wolf",
    displayName: "Wolf",
    role: "faithful endurance",
    meaning:
      "A loyal reminder that consistency is built by walking the path again.",
    image: wolfImage,
  },
] as const;

export const getChristianCompanionForm = (
  value: string | null | undefined,
): ChristianCompanionForm | null => {
  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) return null;

  return CHRISTIAN_COMPANION_FORMS.find((form) =>
    form.id === normalizedValue ||
    form.displayName.toLowerCase() === normalizedValue
  ) ?? null;
};
