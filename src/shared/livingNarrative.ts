import type { CompanionPostcard } from "@/hooks/useCompanionPostcards";
import type { CompanionStory } from "@/hooks/useCompanionStory";
import type {
  LivingNarrativeOption,
  LivingNarrativePrompt,
} from "@/types/livingNarrative";

const collapseWhitespace = (value: string | null | undefined): string =>
  value?.replace(/\s+/g, " ").trim() ?? "";

const shorten = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  const slice = value.slice(0, Math.max(0, maxLength - 1));
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > maxLength * 0.6 ? lastSpace : slice.length).trim()}…`;
};

const stripLoreLabel = (value: string): string =>
  value.replace(/^(?:World Truth|Historical Reference|Foreshadowing Seed|Additional Lore):\s*/i, "");

const safeCompanionName = (value: string | null | undefined): string =>
  shorten(collapseWhitespace(value) || "Your companion", 80);

const buildOption = (option: LivingNarrativeOption): LivingNarrativeOption => ({
  ...option,
  detail: shorten(collapseWhitespace(option.detail), 320),
  memorySummary: shorten(collapseWhitespace(option.memorySummary), 900),
  companionReply: shorten(collapseWhitespace(option.companionReply), 480),
  sideQuestTitle: option.sideQuestTitle
    ? shorten(collapseWhitespace(option.sideQuestTitle), 170)
    : undefined,
  consequenceTags: option.consequenceTags.slice(0, 8),
});

export function buildStoryLivingNarrativePrompt(input: {
  story: CompanionStory;
  companionName?: string | null;
  chapterLabel: string;
}): LivingNarrativePrompt {
  const { story, chapterLabel } = input;
  const companionName = safeCompanionName(input.companionName);
  const firstLore = stripLoreLabel(collapseWhitespace(story.lore_expansion?.[0])) ||
    "There is still more of this world to understand.";

  return {
    promptKey: "chapter_compass_v1",
    contextLabel: `${chapterLabel}: ${story.chapter_title}`,
    question: `What should ${companionName} carry forward from this chapter?`,
    options: [
      buildOption({
        key: "wisdom",
        label: "The lesson",
        detail: story.life_lesson,
        memoryType: "reflection",
        memorySummary: `The lesson the user chose to carry forward was: ${story.life_lesson}`,
        consequenceTags: ["wisdom", "growth", `stage:${story.stage}`],
        companionReply: `Then we will practice it, not just remember it. I’ll watch for the moment it matters.`,
        sideQuestTitle: `Put one lesson from “${story.chapter_title}” into practice`,
      }),
      buildOption({
        key: "bond",
        label: "Our bond",
        detail: story.bond_moment,
        memoryType: "relationship",
        memorySummary: `The user chose the bond with ${companionName} as the chapter’s most important thread: ${story.bond_moment}`,
        consequenceTags: ["bond", "trust", `stage:${story.stage}`],
        companionReply: `I felt that too. Whatever waits ahead, this is something the world cannot take from us.`,
        sideQuestTitle: `Protect ten quiet minutes for something that strengthens trust`,
      }),
      buildOption({
        key: "signal",
        label: "The next signal",
        detail: story.next_hook || firstLore,
        memoryType: "discovery",
        memorySummary: `The user wants the next chapter to follow this signal: ${story.next_hook || firstLore}`,
        consequenceTags: ["mystery", "forward_hook", `stage:${story.stage}`],
        companionReply: `I noticed it too. I’ll keep this signal close and listen for where it answers next.`,
        sideQuestTitle: `Write down the next clue before it slips away`,
      }),
    ],
  };
}

export function buildPostcardLivingNarrativePrompt(input: {
  postcard: CompanionPostcard;
  companionName?: string | null;
}): LivingNarrativePrompt {
  const { postcard } = input;
  const companionName = safeCompanionName(input.companionName);
  const storyThread = collapseWhitespace(postcard.story_content).slice(0, 320) ||
    collapseWhitespace(postcard.caption) ||
    `Reaching ${postcard.milestone_percent}% changed the map.`;
  const clue = collapseWhitespace(postcard.clue_text) || storyThread;
  const prophecy = collapseWhitespace(postcard.prophecy_line) ||
    `The path beyond ${postcard.location_name} has not revealed itself yet.`;

  return {
    promptKey: "postcard_compass_v1",
    contextLabel: postcard.chapter_title || postcard.location_name,
    question: `Where should we look closer at ${postcard.location_name}?`,
    options: [
      buildOption({
        key: "place",
        label: "Study the place",
        detail: postcard.location_description,
        memoryType: "discovery",
        memorySummary: `The user wants ${companionName} to remember the environment at ${postcard.location_name}: ${postcard.location_description}`,
        consequenceTags: ["location", "exploration", `milestone:${postcard.milestone_percent}`],
        companionReply: `Good. Places leave tracks too. I’ll remember the light, the air, and what did not quite belong.`,
        sideQuestTitle: `Notice one detail in your surroundings you usually miss`,
      }),
      buildOption({
        key: "clue",
        label: postcard.clue_text ? "Follow the clue" : "Remember the turning point",
        detail: clue,
        memoryType: postcard.clue_text ? "discovery" : "choice",
        memorySummary: `The thread chosen at ${postcard.location_name} was: ${clue}`,
        consequenceTags: [postcard.clue_text ? "clue" : "milestone", "curiosity", `milestone:${postcard.milestone_percent}`],
        companionReply: `That is the thread I would have chosen. Let’s see what pulls back when we follow it.`,
        sideQuestTitle: `Give one unfinished clue ten focused minutes`,
      }),
      buildOption({
        key: "prophecy",
        label: postcard.prophecy_line ? "Keep the prophecy" : "Trust our instinct",
        detail: prophecy,
        memoryType: postcard.prophecy_line ? "promise" : "relationship",
        memorySummary: `The user chose to carry this forward from ${postcard.location_name}: ${prophecy}`,
        consequenceTags: [postcard.prophecy_line ? "prophecy" : "instinct", "future", `milestone:${postcard.milestone_percent}`],
        companionReply: `Then it stays between us until the world gives it meaning. I won’t forget.`,
        sideQuestTitle: `Write one sentence about what you think comes next`,
      }),
    ],
  };
}

export interface PostcardDiscovery {
  key: "place" | "clue" | "prophecy";
  label: string;
  title: string;
  text: string;
  positionClassName: string;
}

export function buildPostcardDiscoveries(postcard: CompanionPostcard): PostcardDiscovery[] {
  const candidates: Array<PostcardDiscovery | null> = [
    {
      key: "place",
      label: `Explore ${postcard.location_name}`,
      title: "World detail",
      text: postcard.location_description,
      positionClassName: "left-[18%] top-[62%]",
    },
    postcard.clue_text
      ? {
        key: "clue",
        label: "Reveal mystery clue",
        title: "Companion discovery",
        text: postcard.clue_text,
        positionClassName: "left-[62%] top-[38%]",
      }
      : null,
    postcard.prophecy_line
      ? {
        key: "prophecy",
        label: "Reveal prophecy fragment",
        title: "Prophecy echo",
        text: postcard.prophecy_line,
        positionClassName: "left-[78%] top-[68%]",
      }
      : null,
  ];

  return candidates.filter((candidate): candidate is PostcardDiscovery => Boolean(candidate?.text));
}
