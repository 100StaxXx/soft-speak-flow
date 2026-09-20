import { getCurrentVisualStageBoundaryLevel } from "../config/progression.ts";

export const WELLBEING_CATEGORIES = ["mind", "body", "soul"] as const;
export type WellbeingCategory = typeof WELLBEING_CATEGORIES[number];
// v2 receives the actual portrait + habitat composite, not a transparent cutout.
export const WELLBEING_PROMPT_VERSION = 2;
export const WELLBEING_VIDEO_SECONDS = 3;
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
  1: { mind: "Notice a tiny reflection on the ground, tilt the head with curiosity, and take one small step to investigate.", body: "Make a short, bouncy dash out of frame to the right using the creature's natural locomotion.", soul: "Settle comfortably, take one gentle visible breath, and slowly close the eyes." },
  5: { mind: "Follow a moving reflection with an attentive gaze and turn toward it on the right.", body: "Perform one comfortable full-body stretch, then settle into a ready stance.", soul: "Face the viewer, blink slowly, and lean forward slightly in quiet companionship." },
  13: { mind: "Tilt the head in curiosity, pause in recognition, then make a small decisive turn.", body: "Make one small anatomy-appropriate sideways leap or swimming burst and come to a controlled stop.", soul: "Turn into a soft breeze, close the eyes, and relax." },
  21: { mind: "Examine the path ahead, deliberately turn toward it, and take one thoughtful step.", body: "Walk steadily and confidently out of frame to the right, using natural locomotion.", soul: "Move a little closer to the viewer and settle with a soft, reassuring gaze." },
  36: { mind: "Hold a focused gaze, then make one precise, purposeful pivot.", body: "Make a short, controlled run out of frame to the right, using natural locomotion.", soul: "Let an alert posture soften into comfortable rest, with one unhurried breath." },
  56: { mind: "Slowly lift the gaze from the nearby ground to the distant horizon with calm awareness.", body: "Move out of frame to the right in one fluid, sweeping motion. Do not invent flight or new limbs.", soul: "Lower into a comfortable resting position and take one slow, visible breath." },
  81: { mind: "Observe the scene with steady attention, then make one precise, confident turn.", body: "Depart gracefully out of frame to the right with assured, economical natural movement.", soul: "Settle peacefully into the landscape and give one slow, gentle blink." },
};
const ELEMENT_DETAILS: Record<string, string> = {
  fire: "Soft warm reflections and subtle heat haze; no flames touching the creature.",
  ice: "A trace of loose snow responds naturally to movement.",
  storm: "A gentle breeze stirs existing fur or feathers; no lightning flashes.",
  nature: "Nearby leaves or grass move softly with the creature's motion.",
  void: "Existing violet haze drifts slowly in the background.",
  light: "Natural sunlight and faint floating dust; no halos or sacred symbols.",
};

export function buildWellbeingVideoPrompt(level: number, category: WellbeingCategory, element: string) {
  const stage = getCurrentVisualStageBoundaryLevel(level);
  if (!ACTIONS[stage] || !isWellbeingCategory(category)) throw new Error("A hatched companion and valid category are required");
  return [
    "Exactly three seconds, silent, one continuous shot. Use the supplied image as the exact first frame.",
    "Preserve this unique companion's identity, species, markings, colors, proportions, existing limbs and current evolution form. Preserve its elemental background and framing.",
    "Keep the supplied landscape, ground, horizon and scenery visible throughout all three seconds, including after the companion moves out of frame. Never replace the habitat with a solid color, glow, studio backdrop or empty background.",
    ACTIONS[stage][category],
    "Use anatomy-appropriate movement: walk, swim, slither or fly only when supported by the original creature. Finish a single simple action within three seconds.",
    ELEMENT_DETAILS[element.toLowerCase()] ?? "Keep the existing background calm and unchanged.",
    "Locked camera. No cuts, zoom, transformation, evolution, additional creatures, text, interface, large particle effects, religious imagery, prayer poses, or religious symbols.",
  ].join(" ");
}
