/**
 * Helper utilities for calling Firebase Cloud Functions
 * Replaces Supabase Edge Function calls
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "../firebase";

const functions = getFunctions(firebaseApp);

/**
 * Call a Firebase Cloud Function
 */
export async function callFirebaseFunction<T = any, R = any>(
  functionName: string,
  data: T
): Promise<R> {
  const callable = httpsCallable<T, R>(functions, functionName);
  const result = await callable(data);
  return result.data;
}

/**
 * Mentor Chat - AI-powered mentor conversation
 */
export async function mentorChat(data: {
  message: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  mentorName: string;
  mentorTone: string;
}) {
  return callFirebaseFunction<typeof data, {
    response: string;
    dailyLimit: number;
    messagesUsed: number;
  }>("mentorChat", data);
}

/**
 * Generate Evolution Card - AI-powered companion evolution card generation
 */
export async function generateEvolutionCard(data: {
  companionId: string;
  evolutionId: string;
  stage: number;
  species: string;
  element: string;
  color: string;
  userAttributes?: { mind?: number; body?: number; soul?: number };
}) {
  return callFirebaseFunction<typeof data, {
    card: any;
  }>("generateEvolutionCard", data);
}

/**
 * Generate Companion Name - AI-powered companion name generation
 */
export async function generateCompanionName(data: {
  spiritAnimal: string;
  favoriteColor: string;
  coreElement: string;
  userAttributes?: { mind?: number; body?: number; soul?: number };
}) {
  return callFirebaseFunction<typeof data, {
    name: string;
    traits: string[];
    storyText: string;
    loreSeed: string;
  }>("generateCompanionName", data);
}

/**
 * Generate Companion Story - AI-powered companion story chapter generation
 */
export async function generateCompanionStory(data: {
  companionId: string;
  stage: number;
}) {
  return callFirebaseFunction<typeof data, {
    story: any;
  }>("generateCompanionStory", data);
}

/**
 * Generate Daily Missions - AI-powered daily mission generation
 */
export async function generateDailyMissions(data?: {
  forceRegenerate?: boolean;
}) {
  return callFirebaseFunction<typeof data, {
    missions: any[];
    generated: boolean;
  }>("generateDailyMissions", data || {});
}

/**
 * Generate Quotes - AI-powered quote generation
 */
export async function generateQuotes(data: {
  type: "trigger" | "category";
  value: string;
  count?: number;
}) {
  return callFirebaseFunction<typeof data, {
    success: boolean;
    count: number;
  }>("generateQuotes", data);
}

/**
 * Generate Weekly Insights - AI-powered weekly insight generation
 */
export async function generateWeeklyInsights() {
  return callFirebaseFunction<{}, {
    insight: any;
  }>("generateWeeklyInsights", {});
}

/**
 * Generate Weekly Challenges - AI-powered weekly challenge generation
 */
export async function generateWeeklyChallenges() {
  return callFirebaseFunction<{}, {
    challenges: any[];
  }>("generateWeeklyChallenges", {});
}

/**
 * Generate Smart Notifications - AI-powered notification generation
 */
export async function generateSmartNotifications(data: {
  context?: string;
  timeOfDay?: string;
}) {
  return callFirebaseFunction<typeof data, {
    notification: any;
  }>("generateSmartNotifications", data);
}

/**
 * Generate Proactive Nudges - AI-powered nudge generation
 */
export async function generateProactiveNudges(data: {
  userState?: string;
  lastActivity?: string;
}) {
  return callFirebaseFunction<typeof data, {
    nudge: any;
  }>("generateProactiveNudges", data);
}

/**
 * Generate Reflection Reply - AI-powered reflection response generation
 */
export async function generateReflectionReply(data: {
  reflectionText: string;
  mood?: string;
}) {
  return callFirebaseFunction<typeof data, {
    reply: any;
  }>("generateReflectionReply", data);
}

/**
 * Generate Guild Story - AI-powered guild story generation
 */
export async function generateGuildStory(data: {
  guildId: string;
  context?: string;
}) {
  return callFirebaseFunction<typeof data, {
    story: any;
  }>("generateGuildStory", data);
}

