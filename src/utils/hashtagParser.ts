// Hashtag parsing utility for content uploads

export interface ParsedHashtags {
  mentorIds: string[];
  applyToAllMentors: boolean;
  contentType?: string;
  visualRole?: string;
  topics: string[];
  primaryTopic?: string;
  isPremium: boolean;
  date?: string;
}

const MENTOR_SLUG_MAP: Record<string, string> = {
  'mentor_atlas': 'atlas',
  'mentor_kai': 'kai',
  'mentor_eli': 'eli',
  'mentor_nova': 'nova',
  'mentor_sienna': 'sienna',
  'mentor_lumi': 'lumi',
  'mentor_stryker': 'stryker',
  'mentor_carmen': 'carmen',
  'mentor_reign': 'reign',
  'mentor_elizabeth': 'elizabeth',
};

const CONTENT_TYPES = [
  'quote', 'affirmation', 'script', 'caption', 'prompt', 'micromessage'
];

const VISUAL_ROLES = [
  'hero', 'background', 'card', 'cover'
];

/**
 * Parse hashtags from text and extract mentor assignments, content types, topics, etc.
 * @param text - Text containing hashtags (e.g., "#mentor_atlas #type_quote #topic_discipline #premium")
 * @returns Parsed hashtag data
 */
export const parseHashtags = (text: string): ParsedHashtags => {
  const hashtags = text.match(/#[\w_]+/g) || [];
  const result: ParsedHashtags = {
    mentorIds: [],
    applyToAllMentors: false,
    topics: [],
    isPremium: false,
  };

  hashtags.forEach(tag => {
    const cleanTag = tag.toLowerCase().replace('#', '');

    // Check for mentor tags
    if (cleanTag === 'mentor_all') {
      result.applyToAllMentors = true;
    } else if (cleanTag.startsWith('mentor_')) {
      const slug = MENTOR_SLUG_MAP[cleanTag];
      if (slug) {
        result.mentorIds.push(slug);
      }
    }

    // Check for content type tags
    if (cleanTag.startsWith('type_')) {
      const type = cleanTag.replace('type_', '');
      if (CONTENT_TYPES.includes(type)) {
        result.contentType = type;
      } else if (VISUAL_ROLES.includes(type)) {
        result.visualRole = type;
      }
    }

    // Check for topic tags
    if (cleanTag.startsWith('topic_')) {
      const topic = cleanTag.replace('topic_', '');
      result.topics.push(topic);
      if (!result.primaryTopic) {
        result.primaryTopic = topic;
      }
    }

    // Check for premium tag
    if (cleanTag === 'premium') {
      result.isPremium = true;
    }
    if (cleanTag === 'free') {
      result.isPremium = false;
    }

    // Check for date tag
    if (cleanTag.startsWith('date_')) {
      const dateStr = cleanTag.replace('date_', '');
      // Validate YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        result.date = dateStr;
      }
    }
  });

  return result;
};

/**
 * Get all mentor IDs that should be associated with content
 * @param parsedTags - Parsed hashtag data
 * @param allMentorSlugs - Array of all available mentor slugs from database
 * @returns Array of mentor slugs to associate
 */
export const resolveMentorAssignments = (
  parsedTags: ParsedHashtags,
  allMentorSlugs: string[]
): string[] => {
  if (parsedTags.applyToAllMentors) {
    return allMentorSlugs;
  }
  return parsedTags.mentorIds;
};

/**
 * Extract hashtags from text for display/editing
 * @param text - Text to extract hashtags from
 * @returns Array of hashtag strings (including # symbol)
 */
export const extractHashtags = (text: string): string[] => {
  return text.match(/#[\w_]+/g) || [];
};
