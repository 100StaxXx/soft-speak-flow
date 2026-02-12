import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calculateBondLevel, calculateEnergyCost, calculateStats } from "../_shared/cardMath.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      spiritAnimal,
      element,
      stage,
      favoriteColor,
      eyeColor,
      furColor,
      mind = 50,
      body = 50,
      soul = 50,
      customName,
    } = await req.json();

    console.log("Generating sample card:", { spiritAnimal, element, stage, mind, body, soul });

    // Step 1: Generate companion image - call with user's auth token
    const imageResponse = await fetch(
      `${supabaseUrl}/functions/v1/generate-companion-image`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ spiritAnimal, element, stage, favoriteColor, eyeColor, furColor }),
      }
    );

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error("Image generation failed:", errorText);
      throw new Error(`Image generation failed: ${imageResponse.status}`);
    }

    const imageData = await imageResponse.json();

    const imageUrl = imageData?.imageUrl;
    console.log("Image generated:", imageUrl ? "success" : "no URL");

    // Step 2: Calculate stats
    // Convert legacy mind/body/soul (0-100) to new 6-stat system (0-1000)
    const userStats = {
      wisdom: mind * 10,
      creativity: mind * 10,
      vitality: body * 10,
      discipline: body * 10,
      resolve: soul * 10,
      alignment: soul * 10,
    };
    const stats = calculateStats(stage, userStats);
    const energyCost = calculateEnergyCost(stage);
    const bondLevel = calculateBondLevel(stage, userStats);

    // Step 3: Determine rarity
    let rarity = "Common";
    if (stage >= 19) rarity = "Origin";
    else if (stage >= 16) rarity = "Primal";
    else if (stage >= 13) rarity = "Celestial";
    else if (stage >= 10) rarity = "Mythic";
    else if (stage >= 7) rarity = "Legendary";
    else if (stage >= 4) rarity = "Epic";
    else if (stage >= 1) rarity = "Rare";

    // Step 4: Generate card content via AI
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const personality =
      body > 60 ? "powerful and energetic" :
      mind > 60 ? "wise and focused" :
      soul > 60 ? "compassionate and deeply connected" : "mysterious and evolving";

    const vibes =
      stage >= 15 ? "ancient, radiant, transcendent" :
      stage >= 10 ? "majestic, powerful, legendary" :
      stage >= 5 ? "fierce, loyal, determined" : "curious, cute, eager";

    let cardData;

    if (stage === 20 && !customName) {
      // Stage 20 special: Generate ultimate title
      const powerTitles = ["Sovereign", "Apex", "Colossus", "Warlord", "Primeborn", "Overlord", "Sentinel", "Emperor", "Archon", "Omega"];
      const randomTitle = powerTitles[Math.floor(Math.random() * powerTitles.length)];
      const creatureName = `${element} ${randomTitle} ${spiritAnimal}`;

      cardData = {
        creature_name: creatureName,
        traits: ["Ultimate Power", "Legendary Presence", "Peak Evolution", "Unstoppable Force", "Eternal Bond"],
        story_text: `At the pinnacle of evolution, ${creatureName} stands as the ultimate manifestation of power and bond. This legendary ${spiritAnimal} has transcended all limits, becoming a force of nature itself. The ${element.toLowerCase()} energy that flows through them is unmatched, a testament to the countless battles fought and lessons learned throughout their journey.\n\nTheir bond with their companion has reached its absolute peak, creating a connection that goes beyond the physical realm. Every action, every thought, perfectly synchronized. They are no longer just partners—they are one.`,
        lore_seed: `Legends speak of ${creatureName} as the harbinger of a new era, where the boundaries between companion and master dissolve into pure unity.`,
      };
    } else {
      // Generate via AI
      const aiPrompt = customName
        ? `You are a master storyteller creating a legend for a companion creature named "${customName}".

CREATURE ATTRIBUTES:
- Name: ${customName} (DO NOT CHANGE THIS)
- Species: ${spiritAnimal}
- Element: ${element}
- Evolution Stage: ${stage}/20
- Rarity: ${rarity}
- Personality: ${personality}
- Vibes: ${vibes}

Generate a card with these exact fields in JSON:
{
  "creature_name": "${customName}",
  "traits": ["3-5 dynamic trait names reflecting abilities at stage ${stage}"],
  "story_text": "2-4 paragraphs describing ${customName}'s legend and power. Make it epic.",
  "lore_seed": "One mysterious sentence about ${customName}'s destiny"
}`
        : `You are a master fantasy creature naming expert. Generate a UNIQUE, ORIGINAL creature name.

CREATURE ATTRIBUTES:
- Species: ${spiritAnimal}
- Element: ${element}
- Primary Color: ${favoriteColor}
- Personality: ${personality}
- Vibes: ${vibes}
- Evolution Stage: ${stage}/20
- Rarity: ${rarity}

NAME GENERATION RULES:
• 1-2 words maximum
• Mythic, elegant, otherworldly
• Easy to pronounce
• NO references to Pokémon, Digimon, Marvel, Warcraft
• NO real-world names or numbers
• Must feel ORIGINAL

Generate a card with these exact fields in JSON:
{
  "creature_name": "A unique name following rules above",
  "traits": ["3-5 dynamic trait names for stage ${stage}"],
  "story_text": "2-4 paragraphs for this creature's origin story",
  "lore_seed": "One mysterious sentence hinting at destiny"
}`;

      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a creative card game designer. Always respond with valid JSON only." },
            { role: "user", content: aiPrompt },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI response error:", errText);
        throw new Error(`AI generation failed: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices[0].message.content;

      // Parse JSON
      try {
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
        const jsonString = jsonMatch ? jsonMatch[1] : content;
        cardData = JSON.parse(jsonString);
      } catch (e) {
        console.error("Failed to parse AI response:", content);
        throw new Error("AI response was not valid JSON");
      }
    }

    // Generate a sample card ID
    const randomHex = crypto.randomUUID().split("-")[0].toUpperCase();
    const cardId = `SAMPLE-${spiritAnimal.toUpperCase()}-E${stage}-${randomHex}`;

    const result = {
      id: cardId,
      card_id: cardId,
      creature_name: cardData.creature_name,
      species: spiritAnimal,
      element: element,
      evolution_stage: stage,
      rarity: rarity,
      stats: stats,
      energy_cost: energyCost,
      bond_level: bondLevel,
      traits: cardData.traits,
      story_text: cardData.story_text,
      lore_seed: cardData.lore_seed,
      image_url: imageUrl,
      frame_type: `${element.toLowerCase()}-frame`,
    };

    console.log("Sample card generated:", cardId);

    return new Response(JSON.stringify({ card: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-sample-card:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
