import { getCurrentVisualStageBoundaryLevel } from "../config/progression.ts";

export const WELLBEING_CATEGORIES = ["mind", "body", "soul"] as const;
export type WellbeingCategory = typeof WELLBEING_CATEGORIES[number];
// v3 uses the same opaque scene as both endpoints, with 4s idle / 5s activity clips.
export const WELLBEING_PROMPT_VERSION = 3;
export const WELLBEING_VIDEO_SECONDS = 5;
export const IDLE_VIDEO_SECONDS = 4;
export const IDLE_VIDEO_CATEGORIES = ["idle_breathe", "idle_look", "idle_rest", "idle_greet"] as const;
export type IdleVideoCategory = typeof IDLE_VIDEO_CATEGORIES[number];
export const COMPANION_VIDEO_CATEGORIES = [...WELLBEING_CATEGORIES, ...IDLE_VIDEO_CATEGORIES] as const;
export type CompanionVideoCategory = typeof COMPANION_VIDEO_CATEGORIES[number];
export const COMPANION_VIDEO_DAILY_LIMIT = 14; // Two complete appearance sets; monetary budgets stay unchanged.
export const isCompanionVideoCategory = (value: unknown): value is CompanionVideoCategory =>
  typeof value === "string" && COMPANION_VIDEO_CATEGORIES.includes(value as CompanionVideoCategory);
export const companionVideoSeconds = (category: CompanionVideoCategory) =>
  isWellbeingCategory(category) ? WELLBEING_VIDEO_SECONDS : IDLE_VIDEO_SECONDS;
export const isWellbeingCategory = (value: unknown): value is WellbeingCategory =>
  typeof value === "string" && WELLBEING_CATEGORIES.includes(value as WellbeingCategory);

export const WELLBEING_OPTIONS = {
  mind: { label: "Mind", description: "Make room for curiosity and focus.", suggestions: [
    { title: "Read something that interests you", minutes: 5 },
    { title: "Give one idea your full attention", minutes: 5 },
    { title: "Learn one small new thing", minutes: 10 },
  ] },
  body: { label: "Body", description: "Move, rest, or take care of yourself.", suggestions: [
    { title: "Take a comfortable movement break", minutes: 3 },
    { title: "Step outside for some fresh air", minutes: 5 },
    { title: "Pause for water and a little rest", minutes: 3 },
  ] },
  soul: { label: "Soul", description: "Find connection, meaning, or a quiet moment.", suggestions: [
    { title: "Notice something you appreciate", minutes: 2 },
    { title: "Reach out to someone you care about", minutes: 5 },
    { title: "Spend a quiet moment with nature", minutes: 5 },
  ] },
} as const;

// These are motion directions, not instructions for a user to perform daily.
const ACTIONS: Record<number, Record<WellbeingCategory, string>> = {
  1: { mind: "Notice a tiny reflection on the ground, tilt the head with curiosity, then return the gaze to the viewer.", body: "Make one tiny playful step in place, then return to the starting stance.", soul: "Settle comfortably, take one gentle visible breath, and slowly blink." },
  5: { mind: "Follow a moving reflection with an attentive gaze and turn toward it on the right.", body: "Perform one comfortable full-body stretch, then settle into a ready stance.", soul: "Face the viewer, blink slowly, and lean forward slightly in quiet companionship." },
  13: { mind: "Tilt the head in curiosity, pause in recognition, then make a small decisive turn.", body: "Make one small anatomy-appropriate sideways leap or swimming burst and come to a controlled stop.", soul: "Turn into a soft breeze, close the eyes, and relax." },
  21: { mind: "Examine the path ahead, deliberately turn toward it, then face the viewer again.", body: "Shift weight confidently into one measured step and return to the starting stance.", soul: "Offer a soft, reassuring gaze and a small friendly head tilt." },
  36: { mind: "Hold a focused gaze, then make one precise, purposeful head turn and return.", body: "Make one controlled shoulder or body stretch in place and settle back.", soul: "Let an alert posture soften with one unhurried breath, then return to the starting posture." },
  56: { mind: "Slowly lift the gaze toward the horizon and return with calm awareness.", body: "Shift naturally in one fluid, sweeping motion in place and settle back. Do not invent flight or new limbs.", soul: "Relax into one slow, visible breath and return to the starting posture." },
  81: { mind: "Observe the scene with steady attention, then make one precise head turn and return.", body: "Make an assured, economical stretch in place, then return to the starting stance.", soul: "Give one slow, gentle blink while resting peacefully in the landscape." },
};
const IDLE_ACTIONS: Record<IdleVideoCategory, string> = {
  idle_breathe: "Take one very subtle natural breath and blink once. Animate anatomy, never scale or warp the whole image.",
  idle_look: "Notice something nearby with a small curious head turn, then calmly look back at the viewer.",
  idle_rest: "Let the eyelids soften for a quiet resting moment, then gently reopen them without changing the stance.",
  idle_greet: "Give a tiny friendly head tilt and a soft blink, then return to the original neutral expression.",
};
const ELEMENT_DETAILS: Record<string, string> = {
  fire: "Soft warm reflections and subtle heat haze; no flames touching the creature.",
  ice: "A trace of loose snow responds naturally to movement.",
  storm: "A gentle breeze stirs existing fur or feathers; no lightning flashes.",
  nature: "Nearby leaves or grass move softly with the creature's motion.",
  void: "Existing violet haze drifts slowly in the background.",
  light: "Natural sunlight and faint floating dust; no halos or sacred symbols.",
};

export function buildWellbeingVideoPrompt(level: number, category: CompanionVideoCategory, element: string) {
  const stage = getCurrentVisualStageBoundaryLevel(level);
  if (!ACTIONS[stage] || !isCompanionVideoCategory(category)) throw new Error("A hatched companion and valid category are required");
  const seconds = companionVideoSeconds(category);
  const action = isWellbeingCategory(category) ? ACTIONS[stage][category] : IDLE_ACTIONS[category];
  return [
    `Exactly ${seconds} seconds, silent, one continuous shot. Use the supplied image as the exact first frame and exact last frame.`,
    "Preserve this unique companion's identity, species, markings, colors, proportions, existing limbs and current evolution form. Preserve its elemental background and framing.",
    `Keep the supplied landscape, ground, horizon and scenery visible throughout all ${seconds} seconds. Never replace the habitat with a solid color, glow, studio backdrop or empty background.`,
    `Current visual stage: ${stage}. ${stage < 13 ? "Small, gentle youthful movement." : stage < 56 ? "Calm, confident mature movement." : "Unhurried, dignified movement."}`,
    action,
    "Use anatomy-appropriate movement only. Remain fully in frame. Complete the action before the final half-second, returning naturally to exactly the original resting pose, position, scale, gaze and expression. Hold that starting pose for the final half-second. No exit, teleport, reverse playback, elastic deformation or morphing.",
    ELEMENT_DETAILS[element.toLowerCase()] ?? "Keep the existing background calm and unchanged.",
    "Locked camera. No cuts, zoom, transformation, evolution, additional creatures, text, interface, large particle effects, religious imagery, prayer poses, or religious symbols.",
  ].join(" ");
}
