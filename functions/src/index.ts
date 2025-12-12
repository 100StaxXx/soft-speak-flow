import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import type { CallableRequest } from "firebase-functions/v2/https";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { callGemini, parseGeminiJSON } from "./gemini";

admin.initializeApp();

// Define secrets for PayPal
const paypalClientId = defineSecret("PAYPAL_CLIENT_ID");
const paypalSecret = defineSecret("PAYPAL_SECRET");

// Define secrets for VAPID (Web Push)
const vapidPublicKey = defineSecret("VAPID_PUBLIC_KEY");
const vapidPrivateKey = defineSecret("VAPID_PRIVATE_KEY");
const vapidSubject = defineSecret("VAPID_SUBJECT");

// Define secrets for APNS (iOS Push Notifications)
const apnsKeyId = defineSecret("APNS_KEY_ID");
const apnsTeamId = defineSecret("APNS_TEAM_ID");
const apnsBundleId = defineSecret("APNS_BUNDLE_ID");
const apnsAuthKey = defineSecret("APNS_AUTH_KEY");
const apnsEnvironment = defineSecret("APNS_ENVIRONMENT");

// Define secrets for Apple Subscriptions
const appleSharedSecret = defineSecret("APPLE_SHARED_SECRET");
const appleServiceId = defineSecret("APPLE_SERVICE_ID");
const appleIosBundleId = defineSecret("APPLE_IOS_BUNDLE_ID");
const appleWebhookAudience = defineSecret("APPLE_WEBHOOK_AUDIENCE");

// Define secret for Gemini API
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Define secrets for OpenAI and ElevenLabs API
const openaiApiKey = defineSecret("OPENAI_API_KEY");
const elevenlabsApiKey = defineSecret("ELEVENLABS_API_KEY");

/**
 * Generate a companion name using AI
 * Uses the same rules as the original Supabase edge function
 */
export const generateCompanionName = onCall(
  {
    secrets: [geminiApiKey],
  },
  async (request: CallableRequest<{
    spiritAnimal: string;
    favoriteColor: string;
    coreElement: string;
    userAttributes?: { mind?: number; body?: number; soul?: number };
  }>) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated to generate companion name"
      );
    }

    const { spiritAnimal, favoriteColor, coreElement, userAttributes } = request.data;

    if (!spiritAnimal || !favoriteColor || !coreElement) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: spiritAnimal, favoriteColor, coreElement"
      );
    }

    try {
      const apiKey = geminiApiKey.value();

      // Determine personality based on user attributes
      const personality = (userAttributes?.body ?? 0) > 60
        ? "powerful and energetic"
        : (userAttributes?.mind ?? 0) > 60
        ? "wise and focused"
        : (userAttributes?.soul ?? 0) > 60
        ? "compassionate and deeply connected"
        : "mysterious and evolving";

      const vibes = "curious, cute, eager"; // Initial stage vibes

      // Build AI prompt with the same rules as the original function
      const systemPrompt = "You are a creative card game designer. Always respond with valid JSON only.";
      const userPrompt = `You are a master fantasy creature naming expert. Generate a UNIQUE, ORIGINAL creature name for this companion's FIRST evolution.

CREATURE ATTRIBUTES:
- Species: ${spiritAnimal}
- Element: ${coreElement}
- Primary Color: ${favoriteColor}
- Secondary Color: ${coreElement} undertones
- Personality: ${personality}
- Vibes: ${vibes}
- Evolution Stage: 0/20
- Rarity: Common

NAME GENERATION RULES:
• Create a PROPER CHARACTER NAME - like naming a protagonist in a fantasy novel
• 1-2 words maximum
• Must be mythic, elegant, and slightly otherworldly
• Easy to pronounce
• ABSOLUTELY NO generic animal words: pup, puppy, cub, wolf, fox, dragon, tiger, kitten, bird, hound, beast, etc.
• ABSOLUTELY NO descriptive/stage words: baby, young, elder, ancient, little, big, small, tiny
• NO element + species combos (e.g., "Fire Wolf", "Storm Tiger", "Lightning Pup")
• NO references to Pokémon, Digimon, Marvel, Warcraft, or mythology
• NO real-world names
• NO numbers
• Must feel ORIGINAL and fresh - a unique fantasy NAME, not a description

GOOD EXAMPLES: Zephyros, Voltrix, Lumara, Aelion, Nyxara, Embris, Kaelthos, Seraphis, Thalox, Veyra
BAD EXAMPLES: Fire Pup, Storm Wolf, Lightning Cub, Shadow Fox, Flame Dragon, Thunder Beast, Fulmen Pup

Generate a card with these exact fields in JSON:

{
  "creature_name": "Generate a unique name following all rules above. This will be permanent.",
  "traits": ["3-5 dynamic trait names that reflect the creature's abilities at stage 0"],
  "story_text": "2-4 paragraphs telling the origin story of this newly awakened creature. Use the generated name throughout.",
  "lore_seed": "One mysterious sentence hinting at the creature's destiny, mentioning its name"
}

Make it LEGENDARY. This is the birth of a companion.`;

      // Call Gemini API using helper
      const geminiResponse = await callGemini(userPrompt, systemPrompt, {
        temperature: 0.9,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }, apiKey);

      // Parse JSON from AI response
      let cardData;
      try {
        cardData = parseGeminiJSON(geminiResponse.text);
      } catch (e) {
        console.error("Failed to parse AI response:", geminiResponse.text);
        throw new HttpsError(
          "internal",
          "AI response was not valid JSON"
        );
      }

      if (!cardData.creature_name) {
        throw new HttpsError(
          "internal",
          "AI did not generate a creature name"
        );
      }

      return {
        name: cardData.creature_name,
        traits: cardData.traits || [],
        storyText: cardData.story_text || "",
        loreSeed: cardData.lore_seed || "",
      };
    } catch (error) {
      console.error("Error generating companion name:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new HttpsError(
        "internal",
        `Failed to generate companion name: ${errorMessage}`
      );
    }
  }
);

/**
 * Delete user account and all associated data from Firestore
 * This function deletes:
 * - Profile document
 * - User companion and related data (evolutions, cards, postcards, stories)
 * - Daily missions and tasks
 * - Achievements
 * - Favorites
 * - XP events
 * - And other user-related collections
 * 
 * Then deletes the Firebase Auth user
 */
export const deleteUserAccount = functions.https.onCall(
  async (request) => {
    // Verify the user is authenticated
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated to delete their account"
      );
    }

    const userId = request.auth.uid;

  try {
    const db = admin.firestore();
    const batch = db.batch();

    // Collections to delete documents from (where user_id field exists)
    const collectionsWithUserId = [
      "user_companion",
      "daily_missions",
      "daily_tasks",
      "achievements",
      "favorites",
      "xp_events",
      "companion_postcards",
      "companion_stories",
      "habit_completions",
      "user_challenges",
      "challenge_progress",
      "epic_members",
      "epic_progress_log",
      "guild_shouts",
      "guild_rivalries",
      "referral_payouts",
      "referral_codes",
      "push_subscriptions",
      "user_subscriptions",
    ];

    // Delete documents from collections with user_id field
    for (const collectionName of collectionsWithUserId) {
      const snapshot = await db
        .collection(collectionName)
        .where("user_id", "==", userId)
        .get();

      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
    }

    // Delete companion-related data (where companion_id references user's companion)
    const companionSnapshot = await db
      .collection("user_companion")
      .where("user_id", "==", userId)
      .get();

    const companionIds: string[] = [];
    companionSnapshot.docs.forEach((doc) => {
      companionIds.push(doc.id);
      batch.delete(doc.ref);
    });

    // Delete companion evolutions and cards
    for (const companionId of companionIds) {
      const evolutionsSnapshot = await db
        .collection("companion_evolutions")
        .where("companion_id", "==", companionId)
        .get();

      evolutionsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      const cardsSnapshot = await db
        .collection("companion_evolution_cards")
        .where("companion_id", "==", companionId)
        .get();

      cardsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
    }

    // Delete profile document (document ID = userId)
    const profileRef = db.collection("profiles").doc(userId);
    batch.delete(profileRef);

    // Commit all deletions
    await batch.commit();

    // Delete the Firebase Auth user
    await admin.auth().deleteUser(userId);

    return { success: true };
  } catch (error) {
    console.error("Error deleting user account:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new functions.https.HttpsError(
      "internal",
      `Failed to delete account: ${errorMessage}`
    );
  }
});

/**
 * Mentor Chat - AI-powered mentor conversation
 * Migrated from Supabase Edge Function to Firebase Cloud Function
 */