/**
 * Generate Cosmic Postcard - AI-powered cosmic postcard generation
 */
export async function generateCosmicPostcard(data: {
  companionId: string;
  occasion?: string;
}) {
  return callFirebaseFunction<typeof data, {
    postcard: any;
  }>("generateCosmicPostcard", data);
}

/**
 * Generate Cosmic Deep Dive - AI-powered cosmic deep dive generation
 */
export async function generateCosmicDeepDive(data: {
  topic: string;
  userContext?: string;
}) {
  return callFirebaseFunction<typeof data, {
    deepDive: any;
  }>("generateCosmicDeepDive", data);
}

/**
 * Generate Daily Horoscope - AI-powered horoscope generation
 */
export async function generateDailyHoroscope(data: {
  zodiacSign: string;
  date?: string;
}) {
  return callFirebaseFunction<typeof data, {
    horoscope: any;
  }>("generateDailyHoroscope", data);
}

/**
 * Generate Mentor Script - AI-powered mentor script generation
 */
export async function generateMentorScript(data: {
  mentorSlug: string;
  topic: string;
  tone?: string;
}) {
  return callFirebaseFunction<typeof data, {
    script: any;
  }>("generateMentorScript", data);
}

/**
 * Generate Mentor Content - AI-powered mentor content generation
 */
export async function generateMentorContent(data: {
  mentorSlug: string;
  contentType: string;
  context?: string;
}) {
  return callFirebaseFunction<typeof data, {
    content: any;
  }>("generateMentorContent", data);
}

/**
 * Generate Lesson - AI-powered lesson generation
 */
export async function generateLesson(data: {
  topic: string;
  level?: string;
  mentorSlug?: string;
}) {
  return callFirebaseFunction<typeof data, {
    lesson: any;
  }>("generateLesson", data);
}

/**
 * Generate Companion Image - AI-powered companion image generation
 */
export async function generateCompanionImage(data: {
  companionId: string;
  stage: number;
  species?: string;
  element?: string;
  color?: string;
}) {
  return callFirebaseFunction<typeof data, {
    imageData: any;
  }>("generateCompanionImage", data);
}

/**
 * Generate Complete Pep Talk - AI-powered complete pep talk generation
 */
export async function generateCompletePepTalk(data: {
  mentorSlug: string;
  topicCategory?: string | string[];
  intensity?: string;
  emotionalTriggers?: string[];
}) {
  return callFirebaseFunction<typeof data, {
    pepTalk: any;
  }>("generateCompletePepTalk", data);
}

/**
 * Generate Check-In Response - AI-powered check-in response generation
 */
export async function generateCheckInResponse(data: {
  checkInId: string;
  checkInData?: any;
}) {
  return callFirebaseFunction<typeof data, {
    checkInResponse: any;
  }>("generateCheckInResponse", data);
}

/**
 * Generate Adaptive Push - AI-powered adaptive push notification generation
 */
export async function generateAdaptivePush(data: {
  mentorId: string;
  category?: string;
  intensity?: string;
  emotionalTriggers?: string[];
  eventContext?: string;
}) {
  return callFirebaseFunction<typeof data, {
    notification: any;
  }>("generateAdaptivePush", data);
}

/**
 * Calculate Cosmic Profile - AI-powered cosmic profile calculation
 */
export async function calculateCosmicProfile() {
  return callFirebaseFunction<{}, {
    cosmicProfile: any;
  }>("calculateCosmicProfile", {});
}

/**
 * Generate Activity Comment - AI-powered activity comment generation
 */
export async function generateActivityComment(data: {
  activityData: any;
  context?: string;
}) {
  return callFirebaseFunction<typeof data, {
    comment: any;
  }>("generateActivityComment", data);
}

/**
 * Generate Mood Push - AI-powered mood-based push notification generation
 */
export async function generateMoodPush(data: {
  mood: string;
  context?: string;
}) {
  return callFirebaseFunction<typeof data, {
    notification: any;
  }>("generateMoodPush", data);
}

