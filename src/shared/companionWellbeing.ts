import { getCurrentVisualStageBoundaryLevel } from "../config/progression.ts";

export const WELLBEING_CATEGORIES = ["mind", "body", "soul"] as const;
export type WellbeingCategory = typeof WELLBEING_CATEGORIES[number];
// v4 keeps the v3 endpoint/duration contract, but gives the middle of each loop
// a clearly readable full-body action instead of almost-static micro-movements.
export const WELLBEING_PROMPT_VERSION = 4;
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
  1: { mind: "Curiously toddle two steps toward a detail on the ground, lower the whole body to inspect it, then turn and toddle back.", body: "Crouch and spring into one joyful low hop, land with natural limb movement, then step back to the starting mark.", soul: "Take a friendly step toward the viewer, lower into a welcoming bow with a broad head tilt, then rise and step back." },
  5: { mind: "Walk a short curious arc toward a reflection, turn the whole body to examine it, then retrace the arc.", body: "Lower the front of the body into a pronounced natural stretch, extend through the shoulders and back, then rise with a lively step and return.", soul: "Turn side-on to enjoy the breeze, lift and open the body's posture with a contented expression, then turn back toward the viewer." },
  13: { mind: "Pivot into profile and take two investigating steps, lower to inspect the path, then pivot and walk back.", body: "Make one energetic sideways bound, land in a visible crouch, then turn and bound back to the starting mark.", soul: "Step toward the viewer in a friendly approach, dip the whole body in greeting, then rise and return with a relaxed turn." },
  21: { mind: "Pace a short scouting arc, plant the feet and turn the torso toward the horizon, then confidently retrace the route.", body: "Perform a confident crouch-and-spring hop with a controlled landing, followed by a deliberate turn back to the starting stance.", soul: "Turn through a broad, relaxed half-circle to take in the landscape, then return along the arc and face the viewer warmly." },
  36: { mind: "Take two purposeful scouting strides, lower the body to study the ground, then turn decisively and stride back.", body: "Perform a broad full-body stretch from a lowered stance to full height, then take a strong lateral step and recover naturally.", soul: "Lower the whole body into a comfortable resting posture, pause with a contented expression, then visibly rise and settle back into the starting stance." },
  56: { mind: "Walk a sweeping but compact surveying arc with the torso visibly turning, lift the head at its apex, then return along the arc.", body: "Gather into a deep natural crouch, extend through the whole body into a powerful stretch, then make a sweeping turn and return. Do not invent flight or new limbs.", soul: "Take a measured step toward the viewer, give a graceful full-body bow, then rise, turn and return to the original mark." },
  81: { mind: "Make a regal quarter-turn and two assured scouting strides, survey the landscape in profile, then turn and stride back.", body: "Perform one powerful controlled lateral bound with a clear weight shift and landing, then walk back into the original stance.", soul: "Turn into profile, lower into a serene resting posture, then rise in one fluid full-body motion and face the viewer again." },
};
const IDLE_ACTIONS: Record<IdleVideoCategory, string> = {
  idle_breathe: "Perform one clearly visible waking stretch: lower through the limbs, lengthen the back naturally, lift the chest, then recover the starting stance. Animate the joints, never scale or warp the whole image.",
  idle_look: "Turn the whole body into profile, take two curious steps along a short arc, then pivot and walk back to the original mark.",
  idle_rest: "Lower the whole body into an anatomy-appropriate seated or resting posture, pause briefly, then push up through the limbs to the original stance.",
  idle_greet: "Make one cheerful low hop with a visible crouch, lift and soft landing, then take a settling step back to the original mark and expression.",
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
    `Current visual stage: ${stage}. ${stage < 13 ? "Bouncy, curious youthful energy with clearly visible body movement." : stage < 56 ? "Expressive, confident mature movement with a clear full-body action." : "Expansive, dignified movement with a clearly readable change in posture and position."}`,
    action,
    `Motion timing: begin the action within the first 0.3 seconds; use the middle of the clip for a clearly visible full-body excursion and natural recovery. Only the endpoints match: do not hold the reference pose throughout. A blink, breathing, head tilt or moving background alone is not enough. Keep motion readable at phone size, using a displacement up to half a body length when space allows. Finish the return by ${seconds - 0.5} seconds.`,
    "Adapt the action to the visible anatomy: land animals step or hop, swimming creatures make a curved swimming pass, and limbless creatures bend and glide. Only visibly winged creatures may use their existing wings. Keep normal anatomy and ground contact; never simulate movement by stretching the still image.",
    "Use anatomy-appropriate movement only. Remain fully in frame. Complete the action before the final half-second, returning naturally to exactly the original resting pose, position, scale, gaze and expression. Hold that starting pose for the final half-second. No exit, teleport, reverse playback, elastic deformation or morphing.",
    ELEMENT_DETAILS[element.toLowerCase()] ?? "Keep the existing background calm and unchanged.",
    "Locked camera. No cuts, zoom, transformation, evolution, additional creatures, text, interface, large particle effects, religious imagery, prayer poses, or religious symbols.",
  ].join(" ");
}