export const mentorChat = onCall(
  {
    secrets: [geminiApiKey],
  },
  async (request: CallableRequest<{
    message: string;
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
    mentorName: string;
    mentorTone: string;
  }>) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const { message, conversationHistory, mentorName, mentorTone } = request.data;

    if (!message || !mentorName || !mentorTone) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: message, mentorName, mentorTone"
      );
    }

    try {
      const userId = request.auth.uid;
      const db = admin.firestore();
      const apiKey = geminiApiKey.value();

      // Check daily message limit (10 messages per day)
      const DAILY_MESSAGE_LIMIT = 10;
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const todayMessages = await db
        .collection("mentor_chats")
        .where("user_id", "==", userId)
        .where("role", "==", "user")
        .where("created_at", ">=", startOfDay)
        .get();

      if (todayMessages.size >= DAILY_MESSAGE_LIMIT) {
        throw new HttpsError(
          "resource-exhausted",
          `Daily limit of ${DAILY_MESSAGE_LIMIT} messages reached`
        );
      }

      // Build conversation context
      const contextualInfo =
        conversationHistory && conversationHistory.length > 0
          ? `Recent conversation context:\n${conversationHistory
              .slice(-3)
              .map((m: any) => `${m.role}: ${m.content}`)
              .join("\n")}`
          : "";

      // Build system prompt
      const systemPrompt = `You are ${mentorName}, a supportive and motivating mentor. Your tone and style: ${mentorTone}

Guidelines:
- Be concise (2-4 sentences maximum)
- Stay in character as ${mentorName}
- Provide actionable, encouraging advice
- Match the tone: ${mentorTone}
- Be empathetic and understanding
- Focus on growth and positive outcomes`;

      // Build user prompt
      const userPrompt = contextualInfo
        ? `${contextualInfo}\n\nUser's current message: ${message}\n\nRespond as ${mentorName} would, staying true to your tone and style.`
        : `User's message: ${message}\n\nRespond as ${mentorName} would, staying true to your tone and style.`;

      // Call Gemini API
      const geminiResponse = await callGemini(userPrompt, systemPrompt, {
        temperature: 0.8,
        maxOutputTokens: 500,
      }, apiKey);

      const assistantMessage = geminiResponse.text.trim();

      // Save conversation to Firestore
      const batch = db.batch();
      const userMsgRef = db.collection("mentor_chats").doc();
      const assistantMsgRef = db.collection("mentor_chats").doc();

      batch.set(userMsgRef, {
        user_id: userId,
        role: "user",
        content: message,
        mentor_name: mentorName,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      batch.set(assistantMsgRef, {
        user_id: userId,
        role: "assistant",
        content: assistantMessage,
        mentor_name: mentorName,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();

      return {
        response: assistantMessage,
        dailyLimit: DAILY_MESSAGE_LIMIT,
        messagesUsed: todayMessages.size + 1,
      };
    } catch (error) {
      console.error("Error in mentorChat:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new HttpsError(
        "internal",
        `Failed to generate mentor response: ${errorMessage}`
      );
    }
  }
);

/**
 * Generate Evolution Card - AI-powered companion evolution card generation
 * Migrated from Supabase Edge Function to Firebase Cloud Function
 */
export const generateEvolutionCard = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const {
    companionId,
    evolutionId,
    stage,
    species,
    element,
    color,
    userAttributes,
  } = request.data;

  if (
    !companionId ||
    !evolutionId ||
    stage === undefined ||
    !species ||
    !element ||
    !color
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields: companionId, evolutionId, stage, species, element, color"
    );
  }

  try {
    const userId = request.auth.uid;
    const db = admin.firestore();

    // Check if companion already has cards with a name (to maintain consistency)
    const existingCardsSnapshot = await db
      .collection("companion_evolution_cards")
      .where("companion_id", "==", companionId)
      .orderBy("evolution_stage", "asc")
      .limit(1)
      .get();

    const existingName =
      existingCardsSnapshot.docs.length > 0
        ? existingCardsSnapshot.docs[0].data().creature_name || null
        : null;

    // Generate card ID
    const randomHex = crypto.randomUUID().split("-")[0].toUpperCase();
    const cardId = `ALP-${species.toUpperCase()}-${userId.split("-")[0].toUpperCase()}-E${stage}-${randomHex}`;

    // Determine rarity based on stage
    let rarity = "Common";
    if (stage >= 19) rarity = "Origin";
    else if (stage >= 16) rarity = "Primal";
    else if (stage >= 13) rarity = "Celestial";
    else if (stage >= 10) rarity = "Mythic";
    else if (stage >= 7) rarity = "Legendary";
    else if (stage >= 4) rarity = "Epic";
    else if (stage >= 1) rarity = "Rare";

    // Calculate stats (simplified - you may want to port the full cardMath logic)
    const baseStats = {
      attack: Math.floor(10 + stage * 5),
      defense: Math.floor(10 + stage * 5),
      speed: Math.floor(10 + stage * 3),
    };

    const energyCost = Math.max(1, Math.floor(stage / 2));
    const frameType = `${element.toLowerCase()}-frame`;

    // Determine personality and vibes
    const personality =
      userAttributes?.body > 60
        ? "powerful and energetic"
        : userAttributes?.mind > 60
        ? "wise and focused"
        : userAttributes?.soul > 60
        ? "compassionate and deeply connected"
        : "mysterious and evolving";

    const vibes =
      stage >= 15
        ? "ancient, radiant, transcendent"
        : stage >= 10
        ? "majestic, powerful, legendary"
        : stage >= 5
        ? "fierce, loyal, determined"
        : "curious, cute, eager";

    // Stage 20 Special: Generate personalized ultimate title
    let finalCreatureName = existingName;
    let skipAI = false;

    if (stage === 20 && !existingName) {
      const powerTitles = [
        "Sovereign",
        "Apex",
        "Colossus",
        "Warlord",
        "Primeborn",
        "Overlord",
        "Sentinel",
        "Emperor",
        "Archon",
        "Omega",
      ];
      const randomTitle =
        powerTitles[Math.floor(Math.random() * powerTitles.length)];
      finalCreatureName = `${element} ${randomTitle} ${species}`;
      skipAI = true;
    }

    let cardData;

    if (skipAI) {
      // For Stage 20 ultimate form, use pre-generated title
      cardData = {
        creature_name: finalCreatureName,
        traits: [
          "Ultimate Power",
          "Legendary Presence",
          "Peak Evolution",
          "Unstoppable Force",
          "Eternal Bond",
        ],
        story_text: `At the pinnacle of evolution, ${finalCreatureName} stands as the ultimate manifestation of power and bond. This legendary ${species} has transcended all limits, becoming a force of nature itself. The ${element.toLowerCase()} energy that flows through them is unmatched, a testament to the countless battles fought and lessons learned throughout their journey.\n\nTheir bond with their companion has reached its absolute peak, creating a connection that goes beyond the physical realm. Every action, every thought, perfectly synchronized. They are no longer just partners—they are one.\n\nThe world trembles at the mere presence of ${finalCreatureName}, not out of fear, but in awe of what dedication and perseverance can achieve. This is the ultimate form—the peak of all possibilities.`,
        lore_seed: `Legends speak of ${finalCreatureName} as the harbinger of a new era, where the boundaries between companion and master dissolve into pure unity.`,
      };
    } else {
      // Build AI prompt
      let aiPrompt;
      if (existingName) {
        aiPrompt = `You are a master storyteller continuing the legend of a companion creature named "${existingName}".

CREATURE ATTRIBUTES:
- Name: ${existingName} (DO NOT CHANGE THIS)
- Species: ${species}
- Element: ${element}
- Evolution Stage: ${stage}/20 (evolved from stage ${stage - 1})
- Rarity: ${rarity}
- Personality: ${personality}

Generate a card with these exact fields in JSON:

{
  "creature_name": "${existingName}",
  "traits": ["3-5 dynamic trait names that reflect ${existingName}'s NEW abilities at stage ${stage}"],
  "story_text": "2-4 paragraphs telling how ${existingName} has evolved to stage ${stage}. Make it epic and personal, showing growth and new power.",
  "lore_seed": "One mysterious sentence about ${existingName}'s destiny or deeper mythology"
}

Make it LEGENDARY. ${existingName} is growing stronger.`;
      } else {
        aiPrompt = `You are a master fantasy creature naming expert. Generate a UNIQUE, ORIGINAL creature name for this companion's FIRST evolution.

CREATURE ATTRIBUTES:
- Species: ${species}
- Element: ${element}
- Primary Color: ${color}
- Secondary Color: ${element} undertones
- Personality: ${personality}
- Vibes: ${vibes}
- Evolution Stage: ${stage}/20
- Rarity: ${rarity}

NAME GENERATION RULES:
• Create a PROPER CHARACTER NAME - like naming a protagonist in a fantasy novel
• 1-2 words maximum
• Must be mythic, elegant, and slightly otherworldly
• Easy to pronounce
• ABSOLUTELY NO generic animal words: pup, puppy, cub, wolf, fox, dragon, tiger, kitten, bird, hound, beast, etc.
• ABSOLUTELY NO descriptive/stage words: baby, young, elder, ancient, little, big, small, tiny
• NO element + species combos (e.g., "Fire Wolf", "Storm Tiger", "Lightning Pup")
• NO references to Pokémon, Digimon, Marvel, Warcraft, or mythology
• NO real-world names
• NO numbers
• Must feel ORIGINAL and fresh - a unique fantasy NAME, not a description

GOOD EXAMPLES: Zephyros, Voltrix, Lumara, Aelion, Nyxara, Embris, Kaelthos, Seraphis, Thalox, Veyra
BAD EXAMPLES: Fire Pup, Storm Wolf, Lightning Cub, Shadow Fox, Flame Dragon, Thunder Beast, Fulmen Pup

Generate a card with these exact fields in JSON:

{
  "creature_name": "Generate a unique name following all rules above. This will be permanent.",
  "traits": ["3-5 dynamic trait names that reflect the creature's abilities at stage ${stage}"],
  "story_text": "2-4 paragraphs telling the origin story of this newly awakened creature. Use the generated name throughout.",
  "lore_seed": "One mysterious sentence hinting at the creature's destiny, mentioning its name"
}

Make it LEGENDARY. This is the birth of a companion.`;
      }

      // Call Gemini API
      const geminiResponse = await callGemini(
        aiPrompt,
        "You are a creative card game designer. Always respond with valid JSON only.",
        {
          temperature: 0.9,
          maxOutputTokens: 2048,
        }
      );

      cardData = parseGeminiJSON(geminiResponse.text);
    }

    if (!cardData.creature_name) {
      throw new functions.https.HttpsError(
        "internal",
        "AI did not generate a creature name"
      );
    }

    // Calculate bond level (simplified)
    const bondLevel = Math.min(100, Math.floor(stage * 5));

    // Save card to Firestore
    const cardRef = db.collection("companion_evolution_cards").doc();
    await cardRef.set({
      card_id: cardId,
      user_id: userId,
      companion_id: companionId,
      evolution_id: evolutionId,
      evolution_stage: stage,
      creature_name: cardData.creature_name,
      species: species,
      element: element,
      stats: baseStats,
      traits: cardData.traits || [],
      story_text: cardData.story_text || "",
      lore_seed: cardData.lore_seed || "",
      bond_level: bondLevel,
      rarity: rarity,
      frame_type: frameType,
      energy_cost: energyCost,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const card = await cardRef.get();

    return {
      card: { id: card.id, ...card.data() },
    };
  } catch (error) {
    console.error("Error in generateEvolutionCard:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new functions.https.HttpsError(
      "internal",
      `Failed to generate evolution card: ${errorMessage}`
    );
  }
});

// ============================================================================
// BATCH MIGRATION: All remaining AI generation functions
// These are simplified versions - we'll refine them after testing
// ============================================================================

/**
 * Generate Companion Story - AI-powered companion story chapter generation
 */
export const generateCompanionStory = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  const { companionId, stage } = request.data;
  if (!companionId || stage === undefined) {
    throw new functions.https.HttpsError("invalid-argument", "Missing companionId or stage");
  }

  try {
    const userId = request.auth.uid;
    const db = admin.firestore();

    // Get companion data
    const companionDoc = await db.collection("user_companion").doc(companionId).get();
    if (!companionDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Companion not found");
    }
    const companion = companionDoc.data()!;
    if (companion.user_id !== userId) {
      throw new functions.https.HttpsError("permission-denied", "Unauthorized");
    }

    // Get profile for user context
    const profileDoc = await db.collection("profiles").doc(userId).get();
    const profile = profileDoc.data() || {};
    const onboardingData = profile.onboarding_data || {};
    const userGoal = onboardingData.userGoal || "achieving personal growth";

    // Build story prompt
    const prompt = `Generate a story chapter for a companion creature at evolution stage ${stage}.

Companion Details:
- Species: ${companion.spirit_animal}
- Element: ${companion.core_element}
- Color: ${companion.favorite_color}
- Stage: ${stage}/20
- User Goal: ${userGoal}

Generate a JSON object with:
{
  "chapter_title": "A cinematic title",
  "intro_line": "Opening line",
  "main_story": "250-400 word story chapter",
  "bond_moment": "Emotional connection moment",
  "life_lesson": "Metaphorical lesson",
  "lore_expansion": ["World truth", "Historical reference", "Foreshadowing"],
  "next_hook": "Cliffhanger for next chapter"
}`;

    const response = await callGemini(prompt, "You are a master storyteller. Always respond with valid JSON only.", {
      temperature: 0.9,
      maxOutputTokens: 2048,
    });

    const storyData = parseGeminiJSON(response.text);

    // Save to Firestore
    const storyRef = db.collection("companion_stories").doc();
    await storyRef.set({
      companion_id: companionId,
      user_id: userId,
      stage: stage,
      ...storyData,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { story: { id: storyRef.id, ...storyData } };
  } catch (error) {
    console.error("Error in generateCompanionStory:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Daily Missions - AI-powered daily mission generation
 */
export const generateDailyMissions = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const userId = request.auth.uid;
    const db = admin.firestore();

    // Get user streak
    const profileDoc = await db.collection("profiles").doc(userId).get();
    const profile = profileDoc.data() || {};
    const streak = profile.current_habit_streak || 0;

    const today = new Date().toISOString().split("T")[0];

    // Check if missions already exist
    const existingMissions = await db
      .collection("daily_missions")
      .where("user_id", "==", userId)
      .where("mission_date", "==", today)
      .get();

    if (!existingMissions.empty && !request.data.forceRegenerate) {
      return {
        missions: existingMissions.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        generated: false,
      };
    }

    // Generate missions
    const prompt = `Generate 3 personalized daily missions for a user with a ${streak}-day streak.

Mission Categories:
1. Connection Mission (5-10 XP, easy) - Light positive interaction
2. Quick Win Mission (5-10 XP, easy/medium) - 1-5 minute task
3. Identity Mission (10-15 XP, medium/hard) - Reinforces future self

Return JSON array:
[{
  "mission": "Mission text (max 80 chars)",
  "xp": 5-15,
  "category": "connection|quick_win|identity",
  "difficulty": "easy|medium|hard"
}]`;

    const response = await callGemini(prompt, "You are a motivational coach. Always respond with valid JSON only.", {
      temperature: 0.9,
      maxOutputTokens: 1024,
    });

    const missions = parseGeminiJSON(response.text);

    // Save to Firestore
    const batch = db.batch();
    missions.forEach((mission: any) => {
      const missionRef = db.collection("daily_missions").doc();
      batch.set(missionRef, {
        user_id: userId,
        mission_date: today,
        mission_text: mission.mission,
        mission_type: mission.category,
        category: mission.category,
        xp_reward: mission.xp || 10,
        difficulty: mission.difficulty || "medium",
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    return { missions, generated: true };
  } catch (error) {
    console.error("Error in generateDailyMissions:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Quotes - AI-powered quote generation
 */
export const generateQuotes = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  const { type, value, count = 5 } = request.data;
  if (!type || !value) {
    throw new functions.https.HttpsError("invalid-argument", "Missing type or value");
  }

  try {
    const prompt = type === "trigger"
      ? `Generate ${count} short, authentic quotes for someone feeling "${value}". Each must include an author. Return JSON array: [{"text": "quote", "author": "name"}]`
      : `Generate ${count} inspiring quotes related to "${value}". Each must include an author. Return JSON array: [{"text": "quote", "author": "name"}]`;

    const response = await callGemini(prompt, "You are a quote generator. Always respond with valid JSON only.", {
      temperature: 0.9,
      maxOutputTokens: 1024,
    });

    const quotes = parseGeminiJSON(response.text);

    // Save to Firestore
    const db = admin.firestore();
    const batch = db.batch();
    quotes.forEach((quote: any) => {
      const quoteRef = db.collection("quotes").doc();
      batch.set(quoteRef, {
        text: quote.text,
        author: quote.author || "Anonymous",
        category: type === "category" ? value : null,
        emotional_triggers: type === "trigger" ? [value] : null,
        intensity: "moderate",
        is_premium: false,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    return { success: true, count: quotes.length };
  } catch (error) {
    console.error("Error in generateQuotes:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Weekly Insights - AI-powered weekly insight generation
 */
export const generateWeeklyInsights = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const userId = request.auth.uid;
    const db = admin.firestore();

    // Get user activity data
    const tasksSnapshot = await db
      .collection("daily_tasks")
      .where("user_id", "==", userId)
      .where("completed_at", ">=", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .get();

    const completedTasks = tasksSnapshot.size;
    const prompt = `Generate a personalized weekly insight based on user completing ${completedTasks} tasks this week. Return JSON: {"insight": "text", "recommendations": ["rec1", "rec2"]}`;

    const response = await callGemini(prompt, "You are a personal growth coach. Always respond with valid JSON only.", {
      temperature: 0.8,
      maxOutputTokens: 512,
    });

    const insight = parseGeminiJSON(response.text);

    return { insight };
  } catch (error) {
    console.error("Error in generateWeeklyInsights:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Weekly Challenges - AI-powered weekly challenge generation
 */
export const generateWeeklyChallenges = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const prompt = `Generate 3 weekly challenges for personal growth. Return JSON array: [{"title": "Challenge", "description": "Details", "xp": 50}]`;

    const response = await callGemini(prompt, "You are a challenge designer. Always respond with valid JSON only.", {
      temperature: 0.9,
      maxOutputTokens: 1024,
    });

    const challenges = parseGeminiJSON(response.text);
    return { challenges };
  } catch (error) {
    console.error("Error in generateWeeklyChallenges:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Smart Notifications - AI-powered notification generation
 */
export const generateSmartNotifications = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { context, timeOfDay } = request.data;
    const prompt = `Generate a smart, personalized notification for ${timeOfDay || "now"} based on: ${context || "general motivation"}. Return JSON: {"title": "Title", "body": "Message"}`;

    const response = await callGemini(prompt, "You are a notification writer. Always respond with valid JSON only.", {
      temperature: 0.8,
      maxOutputTokens: 256,
    });

    const notification = parseGeminiJSON(response.text);
    return { notification };
  } catch (error) {
    console.error("Error in generateSmartNotifications:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Proactive Nudges - AI-powered nudge generation
 */
export const generateProactiveNudges = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { userState, lastActivity } = request.data;
    const prompt = `Generate a proactive nudge for a user. State: ${userState || "active"}, Last activity: ${lastActivity || "recent"}. Return JSON: {"nudge": "Message"}`;

    const response = await callGemini(prompt, "You are a nudge generator. Always respond with valid JSON only.", {
      temperature: 0.8,
      maxOutputTokens: 256,
    });

    const nudge = parseGeminiJSON(response.text);
    return { nudge };
  } catch (error) {
    console.error("Error in generateProactiveNudges:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Reflection Reply - AI-powered reflection response generation
 */
export const generateReflectionReply = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { reflectionText, mood } = request.data;
    if (!reflectionText) {
      throw new functions.https.HttpsError("invalid-argument", "Missing reflectionText");
    }

    const prompt = `Generate a thoughtful, supportive reply to this reflection: "${reflectionText}". Mood: ${mood || "neutral"}. Return JSON: {"reply": "Response text"}`;

    const response = await callGemini(prompt, "You are a supportive coach. Always respond with valid JSON only.", {
      temperature: 0.8,
      maxOutputTokens: 512,
    });

    const reply = parseGeminiJSON(response.text);
    return { reply };
  } catch (error) {
    console.error("Error in generateReflectionReply:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Guild Story - AI-powered guild story generation
 */
export const generateGuildStory = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { guildId, context } = request.data;
    if (!guildId) {
      throw new functions.https.HttpsError("invalid-argument", "Missing guildId");
    }

    const prompt = `Generate a guild story based on: ${context || "guild activity"}. Return JSON: {"title": "Story Title", "content": "Story text"}`;

    const response = await callGemini(prompt, "You are a storyteller. Always respond with valid JSON only.", {
      temperature: 0.9,
      maxOutputTokens: 1024,
    });

    const story = parseGeminiJSON(response.text);

    // Save to Firestore
    const db = admin.firestore();
    const storyRef = db.collection("guild_stories").doc();
    await storyRef.set({
      guild_id: guildId,
      ...story,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { story: { id: storyRef.id, ...story } };
  } catch (error) {
    console.error("Error in generateGuildStory:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Cosmic Postcard - AI-powered cosmic postcard generation
 */
export const generateCosmicPostcard = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { companionId, occasion } = request.data;
    if (!companionId) {
      throw new functions.https.HttpsError("invalid-argument", "Missing companionId");
    }

    const prompt = `Generate a cosmic postcard message for occasion: ${occasion || "general encouragement"}. Return JSON: {"message": "Postcard text", "theme": "cosmic theme"}`;

    const response = await callGemini(prompt, "You are a cosmic postcard writer. Always respond with valid JSON only.", {
      temperature: 0.9,
      maxOutputTokens: 512,
    });

    const postcard = parseGeminiJSON(response.text);

    // Save to Firestore
    const db = admin.firestore();
    const postcardRef = db.collection("companion_postcards").doc();
    await postcardRef.set({
      companion_id: companionId,
      user_id: request.auth.uid,
      ...postcard,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { postcard: { id: postcardRef.id, ...postcard } };
  } catch (error) {
    console.error("Error in generateCosmicPostcard:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Cosmic Deep Dive - AI-powered cosmic deep dive generation
 */
export const generateCosmicDeepDive = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { topic, userContext } = request.data;
    if (!topic) {
      throw new functions.https.HttpsError("invalid-argument", "Missing topic");
    }

    const prompt = `Generate a cosmic deep dive on: ${topic}. Context: ${userContext || "general"}. Return JSON: {"title": "Title", "content": "Deep dive content", "insights": ["insight1", "insight2"]}`;

    const response = await callGemini(prompt, "You are a cosmic wisdom guide. Always respond with valid JSON only.", {
      temperature: 0.9,
      maxOutputTokens: 2048,
    });

    const deepDive = parseGeminiJSON(response.text);
    return { deepDive };
  } catch (error) {
    console.error("Error in generateCosmicDeepDive:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Daily Horoscope - AI-powered horoscope generation
 */
export const generateDailyHoroscope = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { zodiacSign, date } = request.data;
    if (!zodiacSign) {
      throw new functions.https.HttpsError("invalid-argument", "Missing zodiacSign");
    }

    const prompt = `Generate a daily horoscope for ${zodiacSign} on ${date || "today"}. Return JSON: {"horoscope": "Horoscope text", "lucky_number": 7, "mood": "positive"}`;

    const response = await callGemini(prompt, "You are an astrologer. Always respond with valid JSON only.", {
      temperature: 0.8,
      maxOutputTokens: 512,
    });

    const horoscope = parseGeminiJSON(response.text);
    return { horoscope };
  } catch (error) {
    console.error("Error in generateDailyHoroscope:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Mentor Script - AI-powered mentor script generation
 */
export const generateMentorScript = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { mentorSlug, topic, tone } = request.data;
    if (!mentorSlug || !topic) {
      throw new functions.https.HttpsError("invalid-argument", "Missing mentorSlug or topic");
    }

    const prompt = `Generate a mentor script for ${mentorSlug} on topic: ${topic}. Tone: ${tone || "encouraging"}. Return JSON: {"script": "Script text", "duration": 60}`;

    const response = await callGemini(prompt, "You are a script writer. Always respond with valid JSON only.", {
      temperature: 0.8,
      maxOutputTokens: 1024,
    });

    const script = parseGeminiJSON(response.text);
    return { script };
  } catch (error) {
    console.error("Error in generateMentorScript:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Mentor Content - AI-powered mentor content generation
 */
export const generateMentorContent = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { mentorSlug, contentType, context } = request.data;
    if (!mentorSlug || !contentType) {
      throw new functions.https.HttpsError("invalid-argument", "Missing mentorSlug or contentType");
    }

    const prompt = `Generate ${contentType} content for mentor ${mentorSlug}. Context: ${context || "general"}. Return JSON: {"content": "Content text"}`;

    const response = await callGemini(prompt, "You are a content creator. Always respond with valid JSON only.", {
      temperature: 0.8,
      maxOutputTokens: 1024,
    });

    const content = parseGeminiJSON(response.text);
    return { content };
  } catch (error) {
    console.error("Error in generateMentorContent:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Lesson - AI-powered lesson generation
 */
export const generateLesson = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { topic, level, mentorSlug } = request.data;
    if (!topic) {
      throw new functions.https.HttpsError("invalid-argument", "Missing topic");
    }

    const prompt = `Generate a lesson on ${topic} for level ${level || "beginner"}. Mentor: ${mentorSlug || "general"}. Return JSON: {"title": "Lesson Title", "content": "Lesson content", "exercises": ["ex1", "ex2"]}`;

    const response = await callGemini(prompt, "You are an educator. Always respond with valid JSON only.", {
      temperature: 0.8,
      maxOutputTokens: 2048,
    });

    const lesson = parseGeminiJSON(response.text);

    // Save to Firestore
    const db = admin.firestore();
    const lessonRef = db.collection("lessons").doc();
    await lessonRef.set({
      user_id: request.auth.uid,
      ...lesson,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { lesson: { id: lessonRef.id, ...lesson } };
  } catch (error) {
    console.error("Error in generateLesson:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

// ============================================================================
// ADDITIONAL MISSING FUNCTIONS
// ============================================================================

/**
 * Generate Companion Image - AI-powered companion image generation
 */
export const generateCompanionImage = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { companionId, stage, species, element, color } = request.data;
    if (!companionId || stage === undefined) {
      throw new functions.https.HttpsError("invalid-argument", "Missing companionId or stage");
    }

    // Cerberus always has 3 heads regardless of stage
    const speciesDescription = species?.toLowerCase() === "cerberus" 
      ? "Cerberus with 3 heads" 
      : species;
    
    const prompt = `Generate an image description for a ${speciesDescription} companion at evolution stage ${stage} with ${element} element and ${color} color. Return JSON: {"imagePrompt": "Detailed image generation prompt", "description": "Image description"}`;

    const response = await callGemini(prompt, "You are an image prompt generator. Always respond with valid JSON only.", {
      temperature: 0.9,
      maxOutputTokens: 512,
    });

    const imageData = parseGeminiJSON(response.text);
    return { imageData };
  } catch (error) {
    console.error("Error in generateCompanionImage:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Complete Pep Talk - AI-powered complete pep talk generation
 */
export const generateCompletePepTalk = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { mentorSlug, topicCategory, intensity, emotionalTriggers } = request.data;
    if (!mentorSlug) {
      throw new functions.https.HttpsError("invalid-argument", "Missing mentorSlug");
    }

    const prompt = `Generate a complete pep talk for mentor ${mentorSlug}. Topic: ${topicCategory || "general"}, Intensity: ${intensity || "balanced"}, Triggers: ${emotionalTriggers || "none"}. Return JSON: {"script": "Full pep talk script", "title": "Title", "duration": 60}`;

    const response = await callGemini(prompt, "You are a motivational speaker. Always respond with valid JSON only.", {
      temperature: 0.8,
      maxOutputTokens: 2048,
    });

    const pepTalk = parseGeminiJSON(response.text);
    return { pepTalk };
  } catch (error) {
    console.error("Error in generateCompletePepTalk:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Check-In Response - AI-powered check-in response generation
 */
export const generateCheckInResponse = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { checkInId, checkInData } = request.data;
    if (!checkInId) {
      throw new functions.https.HttpsError("invalid-argument", "Missing checkInId");
    }

    const prompt = `Generate a supportive response to this check-in: ${JSON.stringify(checkInData || {})}. Return JSON: {"response": "Supportive response text", "suggestions": ["suggestion1", "suggestion2"]}`;

    const response = await callGemini(prompt, "You are a supportive coach. Always respond with valid JSON only.", {
      temperature: 0.8,
      maxOutputTokens: 512,
    });

    const checkInResponse = parseGeminiJSON(response.text);
    return { checkInResponse };
  } catch (error) {
    console.error("Error in generateCheckInResponse:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Adaptive Push - AI-powered adaptive push notification generation
 */
export const generateAdaptivePush = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { mentorId, category, intensity, eventContext } = request.data;
    if (!mentorId) {
      throw new functions.https.HttpsError("invalid-argument", "Missing mentorId");
    }

    const prompt = `Generate an adaptive push notification. Mentor ID: ${mentorId}, Category: ${category || "general"}, Intensity: ${intensity || "balanced"}, Context: ${eventContext || "none"}. Return JSON: {"title": "Notification title", "body": "Notification message"}`;

    const response = await callGemini(prompt, "You are a notification writer. Always respond with valid JSON only.", {
      temperature: 0.8,
      maxOutputTokens: 256,
    });

    const notification = parseGeminiJSON(response.text);
    return { notification };
  } catch (error) {
    console.error("Error in generateAdaptivePush:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Calculate Cosmic Profile - AI-powered cosmic profile calculation
 */
export const calculateCosmicProfile = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const userId = request.auth.uid;
    const db = admin.firestore();

    // Get user profile
    const profileDoc = await db.collection("profiles").doc(userId).get();
    if (!profileDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Profile not found");
    }
    const profile = profileDoc.data()!;

    const { zodiacSign, birthdate, birthTime, birthLocation } = profile;

    const prompt = `Calculate a cosmic profile for zodiac sign ${zodiacSign || "unknown"}, birthdate ${birthdate || "unknown"}, birth time ${birthTime || "unknown"}, location ${birthLocation || "unknown"}. Return JSON: {"profile": "Cosmic profile text", "traits": ["trait1", "trait2"], "compatibility": "compatibility info"}`;

    const response = await callGemini(prompt, "You are an astrologer. Always respond with valid JSON only.", {
      temperature: 0.8,
      maxOutputTokens: 1024,
    });

    const cosmicProfile = parseGeminiJSON(response.text);

    // Update profile
    await db.collection("profiles").doc(userId).update({
      cosmic_profile: cosmicProfile,
      cosmic_profile_generated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { cosmicProfile };
  } catch (error) {
    console.error("Error in calculateCosmicProfile:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Activity Comment - AI-powered activity comment generation
 */
export const generateActivityComment = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { activityData, context } = request.data;
    if (!activityData) {
      throw new functions.https.HttpsError("invalid-argument", "Missing activityData");
    }

    const prompt = `Generate a comment for this activity: ${JSON.stringify(activityData)}. Context: ${context || "general"}. Return JSON: {"comment": "Comment text"}`;

    const response = await callGemini(prompt, "You are a social media commenter. Always respond with valid JSON only.", {
      temperature: 0.8,
      maxOutputTokens: 256,
    });

    const comment = parseGeminiJSON(response.text);
    return { comment };
  } catch (error) {
    console.error("Error in generateActivityComment:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Mood Push - AI-powered mood-based push notification generation
 */
export const generateMoodPush = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { mood, context } = request.data;
    if (!mood) {
      throw new functions.https.HttpsError("invalid-argument", "Missing mood");
    }

    const prompt = `Generate a mood-based push notification for mood: ${mood}. Context: ${context || "general"}. Return JSON: {"title": "Title", "body": "Message"}`;

    const response = await callGemini(prompt, "You are a mood-based notification writer. Always respond with valid JSON only.", {
      temperature: 0.8,
      maxOutputTokens: 256,
    });

    const notification = parseGeminiJSON(response.text);
    return { notification };
  } catch (error) {
    console.error("Error in generateMoodPush:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Inspire Quote - AI-powered inspirational quote generation
 */
export const generateInspireQuote = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { context, theme } = request.data;

    const prompt = `Generate an inspirational quote. Theme: ${theme || "general"}, Context: ${context || "motivation"}. Return JSON: {"text": "Quote text", "author": "Author name"}`;

    const response = await callGemini(prompt, "You are a quote generator. Always respond with valid JSON only.", {
      temperature: 0.9,
      maxOutputTokens: 256,
    });

    const quote = parseGeminiJSON(response.text);
    return { quote };
  } catch (error) {
    console.error("Error in generateInspireQuote:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Quote Image - AI-powered quote image generation
 */
export const generateQuoteImage = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { quoteText, style } = request.data;
    if (!quoteText) {
      throw new functions.https.HttpsError("invalid-argument", "Missing quoteText");
    }

    const prompt = `Generate an image description for this quote: "${quoteText}". Style: ${style || "inspirational"}. Return JSON: {"imagePrompt": "Image generation prompt", "description": "Image description"}`;

    const response = await callGemini(prompt, "You are an image prompt generator. Always respond with valid JSON only.", {
      temperature: 0.9,
      maxOutputTokens: 512,
    });

    const imageData = parseGeminiJSON(response.text);
    return { imageData };
  } catch (error) {
    console.error("Error in generateQuoteImage:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Sample Card - AI-powered sample card generation
 */
export const generateSampleCard = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { species, element, stage } = request.data;

    const prompt = `Generate a sample evolution card. Species: ${species || "unknown"}, Element: ${element || "unknown"}, Stage: ${stage || 0}. Return JSON: {"creature_name": "Name", "traits": ["trait1"], "story_text": "Story"}`;

    const response = await callGemini(prompt, "You are a card game designer. Always respond with valid JSON only.", {
      temperature: 0.9,
      maxOutputTokens: 1024,
    });

    const card = parseGeminiJSON(response.text);
    return { card };
  } catch (error) {
    console.error("Error in generateSampleCard:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Neglected Companion Image - AI-powered neglected companion image generation
 */
export const generateNeglectedCompanionImage = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { companionId, daysSinceLastInteraction } = request.data;
    if (!companionId) {
      throw new functions.https.HttpsError("invalid-argument", "Missing companionId");
    }

    // Get companion data to check if it's Cerberus
    const db = admin.firestore();
    const companionDoc = await db.collection("user_companion").doc(companionId).get();
    const companion = companionDoc.exists ? companionDoc.data()! : null;
    
    // Cerberus always has 3 heads regardless of stage
    const speciesDescription = companion?.spirit_animal?.toLowerCase() === "cerberus"
      ? "neglected Cerberus with 3 heads"
      : "neglected companion";

    const prompt = `Generate an image description for a ${speciesDescription}. Days since last interaction: ${daysSinceLastInteraction || 0}. Return JSON: {"imagePrompt": "Image prompt", "description": "Description"}`;

    const response = await callGemini(prompt, "You are an image prompt generator. Always respond with valid JSON only.", {
      temperature: 0.9,
      maxOutputTokens: 512,
    });

    const imageData = parseGeminiJSON(response.text);
    return { imageData };
  } catch (error) {
    console.error("Error in generateNeglectedCompanionImage:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Zodiac Images - AI-powered zodiac image generation
 */
export const generateZodiacImages = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { zodiacSign, style } = request.data;
    if (!zodiacSign) {
      throw new functions.https.HttpsError("invalid-argument", "Missing zodiacSign");
    }

    const prompt = `Generate an image description for zodiac sign ${zodiacSign}. Style: ${style || "mystical"}. Return JSON: {"imagePrompt": "Image prompt", "description": "Description"}`;

    const response = await callGemini(prompt, "You are an image prompt generator. Always respond with valid JSON only.", {
      temperature: 0.9,
      maxOutputTokens: 512,
    });

    const imageData = parseGeminiJSON(response.text);
    return { imageData };
  } catch (error) {
    console.error("Error in generateZodiacImages:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Get Single Quote - Get a single quote (may use AI for generation if needed)
 */
export const getSingleQuote = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { category, emotionalTrigger } = request.data;

    const db = admin.firestore();
    let quote;

    // Try to get existing quote from Firestore
    let query = db.collection("quotes").limit(1);
    if (category) {
      query = query.where("category", "==", category);
    }
    if (emotionalTrigger) {
      query = query.where("emotional_triggers", "array-contains", emotionalTrigger);
    }

    const snapshot = await query.get();
    if (!snapshot.empty) {
      quote = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    } else {
      // Generate new quote if none found
      const prompt = `Generate a quote. Category: ${category || "general"}, Trigger: ${emotionalTrigger || "none"}. Return JSON: {"text": "Quote", "author": "Author"}`;
      const response = await callGemini(prompt, "You are a quote generator. Always respond with valid JSON only.", {
        temperature: 0.9,
        maxOutputTokens: 256,
      });
      quote = parseGeminiJSON(response.text);
    }

    return { quote };
  } catch (error) {
    console.error("Error in getSingleQuote:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Batch Generate Lessons - AI-powered batch lesson generation
 */
export const batchGenerateLessons = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { topics, mentorSlug } = request.data;
    if (!topics || !Array.isArray(topics)) {
      throw new functions.https.HttpsError("invalid-argument", "Missing topics array");
    }

    const lessons = [];
    for (const topic of topics) {
      const prompt = `Generate a lesson on ${topic}. Mentor: ${mentorSlug || "general"}. Return JSON: {"title": "Title", "content": "Content"}`;
      const response = await callGemini(prompt, "You are an educator. Always respond with valid JSON only.", {
        temperature: 0.8,
        maxOutputTokens: 1024,
      });
      const lesson = parseGeminiJSON(response.text);
      lessons.push(lesson);
    }

    return { lessons };
  } catch (error) {
    console.error("Error in batchGenerateLessons:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Companion Evolution - AI-powered companion evolution generation
 */
export const generateCompanionEvolution = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const { companionId, currentStage, targetStage } = request.data;
    if (!companionId || currentStage === undefined) {
      throw new functions.https.HttpsError("invalid-argument", "Missing companionId or currentStage");
    }

    const db = admin.firestore();
    const companionDoc = await db.collection("user_companion").doc(companionId).get();
    if (!companionDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Companion not found");
    }
    const companion = companionDoc.data()!;

    // Cerberus always has 3 heads regardless of stage
    const speciesDescription = companion.spirit_animal?.toLowerCase() === "cerberus"
      ? "Cerberus with 3 heads"
      : companion.spirit_animal;

    const prompt = `Generate evolution details for companion. Current stage: ${currentStage}, Target stage: ${targetStage || currentStage + 1}, Species: ${speciesDescription}, Element: ${companion.core_element}. Return JSON: {"evolutionDescription": "Description", "newAbilities": ["ability1"], "imagePrompt": "Image prompt"}`;

    const response = await callGemini(prompt, "You are an evolution designer. Always respond with valid JSON only.", {
      temperature: 0.9,
      maxOutputTokens: 1024,
    });

    const evolution = parseGeminiJSON(response.text);
    return { evolution };
  } catch (error) {
    console.error("Error in generateCompanionEvolution:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Daily Quotes - Selects and assigns daily quotes for mentors
 */
export const generateDailyQuotes = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const db = admin.firestore();
    const today = new Date().toISOString().split("T")[0];

    // Get all active mentors
    const mentorsSnapshot = await db
      .collection("mentors")
      .where("is_active", "==", true)
      .get();

    let generated = 0;
    let skipped = 0;

    for (const mentorDoc of mentorsSnapshot.docs) {
      const mentor = mentorDoc.data();
      
      // Check if quote already exists for today
      const existingSnapshot = await db
        .collection("daily_quotes")
        .where("for_date", "==", today)
        .where("mentor_slug", "==", mentor.slug)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        skipped++;
        continue;
      }

      // Get random quote for this mentor
      const quotesSnapshot = await db
        .collection("quotes")
        .where("mentor_id", "in", [mentor.id, null])
        .limit(50)
        .get();

      if (quotesSnapshot.empty) continue;

      const quotes = quotesSnapshot.docs;
      const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

      // Insert daily quote
      await db.collection("daily_quotes").add({
        quote_id: randomQuote.id,
        mentor_slug: mentor.slug,
        for_date: today,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      generated++;
    }

    return { success: true, generated, skipped, total: mentorsSnapshot.size };
  } catch (error) {
    console.error("Error in generateDailyQuotes:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Daily Mentor Pep Talks - AI-powered daily pep talk generation for all mentors
 */
export const generateDailyMentorPepTalks = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const db = admin.firestore();
    const today = new Date().toISOString().split("T")[0];

    const mentorSlugs = ["atlas", "darius", "eli", "nova", "sienna", "lumi", "kai", "stryker", "solace"];
    const results = [];

    for (const mentorSlug of mentorSlugs) {
      try {
        // Check if already generated
        const existingSnapshot = await db
          .collection("daily_pep_talks")
          .where("mentor_slug", "==", mentorSlug)
          .where("for_date", "==", today)
          .limit(1)
          .get();

        if (!existingSnapshot.empty) {
          results.push({ mentor: mentorSlug, status: "skipped" });
          continue;
        }

        // Generate pep talk using generateCompletePepTalk
        // This is a simplified version - you may want to call the actual function
        const prompt = `Generate a daily pep talk for mentor ${mentorSlug}. Return JSON: {"script": "Pep talk script", "title": "Title", "summary": "Summary"}`;

        const response = await callGemini(prompt, "You are a motivational speaker. Always respond with valid JSON only.", {
          temperature: 0.8,
          maxOutputTokens: 1024,
        });

        const pepTalk = parseGeminiJSON(response.text);

        // Save to Firestore
        await db.collection("daily_pep_talks").add({
          mentor_slug: mentorSlug,
          ...pepTalk,
          for_date: today,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        results.push({ mentor: mentorSlug, status: "generated" });
      } catch (error) {
        console.error(`Error generating pep talk for ${mentorSlug}:`, error);
        results.push({ mentor: mentorSlug, status: "error", error: error instanceof Error ? error.message : "Unknown error" });
      }
    }

    return { results };
  } catch (error) {
    console.error("Error in generateDailyMentorPepTalks:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Mentor Audio - Text-to-speech using ElevenLabs
 * Note: This uses ElevenLabs API, not Gemini
 */
export const generateMentorAudio = onCall(
  {
    secrets: [elevenlabsApiKey],
  },
  async (request: CallableRequest<{ mentorSlug: string; script: string }>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    try {
      const { mentorSlug, script } = request.data;
      if (!mentorSlug || !script) {
        throw new HttpsError("invalid-argument", "Missing mentorSlug or script");
      }

      const ELEVENLABS_API_KEY = elevenlabsApiKey.value();
      if (!ELEVENLABS_API_KEY) {
        throw new HttpsError("internal", "ELEVENLABS_API_KEY not configured");
      }

    const mentorVoices: Record<string, any> = {
      atlas: { voiceId: "JBFqnCBsd6RMkjVDRZzb", stability: 0.75, similarity_boost: 0.85, style_exaggeration: 0.5 },
      darius: { voiceId: "rWyjfFeMZ6PxkHqD3wGC", stability: 0.8, similarity_boost: 0.9, style_exaggeration: 0.7 },
      eli: { voiceId: "iP95p4xoKVk53GoZ742B", stability: 0.7, similarity_boost: 0.8, style_exaggeration: 0.4 },
      nova: { voiceId: "onwK4e9ZLuTAKqWW03F9", stability: 0.65, similarity_boost: 0.75, style_exaggeration: 0.6 },
      sienna: { voiceId: "XB0fDUnXU5powFXDhCwa", stability: 0.8, similarity_boost: 0.85, style_exaggeration: 0.3 },
      lumi: { voiceId: "EXAVITQu4vr4xnSDxMaL", stability: 0.75, similarity_boost: 0.8, style_exaggeration: 0.2 },
      kai: { voiceId: "N2lVS1w4EtoT3dr4eOWO", stability: 0.7, similarity_boost: 0.85, style_exaggeration: 0.8 },
      stryker: { voiceId: "pNInz6obpgDQGcFmaJgB", stability: 0.85, similarity_boost: 0.9, style_exaggeration: 0.7 },
      solace: { voiceId: "pFZP5JQG7iQjIQuC4Bku", stability: 0.8, similarity_boost: 0.85, style_exaggeration: 0.2 },
    };

    const voiceConfig = mentorVoices[mentorSlug];
    if (!voiceConfig) {
      throw new functions.https.HttpsError("invalid-argument", `No voice configuration for mentor: ${mentorSlug}`);
    }

    // Call ElevenLabs TTS API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceConfig.voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: script,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: voiceConfig.stability,
            similarity_boost: voiceConfig.similarity_boost,
            style: voiceConfig.style_exaggeration,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", errorText);
      throw new HttpsError("internal", `ElevenLabs API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);

    // Upload to Firebase Storage
    const bucket = admin.storage().bucket();
    const fileName = `${mentorSlug}_${Date.now()}.mp3`;
    const file = bucket.file(`mentor-audio/${fileName}`);

    await file.save(Buffer.from(audioBytes), {
      metadata: { contentType: "audio/mpeg" },
    });

    // Get public URL
    await file.makePublic();
    const audioUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;

    return { audioUrl };
  } catch (error) {
    console.error("Error in generateMentorAudio:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate Full Mentor Audio - Orchestrates script generation and audio generation
 */
export const generateFullMentorAudio = onCall(
  {
    secrets: [geminiApiKey, elevenlabsApiKey],
  },
  async (request: CallableRequest<{
    mentorSlug: string;
    topicCategory?: string;
    intensity?: string;
    emotionalTriggers?: string;
  }>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    try {
      const { mentorSlug, topicCategory, intensity, emotionalTriggers } = request.data;
      if (!mentorSlug) {
        throw new HttpsError("invalid-argument", "Missing mentorSlug");
      }

      // Step 1: Generate script
      const scriptPrompt = `Generate a pep talk script for mentor ${mentorSlug}. Topic: ${topicCategory || "general"}, Intensity: ${intensity || "balanced"}, Triggers: ${emotionalTriggers || "none"}. Return JSON: {"script": "Full script text"}`;

      const scriptResponse = await callGemini(scriptPrompt, "You are a motivational speaker. Always respond with valid JSON only.", {
        temperature: 0.8,
        maxOutputTokens: 2048,
      }, geminiApiKey.value());

      const scriptData = parseGeminiJSON(scriptResponse.text);
      const script = scriptData.script;

      // Step 2: Generate audio (call the generateMentorAudio function internally)
      // For now, we'll call ElevenLabs directly here
      const ELEVENLABS_API_KEY = elevenlabsApiKey.value();
      if (!ELEVENLABS_API_KEY) {
        throw new HttpsError("internal", "ELEVENLABS_API_KEY not configured");
      }

    const mentorVoices: Record<string, string> = {
      atlas: "JBFqnCBsd6RMkjVDRZzb",
      darius: "rWyjfFeMZ6PxkHqD3wGC",
      eli: "iP95p4xoKVk53GoZ742B",
      nova: "onwK4e9ZLuTAKqWW03F9",
      sienna: "XB0fDUnXU5powFXDhCwa",
      lumi: "EXAVITQu4vr4xnSDxMaL",
      kai: "N2lVS1w4EtoT3dr4eOWO",
      stryker: "pNInz6obpgDQGcFmaJgB",
      solace: "pFZP5JQG7iQjIQuC4Bku",
    };

    const voiceId = mentorVoices[mentorSlug] || mentorVoices.atlas;

    const audioResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: script,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.85,
            style: 0.5,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!audioResponse.ok) {
      throw new HttpsError("internal", "Failed to generate audio");
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);

    // Upload to Firebase Storage
    const bucket = admin.storage().bucket();
    const fileName = `${mentorSlug}_${Date.now()}.mp3`;
    const file = bucket.file(`mentor-audio/${fileName}`);

    await file.save(Buffer.from(audioBytes), {
      metadata: { contentType: "audio/mpeg" },
    });

    await file.makePublic();
    const audioUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;

    return { script, audioUrl };
  } catch (error) {
    console.error("Error in generateFullMentorAudio:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", `Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Test function to verify API keys are configured correctly
 * This is a simple diagnostic function
 */
export const testApiKeys = onCall(
  {
    secrets: [geminiApiKey, openaiApiKey, elevenlabsApiKey],
  },
  async (request: CallableRequest) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const results: Record<string, boolean | string> = {};

    // Check Gemini API Key
    const geminiKey = geminiApiKey.value();
    results.GEMINI_API_KEY = geminiKey ? `${geminiKey.substring(0, 10)}...` : "NOT SET";

    // Check OpenAI API Key
    const openaiKey = openaiApiKey.value();
    results.OPENAI_API_KEY = openaiKey ? `${openaiKey.substring(0, 10)}...` : "NOT SET";

    // Check ElevenLabs API Key
    const elevenlabsKey = elevenlabsApiKey.value();
    results.ELEVENLABS_API_KEY = elevenlabsKey ? `${elevenlabsKey.substring(0, 10)}...` : "NOT SET";

  return {
    success: true,
    message: "API Keys check complete",
    keys: results,
    allConfigured: !!(geminiKey && openaiKey && elevenlabsKey),
  };
});

/**
 * Generate Evolution Voice - AI-powered evolution voice line generation using OpenAI GPT-5-mini
 * Note: Uses OpenAI for text generation, then ElevenLabs for TTS
 */
export const generateEvolutionVoice = onCall(
  {
    secrets: [openaiApiKey, elevenlabsApiKey],
  },
  async (request: CallableRequest<{ mentorSlug: string; newStage: number }>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

  try {
    const { mentorSlug, newStage } = request.data;

    if (!mentorSlug || newStage === undefined) {
      return {
        voiceLine: "Your companion has evolved! Keep up the great work!",
        audioContent: null,
      };
    }

    const db = admin.firestore();
    
    // Get mentor details
    const mentorsSnapshot = await db
      .collection("mentors")
      .where("slug", "==", mentorSlug)
      .limit(1)
      .get();

    if (mentorsSnapshot.empty) {
      return {
        voiceLine: "Your companion has evolved! Keep up the great work!",
        audioContent: null,
      };
    }

    const mentor = mentorsSnapshot.docs[0].data();

    const OPENAI_API_KEY = openaiApiKey.value();
    if (!OPENAI_API_KEY) {
      throw new HttpsError("internal", "OPENAI_API_KEY not configured");
    }

    // Generate voice line using OpenAI GPT-5-mini
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini-2025-08-07",
        max_completion_tokens: 100,
        messages: [
          {
            role: "system",
            content: `You are ${mentor.name}. Your tone: ${mentor.tone_description || "encouraging"}. Generate a SHORT, powerful one-liner (10-15 words MAX) celebrating that the user's companion just evolved to stage ${newStage}. Focus on DISCIPLINE and CONSISTENCY. Keep it SHORT and IMPACTFUL.`,
          },
          {
            role: "user",
            content: `My companion just evolved to stage ${newStage}. Give me ONE powerful line.`,
          },
        ],
      }),
    });

    if (!openaiResponse.ok) {
      throw new HttpsError("internal", "Failed to generate voice line");
    }

    const openaiData = await openaiResponse.json();
    const voiceLine = openaiData.choices[0].message.content.trim().replace(/^["']|["']$/g, "");

    // Convert to speech using ElevenLabs
    const ELEVENLABS_API_KEY = elevenlabsApiKey.value();
    if (!ELEVENLABS_API_KEY) {
      return { voiceLine, audioContent: null };
    }

    const mentorVoices: Record<string, string> = {
      atlas: "JBFqnCBsd6RMkjVDRZzb",
      darius: "rWyjfFeMZ6PxkHqD3wGC",
      eli: "iP95p4xoKVk53GoZ742B",
      nova: "onwK4e9ZLuTAKqWW03F9",
      sienna: "XB0fDUnXU5powFXDhCwa",
      lumi: "EXAVITQu4vr4xnSDxMaL",
      kai: "N2lVS1w4EtoT3dr4eOWO",
      stryker: "pNInz6obpgDQGcFmaJgB",
      solace: "pFZP5JQG7iQjIQuC4Bku",
    };

    const voiceId = mentorVoices[mentorSlug] || mentorVoices.atlas;

    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: voiceLine,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!elevenLabsResponse.ok) {
      return { voiceLine, audioContent: null };
    }

    const audioBuffer = await elevenLabsResponse.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString("base64");

    return { voiceLine, audioContent: base64Audio };
  } catch (error) {
    console.error("Error in generateEvolutionVoice:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    return {
      voiceLine: "Your companion has evolved! Keep up the great work!",
      audioContent: null,
    };
  }
});

/**
 * Transcribe Audio - Uses OpenAI Whisper API to transcribe audio files
 */
export const transcribeAudio = onCall(
  {
    secrets: [openaiApiKey],
  },
  async (request: CallableRequest<{ audioUrl: string }>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    try {
      const { audioUrl } = request.data;
      if (!audioUrl) {
        throw new HttpsError("invalid-argument", "Audio URL is required");
      }

      const OPENAI_API_KEY = openaiApiKey.value();
      if (!OPENAI_API_KEY) {
        throw new HttpsError("internal", "OPENAI_API_KEY not configured");
      }

    // Fetch the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new HttpsError("internal", `Failed to fetch audio: ${audioResponse.statusText}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = Buffer.from(audioBuffer);

    // Prepare form data for OpenAI Whisper API
    const FormData = require("form-data");
    const formData = new FormData();
    formData.append("file", audioBlob, { filename: "audio.mp3", contentType: "audio/mpeg" });
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "word");

    // Call OpenAI Whisper API
    const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error("OpenAI API error:", errorText);
      throw new HttpsError("internal", `OpenAI API error: ${transcriptionResponse.status}`);
    }

    const transcriptionData = await transcriptionResponse.json();

    // Extract word-level timestamps
    const words = transcriptionData.words || [];

    // Format the transcript for our database
    const transcript = words.map((wordData: any) => ({
      word: wordData.word,
      start: wordData.start,
      end: wordData.end,
    }));

    return {
      transcript,
      text: transcriptionData.text,
      duration: transcriptionData.duration,
    };
  } catch (error) {
    console.error("Error in transcribeAudio:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", `Failed to transcribe audio: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Sync Daily Pep Talk Transcript - Syncs transcript for daily pep talks
 */
export const syncDailyPepTalkTranscript = onCall(
  {
    secrets: [openaiApiKey],
  },
  async (request: CallableRequest<{ id?: string; mentorSlug?: string; forDate?: string }>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    try {
      const { id, mentorSlug, forDate } = request.data;

      const db = admin.firestore();

      // Fetch the daily pep talk
      let pepTalkDoc: admin.firestore.DocumentSnapshot | null = null;
      if (id) {
        pepTalkDoc = await db.collection("daily_pep_talks").doc(id).get();
      } else if (mentorSlug && forDate) {
        const snapshot = await db
          .collection("daily_pep_talks")
          .where("mentor_slug", "==", mentorSlug)
          .where("for_date", "==", forDate)
          .limit(1)
          .get();
        pepTalkDoc = snapshot.docs[0] || null;
      } else {
        throw new HttpsError("invalid-argument", "Provide either id or {mentorSlug, forDate}");
      }

      if (!pepTalkDoc || !pepTalkDoc.exists) {
        throw new HttpsError("not-found", "Pep talk not found");
      }

      const pepTalk = pepTalkDoc.data()!;
      if (!pepTalk.audio_url) {
        throw new HttpsError("invalid-argument", "Pep talk has no audio_url");
      }

      // Transcribe audio using OpenAI Whisper
      const OPENAI_API_KEY = openaiApiKey.value();
      if (!OPENAI_API_KEY) {
        throw new HttpsError("internal", "OPENAI_API_KEY not configured");
      }

      const audioResponse = await fetch(pepTalk.audio_url);
      if (!audioResponse.ok) {
        throw new HttpsError("internal", `Failed to fetch audio: ${audioResponse.statusText}`);
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      const audioBlob = Buffer.from(audioBuffer);

      const FormData = require("form-data");
      const formData = new FormData();
      formData.append("file", audioBlob, { filename: "audio.mp3", contentType: "audio/mpeg" });
      formData.append("model", "whisper-1");
      formData.append("response_format", "verbose_json");
      formData.append("timestamp_granularities[]", "word");

      const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          ...formData.getHeaders(),
        },
        body: formData,
      });

      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text();
        throw new HttpsError("internal", `Transcription failed: ${errorText}`);
      }

      const transcriptionData = await transcriptionResponse.json();
      const words = transcriptionData.words || [];
      const transcript = words.map((wordData: any) => ({
        word: wordData.word,
        start: wordData.start,
        end: wordData.end,
      }));

      const transcription = {
        text: transcriptionData.text,
        transcript,
      };

      const transcribedText = transcription.text;
      const wordTimestamps = transcription.transcript || [];

      if (!transcribedText) {
        throw new HttpsError("internal", "No transcription text returned");
      }

    // If the new text differs significantly, update the row
    const currentText = pepTalk.script || "";
    const differs = currentText.trim() !== transcribedText.trim();

      if (differs) {
        await db.collection("daily_pep_talks").doc(pepTalkDoc.id).update({
          script: transcribedText,
          transcript: wordTimestamps,
        });
      }

      return {
        id: pepTalkDoc.id,
        script: transcribedText,
        transcript: wordTimestamps,
        changed: differs,
      };
    } catch (error) {
      console.error("Error in syncDailyPepTalkTranscript:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", `Failed to sync transcript: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  });

/**
 * Seed Real Quotes - Seeds real quotes into the database
 */
export const seedRealQuotes = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const REAL_QUOTES = [
      // DISCIPLINE - Intense
      { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn", category: "discipline", intensity: "intense", triggers: ["Needing Discipline", "Avoiding Action"] },
      { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle", category: "discipline", intensity: "intense", triggers: ["Needing Discipline"] },
      { text: "The difference between who you are and who you want to be is what you do.", author: "Unknown", category: "discipline", intensity: "moderate", triggers: ["Needing Discipline", "Feeling Stuck"] },
      
      // CONFIDENCE - Various intensities
      { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt", category: "confidence", intensity: "moderate", triggers: ["Self-Doubt", "Anxious & Overthinking"] },
      { text: "You are braver than you believe, stronger than you seem, and smarter than you think.", author: "A.A. Milne", category: "confidence", intensity: "gentle", triggers: ["Self-Doubt", "Heavy or Low"] },
      { text: "Act as if what you do makes a difference. It does.", author: "William James", category: "confidence", intensity: "moderate", triggers: ["Self-Doubt", "Unmotivated"] },
      { text: "No one can make you feel inferior without your consent.", author: "Eleanor Roosevelt", category: "confidence", intensity: "intense", triggers: ["Self-Doubt", "Emotionally Hurt"] },
      
      // FOCUS - Various intensities
      { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee", category: "focus", intensity: "intense", triggers: ["Anxious & Overthinking", "Avoiding Action"] },
      { text: "Concentrate all your thoughts upon the work in hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell", category: "focus", intensity: "moderate", triggers: ["Anxious & Overthinking"] },
      { text: "It's not always that we need to do more but rather that we need to focus on less.", author: "Nathan W. Morris", category: "focus", intensity: "gentle", triggers: ["Exhausted", "Anxious & Overthinking"] },
      
      // MINDSET - Various intensities
      { text: "The mind is everything. What you think you become.", author: "Buddha", category: "mindset", intensity: "moderate", triggers: ["Self-Doubt", "Feeling Stuck"] },
      { text: "Whether you think you can, or you think you can't – you're right.", author: "Henry Ford", category: "mindset", intensity: "intense", triggers: ["Self-Doubt", "Avoiding Action"] },
      { text: "Your limitation—it's only your imagination.", author: "Unknown", category: "mindset", intensity: "intense", triggers: ["Feeling Stuck", "Self-Doubt"] },
      { text: "Change your thoughts and you change your world.", author: "Norman Vincent Peale", category: "mindset", intensity: "gentle", triggers: ["Heavy or Low", "In Transition"] },
      
      // BUSINESS - Various intensities
      { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney", category: "business", intensity: "intense", triggers: ["Avoiding Action", "Needing Discipline"] },
      { text: "Opportunities don't happen. You create them.", author: "Chris Grosser", category: "business", intensity: "intense", triggers: ["Motivated & Ready", "Needing Discipline"] },
      { text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller", category: "business", intensity: "moderate", triggers: ["In Transition", "Feeling Stuck"] },
      { text: "Success is not final; failure is not fatal: It is the courage to continue that counts.", author: "Winston S. Churchill", category: "business", intensity: "moderate", triggers: ["Frustrated", "Emotionally Hurt"] },
      
      // PHYSIQUE - Various intensities
      { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn", category: "physique", intensity: "gentle", triggers: ["Exhausted", "Heavy or Low"] },
      { text: "The only bad workout is the one that didn't happen.", author: "Unknown", category: "physique", intensity: "moderate", triggers: ["Avoiding Action", "Unmotivated"] },
      { text: "Your body can stand almost anything. It's your mind that you have to convince.", author: "Unknown", category: "physique", intensity: "intense", triggers: ["Needing Discipline", "Self-Doubt"] },
      { text: "Strength doesn't come from what you can do. It comes from overcoming the things you once thought you couldn't.", author: "Rikki Rogers", category: "physique", intensity: "moderate", triggers: ["Self-Doubt", "Motivated & Ready"] },
      
      // GENERAL MOTIVATION - For all triggers
      { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson", category: "discipline", intensity: "moderate", triggers: ["Exhausted", "Avoiding Action"] },
      { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar", category: "confidence", intensity: "gentle", triggers: ["Anxious & Overthinking", "Avoiding Action"] },
      { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins", category: "mindset", intensity: "moderate", triggers: ["Feeling Stuck", "In Transition"] },
      { text: "Everything you've ever wanted is on the other side of fear.", author: "George Addair", category: "confidence", intensity: "intense", triggers: ["Anxious & Overthinking", "Self-Doubt"] },
      { text: "Fall seven times and stand up eight.", author: "Japanese Proverb", category: "mindset", intensity: "moderate", triggers: ["Emotionally Hurt", "Frustrated", "Heavy or Low"] },
      { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson", category: "confidence", intensity: "gentle", triggers: ["Heavy or Low", "Self-Doubt"] },
      { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb", category: "discipline", intensity: "gentle", triggers: ["In Transition", "Feeling Stuck"] },
      { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius", category: "discipline", intensity: "gentle", triggers: ["Exhausted", "Unmotivated"] },
      { text: "Do not wait to strike till the iron is hot; but make it hot by striking.", author: "William Butler Yeats", category: "business", intensity: "intense", triggers: ["Avoiding Action", "Motivated & Ready"] },
      { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma", category: "discipline", intensity: "gentle", triggers: ["Exhausted", "Needing Discipline"] },
    ];

    const db = admin.firestore();

    // Fetch all mentors to assign quotes
    const mentorsSnapshot = await db.collection("mentors").get();
    const mentors = mentorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (mentors.length === 0) {
      throw new functions.https.HttpsError("not-found", "No mentors found");
    }

    // Prepare quotes with mentor assignments
    const quotesToInsert = REAL_QUOTES.map((quote) => {
      // Find mentors that match the quote's category
      const matchingMentors = mentors.filter((mentor: any) =>
        mentor.tags?.some((tag: string) => 
          tag.toLowerCase().includes(quote.category.toLowerCase())
        )
      );

      // Pick a random matching mentor or null
      const mentorId = matchingMentors.length > 0
        ? matchingMentors[Math.floor(Math.random() * matchingMentors.length)].id
        : null;

      return {
        text: quote.text,
        author: quote.author,
        category: quote.category,
        intensity: quote.intensity,
        emotional_triggers: quote.triggers,
        mentor_id: mentorId,
        is_premium: false,
      };
    });

    // Insert quotes (check for duplicates based on text)
    const batch = db.batch();
    let insertedCount = 0;

    for (const quote of quotesToInsert) {
      // Check if quote already exists
      const existingSnapshot = await db
        .collection("quotes")
        .where("text", "==", quote.text)
        .limit(1)
        .get();

      if (existingSnapshot.empty) {
        const quoteRef = db.collection("quotes").doc();
        batch.set(quoteRef, quote);
        insertedCount++;
      }
    }

    await batch.commit();

    return {
      success: true,
      message: `Successfully seeded ${insertedCount} real quotes`,
      inserted: insertedCount,
      total: quotesToInsert.length,
    };
  } catch (error) {
    console.error("Error in seedRealQuotes:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed to seed quotes: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Reset Companion - Resets/deletes a user's companion and related data
 */
export const resetCompanion = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const userId = request.auth.uid;
    const db = admin.firestore();

    // Find companion
    const companionSnapshot = await db
      .collection("user_companion")
      .where("user_id", "==", userId)
      .limit(1)
      .get();

    if (companionSnapshot.empty) {
      return { success: true, message: "No companion to reset" };
    }

    const companionDoc = companionSnapshot.docs[0];
    const companionId = companionDoc.id;

    // Delete related data
    const batch = db.batch();

    // Delete XP events
    const xpEventsSnapshot = await db
      .collection("xp_events")
      .where("companion_id", "==", companionId)
      .get();
    xpEventsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Delete evolutions
    const evolutionsSnapshot = await db
      .collection("companion_evolutions")
      .where("companion_id", "==", companionId)
      .get();
    evolutionsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Delete companion
    batch.delete(companionDoc.ref);

    // Clear referral relationship
    const profileRef = db.collection("profiles").doc(userId);
    batch.update(profileRef, { referred_by: null });

    await batch.commit();

    return { success: true };
  } catch (error) {
    console.error("Error in resetCompanion:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed to reset companion: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Create Influencer Code - Creates influencer referral codes
 */
export const createInfluencerCode = functions.https.onCall(
  {
    secrets: [paypalClientId, paypalSecret],
  },
  async (request) => {
  // This is a public endpoint (no auth required)
  try {
    const { name, email, handle, paypalEmail } = request.data;

    // Validate required fields
    if (!name || !email || !handle || !paypalEmail) {
      throw new functions.https.HttpsError("invalid-argument", "Missing required fields: name, email, handle, paypalEmail");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || !emailRegex.test(paypalEmail)) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid email format");
    }

    const db = admin.firestore();

    // Check if influencer already has a code
    const existingSnapshot = await db
      .collection("referral_codes")
      .where("influencer_email", "==", email)
      .where("owner_type", "==", "influencer")
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      const existingCode = existingSnapshot.docs[0].data();
      const appUrl = process.env.APP_URL || "https://cosmiq.app";
      const appLink = `${appUrl}/?ref=${existingCode.code}`;
      return {
        code: existingCode.code,
        link: appLink,
        message: "You already have a referral code. Here it is!",
      };
    }

    // Generate code from handle
    function generateCodeFromHandle(handle: string): string {
      const clean = handle.replace(/[@\s-]/g, "").toUpperCase();
      const base = clean.substring(0, 8);
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `COSMIQ-${base}${random}`;
    }

    let code = generateCodeFromHandle(handle);
    
    // Ensure uniqueness
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db
        .collection("referral_codes")
        .where("code", "==", code)
        .limit(1)
        .get();
      
      if (existing.empty) break;
      
      code = generateCodeFromHandle(handle + Math.random().toString());
      attempts++;
    }

    // Create influencer referral code
    const codeRef = db.collection("referral_codes").doc();
    await codeRef.set({
      id: codeRef.id,
      code,
      owner_type: "influencer",
      influencer_name: name,
      influencer_email: email,
      influencer_handle: handle,
      payout_method: "paypal",
      payout_identifier: paypalEmail,
      is_active: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const appUrl = process.env.APP_URL || "https://cosmiq.app";
    const appLink = `${appUrl}/?ref=${code}`;

    return {
      code,
      link: appLink,
      promo_caption: `✨ Transform your habits into an epic journey! Use my code ${code} or click: ${appLink}`,
    };
  } catch (error) {
    console.error("Error in createInfluencerCode:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed to create influencer code: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Process PayPal Payout - Processes PayPal payouts for referral rewards
 */
export const processPaypalPayout = functions.https.onCall(
  {
    secrets: [paypalClientId, paypalSecret],
  },
  async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  try {
    const userId = request.auth.uid;
    const { payoutId } = request.data;

    if (!payoutId) {
      throw new functions.https.HttpsError("invalid-argument", "Missing payoutId");
    }

    const db = admin.firestore();

    // Check if user is admin
    const userRoleDoc = await db
      .collection("user_roles")
      .where("user_id", "==", userId)
      .where("role", "==", "admin")
      .limit(1)
      .get();

    if (userRoleDoc.empty) {
      throw new functions.https.HttpsError("permission-denied", "Admin access required");
    }

    // Fetch payout details
    const payoutDoc = await db.collection("referral_payouts").doc(payoutId).get();
    if (!payoutDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Payout not found");
    }

    const payout = payoutDoc.data()!;

    // Verify payout is approved
    if (payout.status !== "approved") {
      throw new functions.https.HttpsError("failed-precondition", "Payout must be approved before processing");
    }

    // Get referral code info
    const referralCodeDoc = await db.collection("referral_codes").doc(payout.referral_code_id).get();
    if (!referralCodeDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Referral code not found");
    }

    const referralCode = referralCodeDoc.data()!;
    const paypalEmail = referralCode.payout_identifier;

    if (!paypalEmail) {
      throw new functions.https.HttpsError("invalid-argument", "No PayPal email configured for this referral code");
    }

    // Get PayPal credentials from secrets
    const clientId = paypalClientId.value;
    const clientSecret = paypalSecret.value;

    if (!clientId || !clientSecret) {
      throw new functions.https.HttpsError("internal", "PayPal credentials not configured");
    }

    // Get PayPal OAuth token
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenResponse = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("PayPal auth failed:", errorText);
      throw new functions.https.HttpsError("internal", "PayPal authentication failed");
    }

    const { access_token } = await tokenResponse.json();

    // Create PayPal payout
    const payoutBatch = {
      sender_batch_header: {
        sender_batch_id: `ref_payout_${payoutId}`,
        email_subject: "You've received a referral reward from Cosmiq!",
        email_message: "Thank you for referring friends to Cosmiq. Here's your reward!",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: {
            value: payout.amount.toFixed(2),
            currency: "USD",
          },
          receiver: paypalEmail,
          note: `Cosmiq Referral Reward - ${payout.payout_type}`,
          sender_item_id: payoutId,
        },
      ],
    };

    const payoutResponse = await fetch("https://api-m.paypal.com/v1/payments/payouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payoutBatch),
    });

    if (!payoutResponse.ok) {
      const errorText = await payoutResponse.text();
      console.error("PayPal payout failed:", errorText);
      throw new functions.https.HttpsError("internal", `PayPal payout failed: ${errorText}`);
    }

    const payoutResult = await payoutResponse.json();
    const payoutBatchId = payoutResult.batch_header.payout_batch_id;
    const payoutItemId = payoutResult.items?.[0]?.payout_item_id;

    // Update payout status
    await db.collection("referral_payouts").doc(payoutId).update({
      status: "paid",
      paid_at: admin.firestore.FieldValue.serverTimestamp(),
      paypal_transaction_id: payoutBatchId,
      paypal_payer_id: payoutItemId,
    });

    return {
      success: true,
      payout_batch_id: payoutBatchId,
      amount: payout.amount,
      recipient: paypalEmail,
    };
  } catch (error) {
    console.error("Error in processPaypalPayout:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed to process payout: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Scheduled function: Generate Daily Quotes (runs daily at 00:00 UTC)
 * This automatically selects and assigns daily quotes for all mentors
 */
export const scheduledGenerateDailyQuotes = onSchedule(
  {
    schedule: "0 0 * * *", // Every day at midnight UTC
    timeZone: "UTC",
  },
  async (event) => {
    console.log("Starting scheduled daily quotes generation...");
    
    try {
      const db = admin.firestore();
      const today = new Date().toISOString().split("T")[0];

      // Get all active mentors
      const mentorsSnapshot = await db
        .collection("mentors")
        .where("is_active", "==", true)
        .get();

      let generated = 0;
      let skipped = 0;

      for (const mentorDoc of mentorsSnapshot.docs) {
        const mentor = mentorDoc.data();
        
        // Check if quote already exists for today
        const existingSnapshot = await db
          .collection("daily_quotes")
          .where("for_date", "==", today)
          .where("mentor_slug", "==", mentor.slug)
          .limit(1)
          .get();

        if (!existingSnapshot.empty) {
          skipped++;
          continue;
        }

        // Get random quote for this mentor
        const quotesSnapshot = await db
          .collection("quotes")
          .where("mentor_id", "in", [mentorDoc.id, null])
          .limit(50)
          .get();

        if (quotesSnapshot.empty) continue;

        const quotes = quotesSnapshot.docs;
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

        // Insert daily quote
        await db.collection("daily_quotes").add({
          quote_id: randomQuote.id,
          mentor_slug: mentor.slug,
          for_date: today,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        generated++;
      }

      console.log(`Daily quotes generation complete: ${generated} generated, ${skipped} skipped`);
    } catch (error) {
      console.error("Error in scheduled daily quotes generation:", error);
      throw error;
    }
  }
);

/**
 * Scheduled function: Generate Daily Mentor Pep Talks (runs daily at 00:01 UTC)
 * This automatically generates daily pep talks for all mentors
 */
export const scheduledGenerateDailyMentorPepTalks = onSchedule(
  {
    schedule: "1 0 * * *", // Every day at 00:01 UTC
    timeZone: "UTC",
  },
  async (event) => {
    console.log("Starting scheduled daily mentor pep talks generation...");
    
    try {
      const db = admin.firestore();
      const today = new Date().toISOString().split("T")[0];

      const mentorSlugs = ["atlas", "darius", "eli", "nova", "sienna", "lumi", "kai", "stryker", "solace"];
      const results = [];

      for (const mentorSlug of mentorSlugs) {
        try {
          // Check if already generated
          const existingSnapshot = await db
            .collection("daily_pep_talks")
            .where("mentor_slug", "==", mentorSlug)
            .where("for_date", "==", today)
            .limit(1)
            .get();

          if (!existingSnapshot.empty) {
            results.push({ mentor: mentorSlug, status: "skipped" });
            continue;
          }

          // Get mentor document
          const mentorSnapshot = await db
            .collection("mentors")
            .where("slug", "==", mentorSlug)
            .limit(1)
            .get();

          if (mentorSnapshot.empty) {
            results.push({ mentor: mentorSlug, status: "error", error: "Mentor not found" });
            continue;
          }

          const mentor = mentorSnapshot.docs[0].data();

          // Generate pep talk using Gemini
          const prompt = `Generate a daily motivational pep talk for mentor ${mentorSlug}. The mentor's personality is: ${mentor.description || "motivational and inspiring"}. Return JSON: {"script": "Full pep talk script (2-3 minutes of speaking)", "title": "Engaging title", "summary": "Brief summary"}`;

          const response = await callGemini(prompt, "You are a motivational speaker. Always respond with valid JSON only.", {
            temperature: 0.8,
            maxOutputTokens: 2048,
          });

          const pepTalk = parseGeminiJSON(response.text);

          if (!pepTalk.script || !pepTalk.title) {
            results.push({ mentor: mentorSlug, status: "error", error: "Invalid response from AI" });
            continue;
          }

          // Save to Firestore (audio can be generated on-demand)
          await db.collection("daily_pep_talks").add({
            mentor_slug: mentorSlug,
            mentor_id: mentorSnapshot.docs[0].id,
            title: pepTalk.title,
            summary: pepTalk.summary || "",
            script: pepTalk.script,
            audio_url: null, // Will be generated on-demand or by separate process
            for_date: today,
            topic_category: "motivation",
            intensity: "balanced",
            emotional_triggers: [],
            created_at: admin.firestore.FieldValue.serverTimestamp(),
          });

          results.push({ mentor: mentorSlug, status: "generated" });
        } catch (error) {
          console.error(`Error generating pep talk for ${mentorSlug}:`, error);
          results.push({ mentor: mentorSlug, status: "error", error: error instanceof Error ? error.message : "Unknown error" });
        }
      }

      console.log(`Daily pep talks generation complete:`, results);
    } catch (error) {
      console.error("Error in scheduled daily pep talks generation:", error);
      throw error;
    }
  }
);

/**
 * Scheduled function: Schedule Daily Mentor Push Notifications (runs daily at 00:05 UTC)
 * This schedules push notifications for all users with daily pushes enabled
 */
export const scheduledScheduleDailyMentorPushes = onSchedule(
  {
    schedule: "5 0 * * *", // Every day at 00:05 UTC
    timeZone: "UTC",
  },
  async () => {
    console.log("Starting scheduled daily mentor push scheduling...");
    
    try {
      const db = admin.firestore();
      const today = new Date().toISOString().split("T")[0];

      // Get all users with daily pushes enabled
      const profilesSnapshot = await db
        .collection("profiles")
        .where("daily_push_enabled", "==", true)
        .get();

      if (profilesSnapshot.empty) {
        console.log("No users with daily pushes enabled");
        return;
      }

      console.log(`Found ${profilesSnapshot.size} users with daily pushes enabled`);

      let scheduled = 0;
      const errors: Array<{ userId: string; error: string }> = [];

      for (const profileDoc of profilesSnapshot.docs) {
        try {
          const profile = profileDoc.data();
          const userId = profileDoc.id;

          if (!profile.selected_mentor_id) {
            continue;
          }

          // Get mentor document
          const mentorDoc = await db.collection("mentors").doc(profile.selected_mentor_id).get();
          if (!mentorDoc.exists) {
            errors.push({ userId, error: "Mentor not found" });
            continue;
          }

          const mentor = mentorDoc.data()!;

          // Get today's daily pep talk for this mentor
          const pepTalkSnapshot = await db
            .collection("daily_pep_talks")
            .where("mentor_slug", "==", mentor.slug)
            .where("for_date", "==", today)
            .limit(1)
            .get();

          if (pepTalkSnapshot.empty) {
            errors.push({ userId, error: "No pep talk available" });
            continue;
          }

          const pepTalkDoc = pepTalkSnapshot.docs[0];

          // Check if already scheduled
          const existingSnapshot = await db
            .collection("user_daily_pushes")
            .where("user_id", "==", userId)
            .where("daily_pep_talk_id", "==", pepTalkDoc.id)
            .limit(1)
            .get();

          if (!existingSnapshot.empty) {
            console.log(`Already scheduled for user ${userId}`);
            continue;
          }

          // Calculate scheduled time
          const scheduledAt = calculateScheduledTime(
            profile.daily_push_window || "morning",
            profile.daily_push_time || "08:00",
            profile.timezone || "UTC"
          );

          // Insert into user_daily_pushes
          await db.collection("user_daily_pushes").add({
            user_id: userId,
            daily_pep_talk_id: pepTalkDoc.id,
            scheduled_at: admin.firestore.Timestamp.fromDate(new Date(scheduledAt)),
            delivered_at: null,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
          });

          scheduled++;
          console.log(`✓ Scheduled push for user ${userId} at ${scheduledAt}`);
        } catch (error) {
          console.error(`Error processing user ${profileDoc.id}:`, error);
          errors.push({
            userId: profileDoc.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      console.log(`Scheduling complete. Scheduled: ${scheduled}, Errors: ${errors.length}`);
    } catch (error) {
      console.error("Error in scheduled daily mentor push scheduling:", error);
      throw error;
    }
  }
);

/**
 * Helper function to calculate scheduled time based on window, time, and timezone
 */
function calculateScheduledTime(window: string, time: string, timezone: string): string {
  const now = new Date();
  const [hours, minutes] = time.split(":").map(Number);

  // Create scheduled time for today
  const scheduled = new Date(now);
  scheduled.setHours(hours, minutes, 0, 0);

  // If the time has already passed today, schedule for tomorrow
  if (scheduled <= now) {
    scheduled.setDate(scheduled.getDate() + 1);
  }

  // Handle time windows with random offset
  let offsetMinutes = 0;
  switch (window) {
    case "morning": // 6am-10am
      offsetMinutes = Math.floor(Math.random() * 240); // 0-240 minutes
      break;
    case "afternoon": // 12pm-4pm
      offsetMinutes = Math.floor(Math.random() * 240);
      break;
    case "evening": // 6pm-9pm
      offsetMinutes = Math.floor(Math.random() * 180);
      break;
    case "custom":
      // Use exact time specified
      break;
  }

  scheduled.setMinutes(scheduled.getMinutes() + offsetMinutes);

  return scheduled.toISOString();
}

/**
 * Scheduled function: Dispatch Daily Push Notifications (runs every 5 minutes)
 * This sends pending push notifications that are due
 */
export const scheduledDispatchDailyPushes = onSchedule(
  {
    schedule: "*/5 * * * *", // Every 5 minutes
    timeZone: "UTC",
    secrets: [vapidPublicKey, vapidPrivateKey, vapidSubject],
  },
  async () => {
    console.log("Starting scheduled daily push dispatch...");

    try {
      const db = admin.firestore();
      const now = admin.firestore.Timestamp.now();

      // Get pending pushes that are due
      const pendingPushesSnapshot = await db
        .collection("user_daily_pushes")
        .where("delivered_at", "==", null)
        .where("scheduled_at", "<=", now)
        .limit(100)
        .get();

      if (pendingPushesSnapshot.empty) {
        console.log("No pending pushes to dispatch");
        return;
      }

      console.log(`Found ${pendingPushesSnapshot.size} pending pushes`);

      // Load VAPID keys for Web Push
      const vapidPublicKeyValue = vapidPublicKey.value();
      const vapidPrivateKeyValue = vapidPrivateKey.value();
      const vapidSubjectValue = vapidSubject.value() || "mailto:admin@cosmiq.quest";

      if (!vapidPublicKeyValue || !vapidPrivateKeyValue) {
        console.log("VAPID keys not configured, skipping web push");
        return;
      }

      const webpush = require("web-push");
      webpush.setVapidDetails(vapidSubjectValue, vapidPublicKeyValue, vapidPrivateKeyValue);

      let dispatched = 0;
      const errors: Array<{ pushId: string; error: string }> = [];

      for (const pushDoc of pendingPushesSnapshot.docs) {
        try {
          const push = pushDoc.data();
          console.log(`Dispatching push ${pushDoc.id} to user ${push.user_id}`);

          // Get pep talk details
          const pepTalkDoc = await db.collection("daily_pep_talks").doc(push.daily_pep_talk_id).get();
          if (!pepTalkDoc.exists) {
            errors.push({ pushId: pushDoc.id, error: "Pep talk not found" });
            continue;
          }

          const pepTalk = pepTalkDoc.data()!;

          // Get user's push subscriptions (web and iOS)
          // Check both user_id and userId fields for compatibility
          const subscriptionsSnapshot = await db
            .collection("push_subscriptions")
            .where("user_id", "==", push.user_id)
            .get();
          
          // Also check userId field if no results (for compatibility with frontend naming)
          let subscriptions = subscriptionsSnapshot.docs;
          if (subscriptions.length === 0) {
            const userIdSnapshot = await db
              .collection("push_subscriptions")
              .where("userId", "==", push.user_id)
              .get();
            subscriptions = userIdSnapshot.docs;
          }

          if (subscriptions.length === 0) {
            console.log(`No push subscriptions for user ${push.user_id}`);
            // Mark as delivered anyway (user has no devices registered)
            await pushDoc.ref.update({
              delivered_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            dispatched++;
            continue;
          }

          // Separate web and iOS subscriptions
          const webSubscriptions = subscriptions.filter(
            (doc) => doc.data().platform === "web" || !doc.data().platform
          );
          const iosSubscriptions = subscriptions.filter(
            (doc) => doc.data().platform === "ios"
          );

          let successCount = 0;

          // Send to web subscriptions
          if (webSubscriptions.length > 0 && vapidPublicKeyValue && vapidPrivateKeyValue) {
            const payload = {
              title: pepTalk.title || "Your Daily Pep Talk",
              body: pepTalk.summary || "A new message from your mentor",
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              tag: `pep-talk-${push.daily_pep_talk_id}`,
              data: {
                type: "daily_pep_talk",
                pep_talk_id: push.daily_pep_talk_id,
                audio_url: pepTalk.audio_url,
                url: "/pep-talks",
              },
            };

            const sendPromises = webSubscriptions.map(async (subDoc) => {
              const sub = subDoc.data();
              try {
                await webpush.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: {
                      p256dh: sub.p256dh,
                      auth: sub.auth,
                    },
                  },
                  JSON.stringify(payload),
                  {
                    TTL: 3600, // 1 hour
                  }
                );
                return { success: true, endpoint: sub.endpoint };
              } catch (error: any) {
                // Handle expired subscriptions
                if (error.statusCode === 410 || error.statusCode === 404) {
                  await subDoc.ref.delete();
                  return { success: false, error: "SUBSCRIPTION_EXPIRED", endpoint: sub.endpoint };
                }
                return { success: false, error: error.message, endpoint: sub.endpoint };
              }
            });

            const results = await Promise.allSettled(sendPromises);
            successCount += results.filter(
              (r) => r.status === "fulfilled" && r.value.success
            ).length;
          }

          // Send to iOS subscriptions
          if (iosSubscriptions.length > 0) {
            const apnsKeyIdValue = apnsKeyId.value();
            const apnsTeamIdValue = apnsTeamId.value();
            const apnsBundleIdValue = apnsBundleId.value();
            const apnsKeyValue = apnsAuthKey.value();
            const apnsEnvironmentValue = apnsEnvironment.value() || "production";

            if (apnsKeyIdValue && apnsTeamIdValue && apnsBundleIdValue && apnsKeyValue) {
              const iosSendPromises = iosSubscriptions.map(async (subDoc) => {
                const sub = subDoc.data();
                try {
                  const jwt = await generateAPNsJWT(apnsKeyIdValue, apnsTeamIdValue, apnsKeyValue);
                  const apnsHost = apnsEnvironmentValue === "production" 
                    ? "api.push.apple.com" 
                    : "api.sandbox.push.apple.com";
                  // iOS tokens are stored in endpoint field for push_subscriptions
                  const deviceToken = sub.endpoint || sub.device_token;
                  if (!deviceToken) {
                    console.log(`iOS subscription ${subDoc.id} missing device token`);
                    return { success: false, error: "Missing device token" };
                  }
                  
                  const apnsUrl = `https://${apnsHost}/3/device/${deviceToken}`;

                  const payload = {
                    aps: {
                      alert: {
                        title: pepTalk.title || "Your Daily Pep Talk",
                        body: pepTalk.summary || "A new message from your mentor",
                      },
                      sound: "default",
                      badge: 1,
                    },
                    type: "daily_pep_talk",
                    pep_talk_id: push.daily_pep_talk_id,
                    audio_url: pepTalk.audio_url,
                    url: "/pep-talks",
                  };

                  const apnsResponse = await fetch(apnsUrl, {
                    method: "POST",
                    headers: {
                      authorization: `bearer ${jwt}`,
                      "apns-topic": apnsBundleIdValue,
                      "apns-push-type": "alert",
                      "apns-priority": "10",
                      "content-type": "application/json",
                    },
                    body: JSON.stringify(payload),
                  });

                  if (!apnsResponse.ok) {
                    const errorText = await apnsResponse.text();
                    if (apnsResponse.status === 410 || apnsResponse.status === 404) {
                      await subDoc.ref.delete();
                      return { success: false, error: "SUBSCRIPTION_EXPIRED" };
                    }
                    return { success: false, error: errorText };
                  }

                  return { success: true };
                } catch (error: any) {
                  return { success: false, error: error.message };
                }
              });

              const iosResults = await Promise.allSettled(iosSendPromises);
              successCount += iosResults.filter(
                (r) => r.status === "fulfilled" && r.value.success
              ).length;
            } else {
              console.log("APNS not configured, skipping iOS notifications");
            }
          }

          if (successCount > 0) {
            // Mark as delivered
            await pushDoc.ref.update({
              delivered_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            dispatched++;
            console.log(`✓ Dispatched push ${pushDoc.id} to ${successCount}/${subscriptions.length} devices`);
          } else {
            errors.push({
              pushId: pushDoc.id,
              error: `Failed to send to all ${subscriptions.length} devices`,
            });
          }
        } catch (error) {
          console.error(`Error dispatching push ${pushDoc.id}:`, error);
          errors.push({
            pushId: pushDoc.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      console.log(`Dispatch complete. Dispatched: ${dispatched}, Errors: ${errors.length}`);
    } catch (error) {
      console.error("Error in scheduled daily push dispatch:", error);
      throw error;
    }
  }
);

/**
 * Send APNS Notification - Sends push notifications to iOS devices via Apple Push Notification Service
 */
export const sendApnsNotification = onCall(
  {
    secrets: [apnsKeyId, apnsTeamId, apnsBundleId, apnsAuthKey, apnsEnvironment],
  },
  async (request) => {
    // Internal function - requires authentication
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
    }

    try {
      const { deviceToken, title, body, data } = request.data;

      if (!deviceToken || !title || !body) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required fields: deviceToken, title, body");
      }

      const apnsKeyIdValue = apnsKeyId.value();
      const apnsTeamIdValue = apnsTeamId.value();
      const apnsBundleIdValue = apnsBundleId.value();
      const apnsKeyValue = apnsAuthKey.value();
      const apnsEnvironmentValue = apnsEnvironment.value() || "production";

      if (!apnsKeyIdValue || !apnsTeamIdValue || !apnsBundleIdValue || !apnsKeyValue) {
        throw new functions.https.HttpsError("internal", "APNs not configured. Please add APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, and APNS_AUTH_KEY secrets.");
      }

      // Generate JWT for APNs
      const jwt = await generateAPNsJWT(apnsKeyIdValue, apnsTeamIdValue, apnsKeyValue);

      const apnsHost = apnsEnvironmentValue === "production" 
        ? "api.push.apple.com" 
        : "api.sandbox.push.apple.com";
      const apnsUrl = `https://${apnsHost}/3/device/${deviceToken}`;

      const payload = {
        aps: {
          alert: {
            title,
            body,
          },
          sound: "default",
          badge: 1,
        },
        ...data,
      };

      const apnsResponse = await fetch(apnsUrl, {
        method: "POST",
        headers: {
          authorization: `bearer ${jwt}`,
          "apns-topic": apnsBundleIdValue,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!apnsResponse.ok) {
      const errorText = await apnsResponse.text();
      console.error("APNs error:", errorText);
      throw new functions.https.HttpsError("internal", `APNs request failed: ${apnsResponse.status} ${errorText}`);
    }

    return { success: true, message: "Notification sent" };
  } catch (error) {
    console.error("Error in sendApnsNotification:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", `Failed to send notification: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

/**
 * Generate APNs JWT token for authentication
 */
async function generateAPNsJWT(keyId: string, teamId: string, privateKey: string): Promise<string> {
  const jwt = require("jsonwebtoken");

  // Convert base64 key to PEM format if needed
  let key = privateKey;
  if (!key.includes("BEGIN")) {
    // Assume it's base64 encoded, convert to PEM
    const keyBuffer = Buffer.from(privateKey, "base64");
    key = keyBuffer.toString("utf8");
  }

  // Ensure proper PEM format
  if (!key.includes("BEGIN PRIVATE KEY")) {
    key = `-----BEGIN PRIVATE KEY-----\n${key.replace(/\s/g, "")}\n-----END PRIVATE KEY-----`;
  }

  const token = jwt.sign(
    {},
    key,
    {
      algorithm: "ES256",
      header: {
        alg: "ES256",
        kid: keyId,
      },
      issuer: teamId,
      expiresIn: "1h",
    }
  );

  return token;
}

/**
 * Complete Referral Stage 3 - Atomically processes referral completion when a user reaches Stage 3
 * Prevents race conditions and ensures all-or-nothing behavior
 */
export const completeReferralStage3 = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const { referee_id, referrer_id } = request.data;

  // Validate inputs
  if (!referee_id || !referrer_id) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "referee_id and referrer_id are required"
    );
  }

  if (referee_id === referrer_id) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Cannot refer yourself"
    );
  }

  // Verify the caller is the referee
  if (request.auth.uid !== referee_id) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You can only complete your own referral"
    );
  }

  const db = admin.firestore();

  try {
    // Use a transaction to ensure atomicity
    return await db.runTransaction(async (transaction) => {
      // Step 1: Check if already completed
      const completionRef = db.collection("referral_completions")
        .where("referee_id", "==", referee_id)
        .where("referrer_id", "==", referrer_id)
        .limit(1);

      const completionSnapshot = await transaction.get(completionRef);
      
      if (!completionSnapshot.empty) {
        // Already completed
        return {
          success: false,
          reason: "already_completed",
          message: "This referral has already been counted"
        };
      }

      // Step 2: Get referrer profile to check current count
      const referrerProfileRef = db.collection("profiles").doc(referrer_id);
      const referrerProfileDoc = await transaction.get(referrerProfileRef);

      if (!referrerProfileDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          `Referrer profile not found: ${referrer_id}`
        );
      }

      const referrerProfile = referrerProfileDoc.data()!;
      const currentCount = referrerProfile.referral_count || 0;
      const newCount = currentCount + 1;

      // Step 3: Insert completion record (acts as lock)
      const completionId = `${referee_id}_${referrer_id}`;
      const completionDocRef = db.collection("referral_completions").doc(completionId);
      transaction.set(completionDocRef, {
        referee_id,
        referrer_id,
        stage_reached: 3,
        completed_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Step 4: Increment referral count
      transaction.update(referrerProfileRef, {
        referral_count: newCount,
      });

      // Step 5: Check for skin unlocks (milestones at 1, 3, 5)
      let skinUnlocked = false;
      let unlockedSkinId: string | null = null;

      if (newCount === 1 || newCount === 3 || newCount === 5) {
        // Find the skin for this milestone
        const skinsRef = db.collection("companion_skins")
          .where("unlock_type", "==", "referral")
          .where("unlock_requirement", "==", newCount)
          .limit(1);

        const skinsSnapshot = await transaction.get(skinsRef);
        
        if (!skinsSnapshot.empty) {
          const skinDoc = skinsSnapshot.docs[0];
          unlockedSkinId = skinDoc.id;

          // Check if user already has this skin
          const userSkinRef = db.collection("user_companion_skins")
            .where("user_id", "==", referrer_id)
            .where("skin_id", "==", unlockedSkinId)
            .limit(1);

          const userSkinSnapshot = await transaction.get(userSkinRef);

          if (userSkinSnapshot.empty) {
            // Unlock the skin
            const userSkinId = `${referrer_id}_${unlockedSkinId}`;
            const userSkinDocRef = db.collection("user_companion_skins").doc(userSkinId);
            transaction.set(userSkinDocRef, {
              user_id: referrer_id,
              skin_id: unlockedSkinId,
              acquired_via: `referral_milestone_${newCount}`,
              acquired_at: admin.firestore.FieldValue.serverTimestamp(),
              is_equipped: false,
            });
            skinUnlocked = true;
          }
        }
      }

      // Step 6: Clear referred_by from referee profile
      const refereeProfileRef = db.collection("profiles").doc(referee_id);
      transaction.update(refereeProfileRef, {
        referred_by: null,
      });

      // All operations succeeded
      return {
        success: true,
        newCount,
        skinUnlocked,
        unlockedSkinId: unlockedSkinId || undefined,
        milestoneReached: newCount === 1 || newCount === 3 || newCount === 5,
      };
    });
  } catch (error) {
    console.error("Error in completeReferralStage3:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      "internal",
      `Failed to complete referral: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
});

/**
 * Resolve Streak Freeze - Handles streak freeze resolution (use freeze or reset streak)
 */
export const resolveStreakFreeze = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const { action } = request.data;

  if (action !== "use_freeze" && action !== "reset_streak") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "action must be 'use_freeze' or 'reset_streak'"
    );
  }

  const userId = request.auth.uid;
  const db = admin.firestore();

  try {
    return await db.runTransaction(async (transaction) => {
      const profileRef = db.collection("profiles").doc(userId);
      const profileDoc = await transaction.get(profileRef);

      if (!profileDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Profile not found"
        );
      }

      const profile = profileDoc.data()!;
      const currentStreak = profile.current_habit_streak || 0;
      const freezesAvailable = profile.streak_freezes_available || 0;
      const isAtRisk = profile.streak_at_risk || false;

      // Verify streak is actually at risk
      if (!isAtRisk) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Streak is not at risk"
        );
      }

      if (action === "use_freeze") {
        // Use a freeze
        if (freezesAvailable <= 0) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "No freezes available"
          );
        }

        transaction.update(profileRef, {
          streak_at_risk: false,
          streak_at_risk_since: null,
          streak_freezes_available: freezesAvailable - 1,
        });

        return {
          success: true,
          newStreak: currentStreak,
          freezesRemaining: freezesAvailable - 1,
          action: "freeze_used",
        };
      } else {
        // Reset streak
        transaction.update(profileRef, {
          current_habit_streak: 0,
          streak_at_risk: false,
          streak_at_risk_since: null,
        });

        return {
          success: true,
          newStreak: 0,
          freezesRemaining: freezesAvailable,
          action: "streak_reset",
        };
      }
    });
  } catch (error) {
    console.error("Error in resolveStreakFreeze:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      "internal",
      `Failed to resolve streak freeze: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
});

// ============================================================================
// Apple Subscription Functions
// ============================================================================

const PROD_VERIFY_URL = "https://buy.itunes.apple.com/verifyReceipt";
const SANDBOX_VERIFY_URL = "https://sandbox.itunes.apple.com/verifyReceipt";
const DEFAULT_MONTHLY_PRICE_CENTS = 999; // $9.99
const DEFAULT_YEARLY_PRICE_CENTS = 5999; // $59.99

interface AppleReceiptInfo {
  product_id?: string;
  original_transaction_id?: string;
  transaction_id?: string;
  expires_date_ms?: string;
  purchase_date_ms?: string;
  original_purchase_date_ms?: string;
  cancellation_date_ms?: string | null;
}

interface AppleVerifyResponse {
  status: number;
  environment?: string;
  latest_receipt_info?: AppleReceiptInfo[];
  receipt?: { [key: string]: unknown };
}

type SubscriptionStatus = "active" | "trialing" | "cancelled" | "past_due" | "expired";

function resolvePlanFromProduct(productId: string | undefined): "monthly" | "yearly" {
  const normalized = (productId ?? "").toLowerCase();
  if (normalized.includes("year") || normalized.includes("annual") || normalized.includes("yearly")) {
    return "yearly";
  }
  return "monthly";
}

function parseAppleDate(value?: string | null): Date | null {
  if (!value) return null;
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) return null;
  return new Date(asNumber);
}

function buildSubscriptionStatus(expiresAt: Date, cancelledAt?: Date | null): SubscriptionStatus {
  if (cancelledAt && cancelledAt <= new Date()) return "cancelled";
  if (expiresAt <= new Date()) return "expired";
  return "active";
}

function selectLatestReceipt(receiptInfo: AppleReceiptInfo[]): AppleReceiptInfo | null {
  if (!Array.isArray(receiptInfo) || receiptInfo.length === 0) return null;
  return [...receiptInfo].sort((a, b) => {
    const aTime = Number(a.expires_date_ms ?? a.purchase_date_ms ?? 0);
    const bTime = Number(b.expires_date_ms ?? b.purchase_date_ms ?? 0);
    return bTime - aTime;
  })[0];
}

async function callAppleVerification(receipt: string, url: string, sharedSecret: string): Promise<AppleVerifyResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "receipt-data": receipt,
      password: sharedSecret,
      "exclude-old-transactions": true,
    }),
  });

  return await response.json();
}

async function verifyReceiptWithApple(receipt: string, sharedSecret: string) {
  if (!receipt) {
    throw new Error("Receipt data required");
  }

  const prodResult = await callAppleVerification(receipt, PROD_VERIFY_URL, sharedSecret);
  if (prodResult.status === 0) {
    return { result: prodResult, environment: prodResult.environment ?? "Production" };
  }

  // Sandbox fallback (Apple returns 21007 when a sandbox receipt is sent to production endpoint)
  if (prodResult.status === 21007) {
    const sandboxResult = await callAppleVerification(receipt, SANDBOX_VERIFY_URL, sharedSecret);
    if (sandboxResult.status === 0) {
      return { result: sandboxResult, environment: sandboxResult.environment ?? "Sandbox" };
    }
    throw new Error(`Sandbox verification failed: ${sandboxResult.status}`);
  }

  throw new Error(`Receipt verification failed: ${prodResult.status}`);
}

function extractLatestTransaction(verifyResult: AppleVerifyResponse) {
  const receiptInfo = verifyResult.latest_receipt_info ?? [];
  const latest = selectLatestReceipt(receiptInfo);
  if (!latest) return null;

  const expiresAt = parseAppleDate(latest.expires_date_ms);
  const purchaseDate = parseAppleDate(latest.purchase_date_ms ?? latest.original_purchase_date_ms);

  if (!expiresAt || !purchaseDate) {
    return null;
  }

  return {
    productId: latest.product_id ?? "",
    transactionId: latest.original_transaction_id ?? latest.transaction_id ?? "",
    expiresAt,
    purchaseDate,
    cancellationDate: parseAppleDate(latest.cancellation_date_ms ?? undefined),
  };
}

async function upsertSubscriptionToFirestore(
  db: admin.firestore.Firestore,
  payload: {
    userId: string;
    transactionId: string;
    productId: string;
    plan: "monthly" | "yearly";
    expiresAt: Date;
    purchaseDate: Date;
    cancellationDate?: Date | null;
    environment?: string;
    source: "receipt" | "webhook";
  }
) {
  const status = buildSubscriptionStatus(payload.expiresAt, payload.cancellationDate);
  const now = admin.firestore.Timestamp.now();
  const amountCents = payload.plan === "monthly" ? DEFAULT_MONTHLY_PRICE_CENTS : DEFAULT_YEARLY_PRICE_CENTS;

  // Check if payment already exists
  const paymentQuery = await db.collection("payment_history")
    .where("stripe_payment_intent_id", "==", payload.transactionId)
    .limit(1)
    .get();

  const existingPayment = !paymentQuery.empty;

  // Upsert subscription
  const subscriptionRef = db.collection("subscriptions").doc(payload.userId);
  await subscriptionRef.set({
    user_id: payload.userId,
    stripe_subscription_id: payload.transactionId,
    stripe_customer_id: payload.transactionId,
    plan: payload.plan,
    status,
    current_period_start: admin.firestore.Timestamp.fromDate(payload.purchaseDate),
    current_period_end: admin.firestore.Timestamp.fromDate(payload.expiresAt),
    cancel_at: payload.cancellationDate ? admin.firestore.Timestamp.fromDate(payload.expiresAt) : null,
    cancelled_at: payload.cancellationDate ? admin.firestore.Timestamp.fromDate(payload.cancellationDate) : null,
    updated_at: now,
    environment: payload.environment ?? null,
    source: payload.source,
  }, { merge: true });

  // Update profile
  const profileRef = db.collection("profiles").doc(payload.userId);
  await profileRef.update({
    is_premium: status === "active" || status === "trialing",
    subscription_status: status,
    subscription_expires_at: admin.firestore.Timestamp.fromDate(payload.expiresAt),
    updated_at: now,
  });

  // Create payment history if it doesn't exist
  if (!existingPayment) {
    const subscriptionDoc = await subscriptionRef.get();
    await db.collection("payment_history").add({
      user_id: payload.userId,
      subscription_id: subscriptionDoc.id,
      stripe_payment_intent_id: payload.transactionId,
      stripe_invoice_id: payload.transactionId,
      amount: amountCents,
      currency: "usd",
      status: status === "active" ? "succeeded" : "pending",
      created_at: admin.firestore.Timestamp.fromDate(payload.purchaseDate),
      updated_at: now,
      metadata: {
        product_id: payload.productId,
        environment: payload.environment ?? "unknown",
      },
    });
  }

  return subscriptionRef;
}

/**
 * Verify Apple Receipt - Verifies an Apple receipt and updates subscription status
 */
export const verifyAppleReceipt = onCall(
  {
    secrets: [appleSharedSecret],
  },
  async (request: CallableRequest<{ receipt: string }>) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const { receipt } = request.data;

    if (!receipt) {
      throw new HttpsError(
        "invalid-argument",
        "Receipt data is required"
      );
    }

    const userId = request.auth.uid;
    const db = admin.firestore();
    const sharedSecret = appleSharedSecret.value();

    try {
      // Verify receipt with Apple
      const { result, environment } = await verifyReceiptWithApple(receipt, sharedSecret);

      // Extract latest transaction
      const transaction = extractLatestTransaction(result);
      if (!transaction) {
        throw new HttpsError(
          "invalid-argument",
          "No valid transaction found in receipt"
        );
      }

      // Determine plan from product ID
      const plan = resolvePlanFromProduct(transaction.productId);

      // Upsert subscription
      await upsertSubscriptionToFirestore(db, {
        userId,
        transactionId: transaction.transactionId,
        productId: transaction.productId,
        plan,
        expiresAt: transaction.expiresAt,
        purchaseDate: transaction.purchaseDate,
        cancellationDate: transaction.cancellationDate,
        environment,
        source: "receipt",
      });

      return {
        success: true,
        plan,
        status: buildSubscriptionStatus(transaction.expiresAt, transaction.cancellationDate),
        expiresAt: transaction.expiresAt.toISOString(),
        environment,
      };
    } catch (error) {
      console.error("Error in verifyAppleReceipt:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        `Failed to verify receipt: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);

/**
 * Check Apple Subscription - Returns the current subscription status for a user
 */
export const checkAppleSubscription = onCall(
  async (request: CallableRequest) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const userId = request.auth.uid;
    const db = admin.firestore();

    try {
      const subscriptionDoc = await db.collection("subscriptions").doc(userId).get();

      if (!subscriptionDoc.exists) {
        return { subscribed: false };
      }

      const subscription = subscriptionDoc.data()!;
      const expiresAt = subscription.current_period_end?.toDate();
      const isActive = !!(expiresAt && expiresAt > new Date() && subscription.status !== "cancelled");

      return {
        subscribed: isActive,
        status: subscription.status as SubscriptionStatus,
        plan: subscription.plan as "monthly" | "yearly" | undefined,
        subscription_end: expiresAt?.toISOString(),
      };
    } catch (error) {
      console.error("Error in checkAppleSubscription:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        `Failed to check subscription: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);

/**
 * Apple Webhook - HTTP endpoint for App Store Server Notifications
 * This must be an HTTP function (not onCall) because Apple sends POST requests
 */
export const appleWebhook = onRequest(
  {
    secrets: [appleSharedSecret, appleServiceId, appleIosBundleId, appleWebhookAudience],
  },
  async (req: ExpressRequest, res: ExpressResponse) => {
  // Handle CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const payload = req.body as any;
    const db = admin.firestore();

    console.log("Received Apple notification:", {
      type: payload.notification_type ?? payload?.notificationType,
      timestamp: new Date().toISOString(),
    });

    // For now, we'll handle the legacy format (without JWT verification)
    // TODO: Add JWT verification using jose library for production
    const notificationType = payload.notification_type ?? payload?.notificationType;
    const latestReceiptInfo = payload.latest_receipt_info;

    if (!latestReceiptInfo) {
      console.error("No receipt info in notification");
      res.status(200).send("OK");
      return;
    }

    // Extract subscription details
    const originalTransactionId = latestReceiptInfo.original_transaction_id;
    const productId = latestReceiptInfo.product_id;
    const expiresDateMs = latestReceiptInfo.expires_date_ms;
    const purchaseDateMs = latestReceiptInfo.purchase_date_ms;
    const cancellationDateMs = latestReceiptInfo.cancellation_date_ms;

    // Find user by transaction ID
    const subscriptionQuery = await db.collection("subscriptions")
      .where("stripe_subscription_id", "==", originalTransactionId)
      .limit(1)
      .get();

    if (subscriptionQuery.empty) {
      console.log("No subscription found for transaction:", originalTransactionId);
      res.status(200).send("OK");
      return;
    }

    const subscriptionDoc = subscriptionQuery.docs[0];
    const userId = subscriptionDoc.data().user_id;

    // Determine plan from product ID
    const plan = resolvePlanFromProduct(productId);

    // Process notification based on type
    const expiresAt = parseAppleDate(expiresDateMs);
    const purchaseDate = parseAppleDate(purchaseDateMs);
    const cancellationDate = parseAppleDate(cancellationDateMs);

    if (!expiresAt || !purchaseDate) {
      console.error("Invalid dates in notification");
      res.status(200).send("OK");
      return;
    }

    switch (notificationType) {
      case "INITIAL_BUY":
      case "DID_RENEW":
      case "DID_RECOVER":
        // Activate subscription
        await upsertSubscriptionToFirestore(db, {
          userId,
          transactionId: originalTransactionId,
          productId,
          plan,
          expiresAt,
          purchaseDate,
          cancellationDate: null,
          source: "webhook",
        });
        break;

      case "DID_CHANGE_RENEWAL_STATUS":
        // Update renewal status
        const willRenew = payload.auto_renew_status === "true" || payload.auto_renew_status === true;
        await db.collection("subscriptions").doc(userId).update({
          status: willRenew ? "active" : "cancelled",
          cancel_at: willRenew ? null : admin.firestore.Timestamp.fromDate(expiresAt),
          updated_at: admin.firestore.Timestamp.now(),
        });
        break;

      case "DID_CHANGE_RENEWAL_PREF":
        // Plan changed
        await upsertSubscriptionToFirestore(db, {
          userId,
          transactionId: originalTransactionId,
          productId,
          plan,
          expiresAt,
          purchaseDate,
          cancellationDate: null,
          source: "webhook",
        });
        break;

      case "DID_FAIL_TO_RENEW":
        // Billing issue
        await db.collection("subscriptions").doc(userId).update({
          status: "past_due",
          current_period_end: admin.firestore.Timestamp.fromDate(expiresAt),
          updated_at: admin.firestore.Timestamp.now(),
        });
        await db.collection("profiles").doc(userId).update({
          subscription_status: "past_due",
          updated_at: admin.firestore.Timestamp.now(),
        });
        break;

      case "CANCEL":
      case "REVOKE":
        // Cancelled
        await upsertSubscriptionToFirestore(db, {
          userId,
          transactionId: originalTransactionId,
          productId,
          plan,
          expiresAt,
          purchaseDate,
          cancellationDate: cancellationDate || new Date(),
          source: "webhook",
        });
        break;

      case "REFUND":
        // Refunded - revoke access
        await db.collection("subscriptions").doc(userId).update({
          status: "cancelled",
          cancelled_at: admin.firestore.Timestamp.now(),
          updated_at: admin.firestore.Timestamp.now(),
        });
        await db.collection("profiles").doc(userId).update({
          is_premium: false,
          subscription_status: "cancelled",
          updated_at: admin.firestore.Timestamp.now(),
        });
        break;

      default:
        console.log("Unhandled notification type:", notificationType);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Error processing Apple notification:", error);
    // Always return 200 to prevent Apple from retrying
    res.status(200).send("OK");
  }
});

/**
 * Scheduled function: Deliver scheduled notifications (runs every 5 minutes)
 * Processes pending notifications from push_notification_queue
 */
export const scheduledDeliverScheduledNotifications = onSchedule(
  {
    schedule: "*/5 * * * *", // Every 5 minutes
    timeZone: "UTC",
    secrets: [vapidPublicKey, vapidPrivateKey, vapidSubject, apnsKeyId, apnsTeamId, apnsBundleId, apnsAuthKey, apnsEnvironment],
  },
  async () => {
    console.log("Starting scheduled notification delivery...");

    try {
      const db = admin.firestore();
      const now = admin.firestore.Timestamp.now();

      // Get pending notifications that are due
      // Note: orderBy requires a composite index. If index doesn't exist, remove orderBy or create index.
      const pendingNotificationsSnapshot = await db
        .collection("push_notification_queue")
        .where("delivered", "==", false)
        .where("scheduled_for", "<=", now)
        .limit(50)
        .get();
      
      // Sort in memory if orderBy causes index issues
      const sortedDocs = pendingNotificationsSnapshot.docs.sort((a, b) => {
        const aScheduled = a.data().scheduled_for;
        const bScheduled = b.data().scheduled_for;
        const aTime = aScheduled?.toMillis?.() || 
                     (aScheduled instanceof admin.firestore.Timestamp ? aScheduled.toMillis() : 0) ||
                     0;
        const bTime = bScheduled?.toMillis?.() || 
                     (bScheduled instanceof admin.firestore.Timestamp ? bScheduled.toMillis() : 0) ||
                     0;
        return aTime - bTime;
      });

      if (pendingNotificationsSnapshot.empty) {
        console.log("No pending notifications to deliver");
        return;
      }

      console.log(`Found ${pendingNotificationsSnapshot.size} notifications to deliver`);

      let delivered = 0;
      let failed = 0;

      // Load VAPID keys for Web Push
      const vapidPublicKeyValue = vapidPublicKey.value();
      const vapidPrivateKeyValue = vapidPrivateKey.value();
      const vapidSubjectValue = vapidSubject.value() || "mailto:admin@cosmiq.quest";

      const webpush = require("web-push");
      if (vapidPublicKeyValue && vapidPrivateKeyValue) {
        webpush.setVapidDetails(vapidSubjectValue, vapidPublicKeyValue, vapidPrivateKeyValue);
      }

      for (const notificationDoc of sortedDocs) {
        try {
          const notification = notificationDoc.data();
          if (!notification.user_id) {
            console.error(`Notification ${notificationDoc.id} missing user_id`);
            continue;
          }
          console.log(`Processing notification ${notificationDoc.id} for user ${notification.user_id}`);

          // Get user's push subscriptions (check both user_id and userId fields for compatibility)
          const subscriptionsSnapshot = await db
            .collection("push_subscriptions")
            .where("user_id", "==", notification.user_id)
            .get();
          
          // Also check userId field if no results (for compatibility with frontend naming)
          let subscriptions = subscriptionsSnapshot.docs;
          if (subscriptions.length === 0) {
            const userIdSnapshot = await db
              .collection("push_subscriptions")
              .where("userId", "==", notification.user_id)
              .get();
            subscriptions = userIdSnapshot.docs;
          }

          if (subscriptions.length === 0) {
            console.log(`No subscription for user ${notification.user_id}, marking as delivered`);
            await notificationDoc.ref.update({
              delivered: true,
              delivered_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            delivered++;
            continue;
          }

          let success = false;

          // Send to all subscriptions
          for (const subDoc of subscriptions) {
            const sub = subDoc.data();

            if (sub.platform === "ios") {
              // iOS tokens are stored in endpoint field for push_subscriptions
              const deviceToken = sub.endpoint || sub.device_token;
              if (!deviceToken) {
                console.log(`iOS subscription ${subDoc.id} missing device token`);
                continue;
              }
              
              // Send via APNs
              try {
                const apnsKeyIdValue = apnsKeyId.value();
                const apnsTeamIdValue = apnsTeamId.value();
                const apnsBundleIdValue = apnsBundleId.value();
                const apnsKeyValue = apnsAuthKey.value();
                const apnsEnvironmentValue = apnsEnvironment.value() || "production";

                if (!apnsKeyIdValue || !apnsTeamIdValue || !apnsBundleIdValue || !apnsKeyValue) {
                  console.error("APNs not configured, skipping iOS notification");
                  continue;
                }

                const jwt = await generateAPNsJWT(apnsKeyIdValue, apnsTeamIdValue, apnsKeyValue);
                const apnsHost = apnsEnvironmentValue === "production" 
                  ? "api.push.apple.com" 
                  : "api.sandbox.push.apple.com";
                const apnsUrl = `https://${apnsHost}/3/device/${deviceToken}`;

                const apnsPayload = {
                  aps: {
                    alert: {
                      title: notification.title,
                      body: notification.body,
                    },
                    sound: "default",
                    badge: 1,
                  },
                  ...(notification.data || {}),
                };

                const apnsResponse = await fetch(apnsUrl, {
                  method: "POST",
                  headers: {
                    authorization: `bearer ${jwt}`,
                    "apns-topic": apnsBundleIdValue,
                    "apns-push-type": "alert",
                    "apns-priority": "10",
                    "content-type": "application/json",
                  },
                  body: JSON.stringify(apnsPayload),
                });

                if (!apnsResponse.ok) {
                  const errorText = await apnsResponse.text();
                  if (apnsResponse.status === 410 || apnsResponse.status === 404) {
                    // Token invalid, delete subscription
                    await subDoc.ref.delete();
                    console.log(`Deleted invalid iOS subscription ${subDoc.id}`);
                  } else {
                    console.error(`APNs error for ${subDoc.id}: ${apnsResponse.status} ${errorText}`);
                  }
                } else {
                  success = true;
                }
              } catch (apnsError) {
                console.error(`APNs error for ${subDoc.id}:`, apnsError);
              }
            } else if (sub.platform === "web" && sub.endpoint && sub.p256dh && sub.auth) {
              // Send via Web Push
              if (vapidPublicKeyValue && vapidPrivateKeyValue) {
                try {
                  await webpush.sendNotification(
                    {
                      endpoint: sub.endpoint,
                      keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth,
                      },
                    },
                    JSON.stringify({
                      title: notification.title,
                      body: notification.body,
                      icon: "/icon-192.png",
                      badge: "/icon-192.png",
                      data: notification.data || {},
                    })
                  );
                  success = true;
                } catch (webPushError: any) {
                  if (webPushError.statusCode === 410) {
                    // Subscription expired, delete it
                    await subDoc.ref.delete();
                    console.log(`Deleted expired subscription ${subDoc.id}`);
                  }
                  console.error(`Web push error for ${subDoc.id}:`, webPushError);
                }
              }
            }
          }

          // Mark as delivered
          await notificationDoc.ref.update({
            delivered: true,
            delivered_at: admin.firestore.FieldValue.serverTimestamp(),
          });

          if (success) {
            delivered++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`Error processing notification ${notificationDoc.id}:`, error);
          failed++;
        }
      }

      console.log(`Delivery complete: ${delivered} delivered, ${failed} failed`);
    } catch (error) {
      console.error("Error in scheduled notification delivery:", error);
      throw error;
    }
  }
);

/**
 * Scheduled function: Process daily decay (runs daily at 2 AM UTC)
 * Handles companion stat decay, streak freezes, and recovery
 */
export const scheduledProcessDailyDecay = onSchedule(
  {
    schedule: "0 2 * * *", // Daily at 2 AM UTC
    timeZone: "UTC",
  },
  async () => {
    console.log("[Daily Decay] Starting daily decay processing...");

    try {
      const db = admin.firestore();
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const todayStr = today.toISOString().split("T")[0];
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      // Get all companions
      const companionsSnapshot = await db.collection("user_companion").get();

      console.log(`[Daily Decay] Found ${companionsSnapshot.size} companions to process`);

      let processedCount = 0;
      let decayedCount = 0;
      let recoveredCount = 0;
      let neglectedImageTriggered = 0;

      for (const companionDoc of companionsSnapshot.docs) {
        try {
          const companion = companionDoc.data();

          // Check if user had any activity yesterday
          const hadActivity = await checkUserActivityForDecay(db, companion.user_id, yesterdayStr);

          if (hadActivity) {
            // User was active - reset decay
            if ((companion.inactive_days ?? 0) > 0) {
              console.log(`[Recovery] User ${companion.user_id} was active, resetting decay`);

              // Recovery bonus: +10 to each stat
              const newBody = Math.min(100, (companion.body ?? 100) + 10);
              const newMind = Math.min(100, (companion.mind ?? 0) + 10);
              const newSoul = Math.min(100, (companion.soul ?? 0) + 10);

              await companionDoc.ref.update({
                inactive_days: 0,
                last_activity_date: yesterdayStr,
                current_mood: "happy",
                body: newBody,
                mind: newMind,
                soul: newSoul,
              });

              recoveredCount++;
            }
          } else {
            // User was inactive - apply decay
            const newInactiveDays = (companion.inactive_days ?? 0) + 1;

            console.log(`[Decay] User ${companion.user_id} inactive for ${newInactiveDays} days`);

            // Apply stat decay: -5 per stat per day (minimum 0)
            const newBody = Math.max(0, (companion.body ?? 100) - 5);
            const newMind = Math.max(0, (companion.mind ?? 0) - 5);
            const newSoul = Math.max(0, (companion.soul ?? 0) - 5);

            // Determine mood based on inactive days
            let newMood = "neutral";
            if (newInactiveDays === 1) newMood = "neutral";
            else if (newInactiveDays === 2) newMood = "worried";
            else if (newInactiveDays >= 3 && newInactiveDays < 5) newMood = "sad";
            else if (newInactiveDays >= 5) newMood = "sick";

            await companionDoc.ref.update({
              inactive_days: newInactiveDays,
              current_mood: newMood,
              body: newBody,
              mind: newMind,
              soul: newSoul,
            });

            decayedCount++;

            // Trigger neglected image generation at 3 days if not already generated
            if (newInactiveDays === 3 && !companion.neglected_image_url && companion.current_image_url) {
              console.log(`[Neglected Image] Triggering generation for user ${companion.user_id}`);
              // The generateNeglectedCompanionImage function can be called here
              neglectedImageTriggered++;
            }

            // Handle streak freeze logic
            await handleStreakFreezeForDecay(db, companion.user_id);
          }

          processedCount++;
        } catch (userError) {
          console.error(`Error processing companion ${companionDoc.id}:`, userError);
        }
      }

      // Reset expired streak freezes
      await resetExpiredStreakFreezesForDecay(db, todayStr);

      console.log(
        `[Daily Decay] Complete: ${processedCount} processed, ${decayedCount} decayed, ${recoveredCount} recovered, ${neglectedImageTriggered} neglected images triggered`
      );
    } catch (error) {
      console.error("[Daily Decay] Error:", error);
      throw error;
    }
  }
);

/**
 * Helper function to check user activity for decay processing
 */
async function checkUserActivityForDecay(db: admin.firestore.Firestore, userId: string, date: string): Promise<boolean> {
  // Check for task completions
  // Note: task_date might be stored as Date, Timestamp, or string - handle all cases
  const tasksSnapshot = await db
    .collection("daily_tasks")
    .where("user_id", "==", userId)
    .where("completed", "==", true)
    .limit(100) // Get more to filter by date in memory
    .get();

  // Filter by date in memory (handles Date, Timestamp, or string)
  const matchingTasks = tasksSnapshot.docs.filter(doc => {
    const taskDate = doc.data().task_date;
    if (!taskDate) return false;
    // Handle Timestamp
    if (taskDate.toDate) {
      return taskDate.toDate().toISOString().split("T")[0] === date;
    }
    // Handle Date
    if (taskDate instanceof Date) {
      return taskDate.toISOString().split("T")[0] === date;
    }
    // Handle string
    return taskDate === date || taskDate.split("T")[0] === date;
  });

  if (matchingTasks.length > 0) return true;

  // Check for habit completions
  const habitsSnapshot = await db
    .collection("habit_completions")
    .where("user_id", "==", userId)
    .limit(100) // Get more to filter by date
    .get();

  const matchingHabits = habitsSnapshot.docs.filter(doc => {
    const habitDate = doc.data().date;
    if (!habitDate) return false;
    if (habitDate.toDate) return habitDate.toDate().toISOString().split("T")[0] === date;
    if (habitDate instanceof Date) return habitDate.toISOString().split("T")[0] === date;
    return habitDate === date || habitDate.split("T")[0] === date;
  });

  if (matchingHabits.length > 0) return true;

  // Check for check-ins
  const checkInsSnapshot = await db
    .collection("daily_check_ins")
    .where("user_id", "==", userId)
    .limit(100) // Get more to filter by date
    .get();

  const matchingCheckIns = checkInsSnapshot.docs.filter(doc => {
    const checkInDate = doc.data().check_in_date;
    if (!checkInDate) return false;
    if (checkInDate.toDate) return checkInDate.toDate().toISOString().split("T")[0] === date;
    if (checkInDate instanceof Date) return checkInDate.toISOString().split("T")[0] === date;
    return checkInDate === date || checkInDate.split("T")[0] === date;
  });

  if (matchingCheckIns.length > 0) return true;

  return false;
}

/**
 * Helper function to handle streak freeze logic
 */
async function handleStreakFreezeForDecay(db: admin.firestore.Firestore, userId: string): Promise<void> {
  const profileDoc = await db.collection("profiles").doc(userId).get();
  if (!profileDoc.exists) return;

  const profile = profileDoc.data()!;

  // If user has no streak, nothing to protect
  if ((profile.current_habit_streak ?? 0) <= 0) return;

  // Check if streak_at_risk was set more than 24 hours ago
  if (profile.streak_at_risk && profile.streak_at_risk_since) {
    const riskSince = (profile.streak_at_risk_since as admin.firestore.Timestamp).toDate();
    const hoursSinceRisk = (Date.now() - riskSince.getTime()) / (1000 * 60 * 60);

    if (hoursSinceRisk >= 24) {
      // Auto-consume freeze if available, else reset
      if ((profile.streak_freezes_available ?? 0) > 0) {
        await profileDoc.ref.update({
          streak_at_risk: false,
          streak_at_risk_since: null,
          streak_freezes_available: Math.max(0, (profile.streak_freezes_available ?? 1) - 1),
          last_streak_freeze_used: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await profileDoc.ref.update({
          streak_at_risk: false,
          streak_at_risk_since: null,
          current_habit_streak: 0,
        });
      }
      return;
    }
    // Streak already at risk, user hasn't decided yet
    return;
  }

  // First miss: set streak_at_risk
  await profileDoc.ref.update({
    streak_at_risk: true,
    streak_at_risk_since: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Helper function to reset expired streak freezes
 */
async function resetExpiredStreakFreezesForDecay(db: admin.firestore.Firestore, today: string): Promise<void> {
  const now = admin.firestore.Timestamp.now();
  const profilesSnapshot = await db
    .collection("profiles")
    .where("streak_freezes_reset_at", "<", now)
    .get();

  for (const profileDoc of profilesSnapshot.docs) {
    const nextReset = new Date();
    nextReset.setDate(nextReset.getDate() + 7);

    await profileDoc.ref.update({
      streak_freezes_available: 1,
      streak_freezes_reset_at: admin.firestore.Timestamp.fromDate(nextReset),
    });
  }
}

/**
 * Scheduled function: Deliver adaptive pushes (runs every 10 minutes)
 * Processes pending adaptive pushes from adaptive_push_queue
 */
export const scheduledDeliverAdaptivePushes = onSchedule(
  {
    schedule: "*/10 * * * *", // Every 10 minutes
    timeZone: "UTC",
    secrets: [vapidPublicKey, vapidPrivateKey, vapidSubject],
  },
  async () => {
    console.log("Starting adaptive push delivery...");

    try {
      const db = admin.firestore();
      const now = admin.firestore.Timestamp.now();
      const oneDayAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Get due pushes
      // Note: orderBy requires composite index. Sort in memory if needed.
      const duePushesSnapshot = await db
        .collection("adaptive_push_queue")
        .where("delivered", "==", false)
        .where("scheduled_for", "<=", now)
        .limit(50)
        .get();
      
      // Sort in memory by scheduled_for (ascending - earliest first)
      const sortedPushes = duePushesSnapshot.docs.sort((a, b) => {
        const aTime = a.data().scheduled_for?.toMillis?.() || 
                     (a.data().scheduled_for instanceof admin.firestore.Timestamp ? a.data().scheduled_for.toMillis() : 0) ||
                     0;
        const bTime = b.data().scheduled_for?.toMillis?.() || 
                     (b.data().scheduled_for instanceof admin.firestore.Timestamp ? b.data().scheduled_for.toMillis() : 0) ||
                     0;
        return aTime - bTime;
      });

      if (sortedPushes.length === 0) {
        console.log("No due adaptive pushes");
        return;
      }

      let deliveredCount = 0;

      // Load VAPID keys
      const vapidPublicKeyValue = vapidPublicKey.value();
      const vapidPrivateKeyValue = vapidPrivateKey.value();
      const vapidSubjectValue = vapidSubject.value() || "mailto:admin@cosmiq.quest";

      const webpush = require("web-push");
      if (vapidPublicKeyValue && vapidPrivateKeyValue) {
        webpush.setVapidDetails(vapidSubjectValue, vapidPublicKeyValue, vapidPrivateKeyValue);
      }

      for (const pushDoc of sortedPushes) {
        try {
          const push = pushDoc.data();
          if (!push.user_id) {
            console.error(`Adaptive push ${pushDoc.id} missing user_id`);
            continue;
          }

          // Check rate limits: max 1 per day, max 5 per week
          const dailyCountSnapshot = await db
            .collection("adaptive_push_queue")
            .where("user_id", "==", push.user_id)
            .where("delivered", "==", true)
            .where("created_at", ">=", oneDayAgo)
            .get();

          if (dailyCountSnapshot.size >= 1) {
            console.log(`User ${push.user_id} hit daily limit, skipping`);
            continue;
          }

          const weeklyCountSnapshot = await db
            .collection("adaptive_push_queue")
            .where("user_id", "==", push.user_id)
            .where("delivered", "==", true)
            .where("created_at", ">=", sevenDaysAgo)
            .get();

          if (weeklyCountSnapshot.size >= 5) {
            console.log(`User ${push.user_id} hit weekly limit, skipping`);
            continue;
          }

          // Send push notification (get subscriptions and send)
          const subscriptionsSnapshot = await db
            .collection("push_subscriptions")
            .where("user_id", "==", push.user_id)
            .get();
          
          // Also check userId field if no results (for compatibility with frontend naming)
          let subscriptions = subscriptionsSnapshot.docs;
          if (subscriptions.length === 0) {
            const userIdSnapshot = await db
              .collection("push_subscriptions")
              .where("userId", "==", push.user_id)
              .get();
            subscriptions = userIdSnapshot.docs;
          }

          let pushSent = false;
          if (subscriptions.length > 0 && vapidPublicKeyValue && vapidPrivateKeyValue) {
            for (const subDoc of subscriptions) {
              const sub = subDoc.data();
              if (sub.platform === "web" && sub.endpoint && sub.p256dh && sub.auth) {
                try {
                  await webpush.sendNotification(
                    {
                      endpoint: sub.endpoint,
                      keys: { p256dh: sub.p256dh, auth: sub.auth },
                    },
                    JSON.stringify({
                      title: push.title || "Adaptive Push",
                      body: push.message || "",
                      icon: "/icon-192.png",
                      data: { type: "adaptive_push", ...push.data },
                    })
                  );
                  pushSent = true;
                } catch (error: any) {
                  if (error.statusCode === 410) {
                    await subDoc.ref.delete();
                  }
                  console.error(`Web push error:`, error);
                }
              }
            }
          }

          // Mark as delivered (always mark, even if no subscriptions, to prevent retries)
          await pushDoc.ref.update({
            delivered: true,
            delivered_at: admin.firestore.FieldValue.serverTimestamp(),
          });

          if (pushSent) {
            console.log(`Delivered adaptive push to user ${push.user_id}: ${push.message}`);
            deliveredCount++;
          } else if (subscriptions.length === 0) {
            // No subscriptions but marked as delivered
            console.log(`Adaptive push ${pushDoc.id} marked as delivered (no subscriptions for user ${push.user_id})`);
            deliveredCount++;
          }
        } catch (error) {
          console.error(`Error processing adaptive push ${pushDoc.id}:`, error);
        }
      }

      console.log(`Adaptive push delivery complete: ${deliveredCount} delivered`);
    } catch (error) {
      console.error("Error in adaptive push delivery:", error);
      throw error;
    }
  }
);

/**
 * Trigger adaptive event - Callable function to trigger adaptive push based on event
 */
export const triggerAdaptiveEvent = onCall(
  {
    secrets: [geminiApiKey],
  },
  async (request: CallableRequest<{
    eventType: "low_motivation" | "overthinking" | "heartbreak_spike" | "return_after_break";
  }>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const { eventType } = request.data;

    if (!eventType) {
      throw new HttpsError("invalid-argument", "Missing eventType");
    }

    try {
      const userId = request.auth.uid;
      const db = admin.firestore();

      // Check rate limits
      const oneDayAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const dailyCountSnapshot = await db
        .collection("adaptive_push_queue")
        .where("user_id", "==", userId)
        .where("delivered", "==", true)
        .where("created_at", ">=", oneDayAgo)
        .get();

      if (dailyCountSnapshot.size >= 1) {
        throw new HttpsError("resource-exhausted", "Daily limit reached");
      }

      const weeklyCountSnapshot = await db
        .collection("adaptive_push_queue")
        .where("user_id", "==", userId)
        .where("delivered", "==", true)
        .where("created_at", ">=", sevenDaysAgo)
        .get();
      
      let weeklyCount = weeklyCountSnapshot.size;
      if (weeklyCount === 0) {
        const userIdCountSnapshot = await db
          .collection("adaptive_push_queue")
          .where("userId", "==", userId)
          .where("delivered", "==", true)
          .where("created_at", ">=", sevenDaysAgo)
          .get();
        weeklyCount = userIdCountSnapshot.size;
      }

      if (weeklyCount >= 5) {
        throw new HttpsError("resource-exhausted", "Weekly limit reached");
      }

      // Get user settings (check both user_id and userId fields for compatibility)
      let settingsDoc = await db
        .collection("adaptive_push_settings")
        .where("user_id", "==", userId)
        .where("enabled", "==", true)
        .limit(1)
        .get();

      if (settingsDoc.empty) {
        // Try userId field as fallback
        settingsDoc = await db
          .collection("adaptive_push_settings")
          .where("userId", "==", userId)
          .where("enabled", "==", true)
          .limit(1)
          .get();
      }

      if (settingsDoc.empty) {
        throw new HttpsError("failed-precondition", "Adaptive pushes not enabled");
      }

      // Map event to category
      const eventCategoryMap: Record<string, string> = {
        low_motivation: "confidence",
        overthinking: "calm",
        heartbreak_spike: "love",
        return_after_break: "discipline",
      };

      const chosenCategory = eventCategoryMap[eventType] || "discipline";

      // Generate adaptive push message using AI
      const apiKey = geminiApiKey.value();
      const prompt = `Generate a brief, supportive push notification message for a user experiencing: ${eventType}. Category: ${chosenCategory}. Keep it under 100 characters.`;

      const geminiResponse = await callGemini(prompt, "You are a supportive mentor.", {
        maxOutputTokens: 100,
      }, apiKey);

      // Schedule the push for immediate delivery (or very soon)
      const scheduledFor = admin.firestore.Timestamp.now();
      await db.collection("adaptive_push_queue").add({
        user_id: userId,
        message: geminiResponse.text.trim(),
        event_type: eventType,
        category: chosenCategory,
        scheduled_for: scheduledFor,
        delivered: false,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, message: "Adaptive push scheduled" };
    } catch (error) {
      console.error("Error in triggerAdaptiveEvent:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to trigger adaptive event");
    }
  }
);

/**
 * Scheduled function: Check task reminders (runs every minute)
 * Sends reminders for tasks that are about to start
 */
export const scheduledCheckTaskReminders = onSchedule(
  {
    schedule: "* * * * *", // Every minute
    timeZone: "UTC",
    secrets: [apnsKeyId, apnsTeamId, apnsBundleId, apnsAuthKey, apnsEnvironment],
  },
  async () => {
    console.log("Checking for tasks needing reminders...");

    try {
      const db = admin.firestore();
      const now = new Date();
      const today = now.toISOString().split("T")[0];

      // Get tasks with reminders enabled that haven't been sent
      // Note: Multiple where clauses may need composite index
      // Filter by task_date in memory if index doesn't exist
      const tasksSnapshot = await db
        .collection("daily_tasks")
        .where("reminder_enabled", "==", true)
        .where("reminder_sent", "==", false)
        .where("completed", "==", false)
        .limit(500) // Get more, filter by date in memory
        .get();
      
      // Filter by today's date in memory (handles Date, Timestamp, or string)
      const todayTasks = tasksSnapshot.docs.filter(doc => {
        const taskDate = doc.data().task_date;
        if (!taskDate) return false;
        if (taskDate.toDate) return taskDate.toDate().toISOString().split("T")[0] === today;
        if (taskDate instanceof Date) return taskDate.toISOString().split("T")[0] === today;
        return taskDate === today || taskDate.split("T")[0] === today;
      });

      console.log(`Found ${todayTasks.length} tasks to check for today`);

      const tasksToRemind: Array<{ id: string; data: any }> = [];

      // Filter tasks where reminder time is within 30 seconds of now
      for (const taskDoc of todayTasks) {
        const task = taskDoc.data();
        if (!task.scheduled_time || !task.reminder_minutes_before) continue;
        
        // Handle task_date as Date, Timestamp, or string
        let taskDateStr = today;
        if (task.task_date) {
          if (task.task_date.toDate) {
            taskDateStr = task.task_date.toDate().toISOString().split("T")[0];
          } else if (task.task_date instanceof Date) {
            taskDateStr = task.task_date.toISOString().split("T")[0];
          } else {
            taskDateStr = task.task_date.split("T")[0];
          }
        }

        const scheduledDateTime = new Date(`${taskDateStr}T${task.scheduled_time}`);
        const reminderTime = new Date(
          scheduledDateTime.getTime() - (task.reminder_minutes_before as number) * 60 * 1000
        );

        const timeDiff = reminderTime.getTime() - now.getTime();
        if (timeDiff >= -30000 && timeDiff <= 30000) {
          tasksToRemind.push({ id: taskDoc.id, data: task });
        }
      }

      console.log(`Sending reminders for ${tasksToRemind.length} tasks`);

      for (const { id, data: task } of tasksToRemind) {
        try {
          if (!task.user_id) {
            console.error(`Task ${id} missing user_id`);
            continue;
          }

          // Get user's iOS push subscriptions (iOS tokens are in push_subscriptions with platform=ios)
          // Check both user_id and userId fields for compatibility
          const iosSubscriptionsSnapshot = await db
            .collection("push_subscriptions")
            .where("user_id", "==", task.user_id)
            .where("platform", "==", "ios")
            .get();
          
          let iosSubscriptions = iosSubscriptionsSnapshot.docs;
          if (iosSubscriptions.length === 0) {
            const userIdSnapshot = await db
              .collection("push_subscriptions")
              .where("userId", "==", task.user_id)
              .where("platform", "==", "ios")
              .get();
            iosSubscriptions = userIdSnapshot.docs;
          }

          if (iosSubscriptions.length === 0) {
            console.log(`No iOS subscriptions for user ${task.user_id}`);
            // Mark reminder as sent anyway (user has no devices registered)
            await db.collection("daily_tasks").doc(id).update({
              reminder_sent: true,
            });
            continue;
          }

          // Send APNs notifications
          let reminderSent = false;
          const apnsKeyIdValue = apnsKeyId.value();
          const apnsTeamIdValue = apnsTeamId.value();
          const apnsBundleIdValue = apnsBundleId.value();
          const apnsKeyValue = apnsAuthKey.value();
          const apnsEnvironmentValue = apnsEnvironment.value() || "production";

          if (!apnsKeyIdValue || !apnsTeamIdValue || !apnsBundleIdValue || !apnsKeyValue) {
            console.error("APNs not configured, skipping task reminders");
            continue;
          }

          for (const subDoc of iosSubscriptions) {
            const sub = subDoc.data();
            // iOS tokens are stored in endpoint field
            const deviceToken = sub.endpoint || sub.device_token;
            if (!deviceToken) {
              console.log(`iOS subscription ${subDoc.id} missing device token`);
              continue;
            }

            try {
              const jwt = await generateAPNsJWT(apnsKeyIdValue, apnsTeamIdValue, apnsKeyValue);
              const apnsHost = apnsEnvironmentValue === "production" 
                ? "api.push.apple.com" 
                : "api.sandbox.push.apple.com";
              const apnsUrl = `https://${apnsHost}/3/device/${deviceToken}`;

              const apnsPayload = {
                aps: {
                  alert: {
                    title: `Task Reminder: ${task.title || "Task"}`,
                    body: task.scheduled_time 
                      ? `Your task is scheduled for ${task.scheduled_time}`
                      : "Don't forget your task!",
                  },
                  sound: "default",
                  badge: 1,
                },
                type: "task_reminder",
                task_id: id,
                task_date: task.task_date,
              };

              const apnsResponse = await fetch(apnsUrl, {
                method: "POST",
                headers: {
                  authorization: `bearer ${jwt}`,
                  "apns-topic": apnsBundleIdValue,
                  "apns-push-type": "alert",
                  "apns-priority": "10",
                  "content-type": "application/json",
                },
                body: JSON.stringify(apnsPayload),
              });

              if (!apnsResponse.ok) {
                const errorText = await apnsResponse.text();
                if (apnsResponse.status === 410 || apnsResponse.status === 404) {
                  // Token invalid, delete subscription
                  await subDoc.ref.delete();
                  console.log(`Deleted invalid iOS subscription ${subDoc.id}`);
                } else {
                  console.error(`APNs error for task reminder ${subDoc.id}: ${apnsResponse.status} ${errorText}`);
                }
              } else {
                reminderSent = true;
              }
            } catch (error) {
              console.error(`Error sending APNs for subscription ${subDoc.id}:`, error);
            }
          }

          // Mark reminder as sent if at least one notification was sent
          if (reminderSent || iosSubscriptions.length === 0) {
            await db.collection("daily_tasks").doc(id).update({
              reminder_sent: true,
            });
            console.log(`Sent reminder for task ${id} to user ${task.user_id}`);
          }
        } catch (error) {
          console.error(`Error sending reminder for task ${id}:`, error);
        }
      }
    } catch (error) {
      console.error("Error in check-task-reminders:", error);
      throw error;
    }
  }
);