/**
 * Generate Inspire Quote - AI-powered inspirational quote generation
 */
export async function generateInspireQuote(data?: {
  context?: string;
  theme?: string;
}) {
  return callFirebaseFunction<typeof data, {
    quote: any;
  }>("generateInspireQuote", data || {});
}

/**
 * Generate Quote Image - AI-powered quote image generation
 */
export async function generateQuoteImage(data: {
  quoteText: string;
  style?: string;
}) {
  return callFirebaseFunction<typeof data, {
    imageData: any;
  }>("generateQuoteImage", data);
}

/**
 * Generate Sample Card - AI-powered sample card generation
 */
export async function generateSampleCard(data?: {
  species?: string;
  element?: string;
  stage?: number;
}) {
  return callFirebaseFunction<typeof data, {
    card: any;
  }>("generateSampleCard", data || {});
}

/**
 * Generate Neglected Companion Image - AI-powered neglected companion image generation
 */
export async function generateNeglectedCompanionImage(data: {
  companionId: string;
  daysSinceLastInteraction?: number;
}) {
  return callFirebaseFunction<typeof data, {
    imageData: any;
  }>("generateNeglectedCompanionImage", data);
}

/**
 * Generate Zodiac Images - AI-powered zodiac image generation
 */
export async function generateZodiacImages(data: {
  zodiacSign: string;
  style?: string;
}) {
  return callFirebaseFunction<typeof data, {
    imageData: any;
  }>("generateZodiacImages", data);
}

/**
 * Get Single Quote - Get a single quote
 */
export async function getSingleQuote(data?: {
  category?: string;
  emotionalTrigger?: string;
}) {
  return callFirebaseFunction<typeof data, {
    quote: any;
  }>("getSingleQuote", data || {});
}

/**
 * Batch Generate Lessons - AI-powered batch lesson generation
 */
export async function batchGenerateLessons(data: {
  topics: string[];
  mentorSlug?: string;
}) {
  return callFirebaseFunction<typeof data, {
    lessons: any[];
  }>("batchGenerateLessons", data);
}

/**
 * Generate Companion Evolution - AI-powered companion evolution generation
 */
export async function generateCompanionEvolution(data: {
  companionId: string;
  currentStage: number;
  targetStage?: number;
}) {
  return callFirebaseFunction<typeof data, {
    evolution: any;
  }>("generateCompanionEvolution", data);
}

/**
 * Generate Daily Quotes - Selects and assigns daily quotes for mentors
 */
export async function generateDailyQuotes() {
  return callFirebaseFunction<{}, {
    success: boolean;
    generated: number;
    skipped: number;
    total: number;
  }>("generateDailyQuotes", {});
}

/**
 * Generate Daily Mentor Pep Talks - AI-powered daily pep talk generation for all mentors
 */
export async function generateDailyMentorPepTalks() {
  return callFirebaseFunction<{}, {
    results: Array<{ mentor: string; status: string; error?: string }>;
  }>("generateDailyMentorPepTalks", {});
}

/**
 * Generate Mentor Audio - Text-to-speech using ElevenLabs
 */
export async function generateMentorAudio(data: {
  mentorSlug: string;
  script: string;
}) {
  return callFirebaseFunction<typeof data, {
    audioUrl: string;
  }>("generateMentorAudio", data);
}

/**
 * Generate Full Mentor Audio - Orchestrates script generation and audio generation
 */
export async function generateFullMentorAudio(data: {
  mentorSlug: string;
  topicCategory?: string | string[];
  intensity?: string;
  emotionalTriggers?: string[];
}) {
  return callFirebaseFunction<typeof data, {
    script: string;
    audioUrl: string;
  }>("generateFullMentorAudio", data);
}

/**
 * Generate Evolution Voice - AI-powered evolution voice line generation using OpenAI GPT-5-mini
 */
export async function generateEvolutionVoice(data: {
  mentorSlug: string;
  newStage: number;
  userId?: string;
}) {
  return callFirebaseFunction<typeof data, {
    voiceLine: string;
    audioContent: string | null;
  }>("generateEvolutionVoice", data);
}

