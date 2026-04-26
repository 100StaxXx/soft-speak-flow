import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calculateBondLevel, calculateEnergyCost, normalizeStats } from "../_shared/cardMath.ts";
import {
  buildSpiritLockPromptBlock,
  buildSpiritLockRetryFeedback,
  evaluateSpiritLockTextCompliance,
  resolveCompanionSpiritLockProfile,
} from "../_shared/companionSpiritLock.ts";
import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from "../_shared/rateLimiter.ts";
import { cacheGeneratedCompanionNameIfUncustomized } from "./nameCache.ts";
import {
  getCompanionEvolutionCardRarity,
  MAX_COMPANION_STAGE,
} from "../../../src/config/companionCatalog.ts";
import {
  isAssignedCompanionName,
  normalizeCompanionName,
  synthesizeAssignedCompanionName,
} from "../../../src/lib/companionNameIdentity.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EvolutionCardContent = {
  creature_name: string;
  traits: string[];
  story_text: string;
  lore_seed: string;
};

const buildMechanicalCardFallback = (
  creatureName: string,
  stage: number,
  species: string,
  element: string,
): EvolutionCardContent => ({
  creature_name: creatureName,
  traits: [
    "Metallic Scale Plating",
    "Articulated Joint Matrix",
    "Clockwork Gear Halo",
    "Engineered Energy Core",
    `Stage ${stage} Precision Protocol`,
  ],
  story_text: `${creatureName} enters stage ${stage} with metallic scales and articulated joints tuned for higher output. \
Clockwork gears cycle in precise rhythm while the engineered energy core channels ${element.toLowerCase()} power through reinforced alloy channels.\n\n\
Every movement is refined for control and force, proving this ${species} remains a fully mechanical guardian as it evolves.`,
  lore_seed: `${creatureName}'s core reactor records a hidden protocol that awakens only when its gear lattice reaches perfect resonance.`,
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
    );

    const authHeader = req.headers.get('Authorization');
    const apiKey = req.headers.get('apikey');
    let authUserId: string | null = null;
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '')
      : null;

    if (bearerToken) {
      const { data: { user } } = await supabaseClient.auth.getUser(bearerToken);
      authUserId = user?.id ?? null;
    }

    const isServiceRoleCall =
      authHeader === serviceRoleKey
      || bearerToken === serviceRoleKey
      || apiKey === serviceRoleKey;
    if (!authUserId && !isServiceRoleCall) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { 
      companionId, 
      evolutionId, 
      stage, 
      species: requestedSpecies, 
      element: requestedElement, 
      color: requestedColor,
      userAttributes // vitality, wisdom, discipline, resolve, creativity, alignment
    } = await req.json();

    const { data: companionRecord, error: companionError } = await supabaseClient
      .from('user_companion')
      .select('id, user_id, preset_id, spirit_animal, core_element, favorite_color')
      .eq('id', companionId)
      .maybeSingle();

    if (companionError || !companionRecord) {
      return new Response(JSON.stringify({ error: 'Companion not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isServiceRoleCall && companionRecord.user_id !== authUserId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: evolutionRecord, error: evolutionError } = await supabaseClient
      .from('companion_evolutions')
      .select('id, companion_id, stage')
      .eq('id', evolutionId)
      .maybeSingle();

    if (evolutionError || !evolutionRecord || evolutionRecord.companion_id !== companionId) {
      return new Response(JSON.stringify({ error: 'Evolution not found for companion' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (typeof stage === 'number' && evolutionRecord.stage !== stage) {
      return new Response(JSON.stringify({ error: 'Evolution stage mismatch' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user = { id: companionRecord.user_id };
    const resolvedSpecies = companionRecord.spirit_animal || requestedSpecies;
    const resolvedElement = companionRecord.core_element || requestedElement;
    const resolvedColor = companionRecord.favorite_color || requestedColor;
    const species = resolvedSpecies;
    const element = resolvedElement;
    const color = resolvedColor;
    const companionIdentity = {
      spiritAnimal: species,
      presetId: companionRecord.preset_id,
    };

    const rateLimit = await checkRateLimit(
      supabaseClient,
      user.id,
      'generate-evolution-card',
      RATE_LIMITS['evolution-card'],
    );

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit, corsHeaders);
    }

    console.log('Generating evolution card for:', { companionId, evolutionId, stage, species: resolvedSpecies, element: resolvedElement });

    // Check if this companion already has cards with a name (to maintain consistency)
    const { data: existingCards } = await supabaseClient
      .from('companion_evolution_cards')
      .select('creature_name')
      .eq('companion_id', companionId)
      .order('evolution_stage', { ascending: true })
      .limit(1);

    const existingName = existingCards && existingCards.length > 0
      && isAssignedCompanionName(existingCards[0].creature_name, companionIdentity)
      ? existingCards[0].creature_name
      : null;
    console.log('Existing creature name:', existingName);

    // Generate card ID
    const randomHex = crypto.randomUUID().split('-')[0].toUpperCase();
    const cardId = `ALP-${species.toUpperCase()}-${user.id.split('-')[0].toUpperCase()}-E${stage}-${randomHex}`;

    const rarity = getCompanionEvolutionCardRarity(stage);

    const stats = normalizeStats(userAttributes ?? {});
    const energyCost = calculateEnergyCost(stage);

    // Generate frame type based on element
    const frameType = `${element.toLowerCase()}-frame`;

    // Use OpenAI to generate creature name, traits, story, and lore seed
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const powerScore = stats.vitality + stats.discipline;
    const insightScore = stats.wisdom + stats.creativity;
    const spiritScore = stats.resolve + stats.alignment;

    const personality = powerScore >= insightScore && powerScore >= spiritScore
      ? 'powerful and disciplined'
      : insightScore >= spiritScore
        ? 'wise and imaginative'
        : 'steadfast and deeply aligned';
    
    const vibes = stage >= 11 ? 'ancient, radiant, transcendent' :
                 stage >= 7 ? 'majestic, powerful, legendary' :
                 stage >= 4 ? 'fierce, loyal, determined' :
                 'curious, cute, eager';
    const spiritLockProfile = resolveCompanionSpiritLockProfile(species);
    const spiritLockPromptBlock = spiritLockProfile
      ? buildSpiritLockPromptBlock(spiritLockProfile, "card")
      : null;

    console.log("[SpiritLock]", {
      species,
      profile_match: spiritLockProfile?.id ?? null,
      function: "generate-evolution-card",
    });

    // Final-stage special: generate a personalized ultimate title
    let finalCreatureName = existingName;
    let skipAI = false;
    
    if (stage === MAX_COMPANION_STAGE && !existingName) {
      finalCreatureName = synthesizeAssignedCompanionName(
        `${companionId}:${user.id}:${stage}:final-stage`,
        element,
        companionIdentity,
      );
      skipAI = true;
      console.log('Generated final-stage ultimate title:', finalCreatureName);
    }

    let aiPrompt;
    
    if (existingName) {
      // Use existing name and generate story for evolution
      aiPrompt = `You are a master storyteller continuing the legend of a companion creature named "${existingName}".

CREATURE ATTRIBUTES:
- Name: ${existingName} (DO NOT CHANGE THIS)
- Species: ${species}
- Element: ${element}
- Evolution Stage: ${stage}/${MAX_COMPANION_STAGE} (evolved from stage ${stage - 1})
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
      if (spiritLockPromptBlock) {
        aiPrompt = `${aiPrompt}\n\n${spiritLockPromptBlock}\n\nCRITICAL: Use explicitly mechanical descriptions only.`;
      }
    } else {
      // First evolution - generate a new name
      aiPrompt = `You are a master fantasy creature naming expert. Generate a UNIQUE, ORIGINAL creature name for this companion's FIRST evolution.

CREATURE ATTRIBUTES:
- Species: ${species}
- Element: ${element}
- Primary Color: ${color}
- Secondary Color: ${element} undertones
- Personality: ${personality}
- Vibes: ${vibes}
- Evolution Stage: ${stage}/${MAX_COMPANION_STAGE}
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
      if (spiritLockPromptBlock) {
        aiPrompt = `${aiPrompt}\n\n${spiritLockPromptBlock}\n\nCRITICAL: Use explicitly mechanical descriptions only.`;
      }
    }

    let cardData;
    
    if (skipAI) {
      // For the final stage, use the pre-generated title
      cardData = {
        creature_name: finalCreatureName,
        traits: ['Ultimate Power', 'Legendary Presence', 'Peak Evolution', 'Unstoppable Force', 'Eternal Bond'],
        story_text: `At the pinnacle of evolution, ${finalCreatureName} stands as the ultimate manifestation of power and bond. This legendary ${species} has transcended all limits, becoming a force of nature itself. The ${element.toLowerCase()} energy that flows through them is unmatched, a testament to the countless battles fought and lessons learned throughout their journey.\n\nTheir bond with their companion has reached its absolute peak, creating a connection that goes beyond the physical realm. Every action, every thought, perfectly synchronized. They are no longer just partners—they are one.\n\nThe world trembles at the mere presence of ${finalCreatureName}, not out of fear, but in awe of what dedication and perseverance can achieve. This is the ultimate form—the peak of all possibilities.`,
        lore_seed: `Legends speak of ${finalCreatureName} as the harbinger of a new era, where the boundaries between companion and master dissolve into pure unity.`
      };
      console.log('Using pre-generated final-stage card data');
    } else {
      const generateCardDataFromPrompt = async (prompt: string): Promise<EvolutionCardContent> => {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a creative card game designer. Always respond with valid JSON only.' },
              { role: 'user', content: prompt },
            ],
          }),
        });

        if (!aiResponse.ok) {
          throw new Error(`AI generation failed: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;
        if (typeof content !== "string" || content.trim().length === 0) {
          throw new Error("AI response was empty");
        }

        try {
          let jsonString = content;

          const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (codeBlockMatch) {
            jsonString = codeBlockMatch[1];
          }

          const jsonObjectMatch = jsonString.match(/\{[\s\S]*\}/);
          if (jsonObjectMatch) {
            jsonString = jsonObjectMatch[0];
          }

          jsonString = jsonString.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match: string) => {
            return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
          });

          return JSON.parse(jsonString) as EvolutionCardContent;
        } catch (error) {
          console.error('Failed to parse AI response:', content);
          console.error('Parse error:', error);
          throw new Error('AI response was not valid JSON');
        }
      };

      cardData = await generateCardDataFromPrompt(aiPrompt);

      if (spiritLockProfile) {
        const contentForCompliance = [
          ...(Array.isArray(cardData?.traits) ? cardData.traits : []),
          cardData?.story_text ?? "",
          cardData?.lore_seed ?? "",
        ].join(" ");

        let compliance = evaluateSpiritLockTextCompliance(contentForCompliance, spiritLockProfile);
        console.log("[SpiritLock]", {
          species,
          profile_match: spiritLockProfile.id,
          function: "generate-evolution-card",
          phase: "first_pass",
          compliant: compliance.isCompliant,
          violations: compliance.violations,
        });

        if (!compliance.isCompliant) {
          const retryPrompt = `${aiPrompt}\n\n${buildSpiritLockRetryFeedback(spiritLockProfile, compliance)}`;
          console.log("[SpiritLock]", {
            species,
            profile_match: spiritLockProfile.id,
            function: "generate-evolution-card",
            phase: "retry_start",
          });

          try {
            const retriedCardData = await generateCardDataFromPrompt(retryPrompt);
            const retryContent = [
              ...(Array.isArray(retriedCardData?.traits) ? retriedCardData.traits : []),
              retriedCardData?.story_text ?? "",
              retriedCardData?.lore_seed ?? "",
            ].join(" ");
            compliance = evaluateSpiritLockTextCompliance(retryContent, spiritLockProfile);

            console.log("[SpiritLock]", {
              species,
              profile_match: spiritLockProfile.id,
              function: "generate-evolution-card",
              phase: "retry_result",
              compliant: compliance.isCompliant,
              violations: compliance.violations,
            });

            if (compliance.isCompliant) {
              cardData = retriedCardData;
            } else {
              const fallbackName = normalizeCompanionName(retriedCardData.creature_name)
                || normalizeCompanionName(existingName)
                || synthesizeAssignedCompanionName(
                  `${companionId}:${user.id}:${stage}:spirit-lock-fallback`,
                  element,
                  companionIdentity,
                );
              cardData = buildMechanicalCardFallback(fallbackName, stage, species, element);
            }
          } catch (retryError) {
            console.error("[SpiritLock] retry failed, using deterministic fallback", retryError);
            const fallbackName = normalizeCompanionName(cardData?.creature_name)
              || normalizeCompanionName(existingName)
              || synthesizeAssignedCompanionName(
                `${companionId}:${user.id}:${stage}:spirit-lock-fallback`,
                element,
                companionIdentity,
              );
            cardData = buildMechanicalCardFallback(fallbackName, stage, species, element);
          }
        }
      }
    }

    if (spiritLockProfile) {
      const finalCompliance = evaluateSpiritLockTextCompliance(
        [
          ...(Array.isArray(cardData?.traits) ? cardData.traits : []),
          cardData?.story_text ?? "",
          cardData?.lore_seed ?? "",
        ].join(" "),
        spiritLockProfile,
      );

      if (!finalCompliance.isCompliant) {
        console.log("[SpiritLock]", {
          species,
          profile_match: spiritLockProfile.id,
          function: "generate-evolution-card",
          phase: "final_guardrail_fallback",
          violations: finalCompliance.violations,
        });
        const fallbackName = normalizeCompanionName(cardData?.creature_name)
          || normalizeCompanionName(existingName)
          || synthesizeAssignedCompanionName(
            `${companionId}:${user.id}:${stage}:final-guardrail`,
            element,
            companionIdentity,
          );
        cardData = buildMechanicalCardFallback(fallbackName, stage, species, element);
      }
    }

    if (!isAssignedCompanionName(cardData?.creature_name, companionIdentity)) {
      const fallbackName = synthesizeAssignedCompanionName(
        `${companionId}:${user.id}:${stage}`,
        element,
        companionIdentity,
      );
      console.warn("Replacing invalid creature name with synthesized fallback", {
        invalidName: cardData?.creature_name ?? null,
        fallbackName,
        companionId,
        stage,
        species,
      });
      cardData.creature_name = fallbackName;
    }

    // Calculate bond level based on user attributes
    const bondLevel = calculateBondLevel(stage, stats);

    // Insert the card into database
    const { data: card, error: insertError } = await supabaseClient
      .from('companion_evolution_cards')
      .insert({
        card_id: cardId,
        user_id: user.id,
        companion_id: companionId,
        evolution_id: evolutionId,
        evolution_stage: stage,
        creature_name: cardData.creature_name,
        species: species,
        element: element,
        stats: stats,
        traits: cardData.traits,
        story_text: cardData.story_text,
        lore_seed: cardData.lore_seed,
        bond_level: bondLevel,
        rarity: rarity,
        frame_type: frameType,
        energy_cost: energyCost,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting card:', insertError);
      throw insertError;
    }

    try {
      await cacheGeneratedCompanionNameIfUncustomized({
        supabase: supabaseClient,
        companionId,
        creatureName: card?.creature_name ?? cardData.creature_name,
      });
    } catch (cacheError) {
      console.warn("Card generated but companion name cache update failed", {
        companionId,
        cardId,
        error: cacheError instanceof Error ? cacheError.message : String(cacheError),
      });
    }

    console.log('Card generated successfully:', cardId);

    return new Response(
      JSON.stringify({ card }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-evolution-card:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