/**
 * Test API Keys - Verify that all API keys are configured correctly
 */
export async function testApiKeys() {
  return callFirebaseFunction<{}, {
    success: boolean;
    message: string;
    keys: Record<string, string>;
    allConfigured: boolean;
  }>("testApiKeys", {});
}

/**
 * Transcribe Audio - Uses OpenAI Whisper API to transcribe audio files
 */
export async function transcribeAudio(data: {
  audioUrl: string;
}) {
  return callFirebaseFunction<typeof data, {
    transcript: Array<{ word: string; start: number; end: number }>;
    text: string;
    duration: number;
  }>("transcribeAudio", data);
}

/**
 * Sync Daily Pep Talk Transcript - Syncs transcript for daily pep talks
 */
export async function syncDailyPepTalkTranscript(data: {
  id?: string;
  mentorSlug?: string;
  forDate?: string;
}) {
  return callFirebaseFunction<typeof data, {
    id: string;
    script: string;
    transcript: Array<{ word: string; start: number; end: number }>;
    changed: boolean;
  }>("syncDailyPepTalkTranscript", data);
}

/**
 * Seed Real Quotes - Seeds real quotes into the database
 */
export async function seedRealQuotes() {
  return callFirebaseFunction<{}, {
    success: boolean;
    message: string;
    inserted: number;
    total: number;
  }>("seedRealQuotes", {});
}

/**
 * Reset Companion - Resets/deletes a user's companion and related data
 */
export async function resetCompanion() {
  return callFirebaseFunction<{}, {
    success: boolean;
    message?: string;
  }>("resetCompanion", {});
}

/**
 * Create Influencer Code - Creates influencer referral codes
 */
export async function createInfluencerCode(data: {
  name: string;
  email: string;
  handle: string;
  paypalEmail: string;
  promotionChannel?: string;
}) {
  return callFirebaseFunction<typeof data, {
    code: string;
    link: string;
    promo_caption?: string;
    message?: string;
  }>("createInfluencerCode", data);
}

/**
 * Process PayPal Payout - Processes PayPal payouts for referral rewards
 */
export async function processPaypalPayout(data: {
  payoutId: string;
}) {
  return callFirebaseFunction<typeof data, {
    success: boolean;
    payout_batch_id: string;
    amount: number;
    recipient: string;
  }>("processPaypalPayout", data);
}

/**
 * Complete Referral Stage 3 - Atomically processes referral completion when a user reaches Stage 3
 */
export async function completeReferralStage3(data: {
  referee_id: string;
  referrer_id: string;
}) {
  return callFirebaseFunction<typeof data, {
    success: boolean;
    reason?: string;
    message?: string;
    newCount?: number;
    skinUnlocked?: boolean;
    unlockedSkinId?: string;
    milestoneReached?: boolean;
  }>("completeReferralStage3", data);
}

/**
 * Resolve Streak Freeze - Handles streak freeze resolution (use freeze or reset streak)
 */
export async function resolveStreakFreeze(data: {
  action: "use_freeze" | "reset_streak";
}) {
  return callFirebaseFunction<typeof data, {
    success: boolean;
    newStreak: number;
    freezesRemaining: number;
    action: "freeze_used" | "streak_reset";
  }>("resolveStreakFreeze", data);
}

/**
 * Verify Apple Receipt - Verifies an Apple receipt and updates subscription status
 */
export async function verifyAppleReceipt(data: {
  receipt: string;
}) {
  return callFirebaseFunction<typeof data, {
    success: boolean;
    plan: "monthly" | "yearly";
    status: string;
    expiresAt: string;
    environment?: string;
  }>("verifyAppleReceipt", data);
}

/**
 * Check Apple Subscription - Returns the current subscription status for a user
 */
export async function checkAppleSubscription() {
  return callFirebaseFunction<{}, {
    subscribed: boolean;
    status?: string;
    plan?: "monthly" | "yearly";
    subscription_end?: string;
  }>("checkAppleSubscription", {});
}

