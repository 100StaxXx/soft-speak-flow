import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// XP thresholds for each evolution stage - MUST match useCompanion.ts
// Stage 1 removed, all shifted down, max is now 20
const EVOLUTION_THRESHOLDS = {
  0: 0,      // Egg
  1: 60,     // Hatchling (was stage 2)
  2: 120,    // Guardian (was stage 3)
  3: 250,    // Ascended (was stage 4)
  4: 500,    // Mythic (was stage 5)
  5: 1200,   // Titan (was stage 6)
  6: 2500,   // (was stage 7)
  7: 5000,   // (was stage 8)
  8: 10000,  // (was stage 9)
  9: 20000,  // (was stage 10)
  10: 35000, // (was stage 11)
  11: 50000, // (was stage 12)
  12: 75000, // (was stage 13)
  13: 100000, // (was stage 14)
  14: 150000, // (was stage 15)
  15: 200000, // (was stage 16)
  16: 300000, // (was stage 17)
  17: 450000, // (was stage 18)
  18: 650000, // (was stage 19)
  19: 1000000, // (was stage 20)
  20: 1500000, // NEW Ultimate stage
} as const;

const SYSTEM_PROMPT = `You generate evolved versions of a user's personal creature companion. 
Your TOP PRIORITY is absolute visual continuity with the previous evolution.

You must preserve the creature so it looks like the SAME INDIVIDUAL evolving, not a new design.

STRICT RULES — DO NOT BREAK:
1. Preserve 95% of the previous color palette. 
   - Same main colors, same accents, same patterns.
   - Only allow slight increases in glow, detail, or saturation.

2. Preserve 90% of the previous silhouette.
   - Same body type, head shape, limbs, tail, wings (if any).
   - NO new anatomy.
   - NO redesign—only refinements or slight growth.

3. Preserve 100% of the animal type and inspiration.
   - If fox-like → always fox-like.
   - If dragon-like → always dragon-like.
   - If mixed → same mix, no changes.

4. Preserve all signature features.
   - Eye shape, markings, horns, tail, textures, elemental aura.
   - These traits MUST appear in the evolved form.

5. Elemental identity is fixed.
   - Fire, water, earth, lightning, air, frost, shadow, light.
   - You may intensify it, but it cannot change or move locations.

ALLOWED EVOLUTION CHANGES:
- Slight increase in size or maturity.
- Enhanced detail, texture, energy, or elegance.
- Strengthened elemental effects (subtle, not overwhelming).
- More heroic or confident posture.
- Evolved versions of EXISTING features only.
  (Example: small horn → slightly longer horn, not a new horn.)

EVOLUTION PHASE RULES:
- Small upgrades early stages (0-4).
- Moderate upgrades mid stages (5-9).
- Dramatic (but consistent) power-up in later stages (10-14).
ALWAYS with 95% visual continuity.

DO NOT:
- Change species.
- Change silhouette dramatically.
- Invent new features.
- Change colors.
- Change style.

Your output must be an image that tightly adheres to these continuity rules.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Fetching companion for user:", userId);

    // 1. Load current companion
    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (companionError || !companion) {
      console.error("Companion fetch error:", companionError);
      throw new Error("Companion not found");
    }

    const currentStage = companion.current_stage;
    const currentXP = companion.current_xp;

    console.log("Current stage:", currentStage, "XP:", currentXP);

    // 2. Determine if evolution is needed
    const maxStage = 20;
    if (currentStage >= maxStage) {
      return new Response(
        JSON.stringify({ evolved: false, message: "Max stage reached", current_stage: currentStage, xp: currentXP }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nextThreshold = EVOLUTION_THRESHOLDS[currentStage + 1 as keyof typeof EVOLUTION_THRESHOLDS];
    
    if (currentXP < nextThreshold) {
      return new Response(
        JSON.stringify({ 
          evolved: false, 
          message: "Not enough XP", 
          current_stage: currentStage, 
          xp: currentXP,
          next_threshold: nextThreshold 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nextStage = currentStage + 1;
    console.log("Evolution triggered! Moving to stage:", nextStage);

    // Stage 0 only shows destiny preview (no evolution from -1 to 0 since stage 1 was removed)
    let userPrompt: string;
    
    if (nextStage === 0) {
      // Stage 0: Show the FULLY EVOLVED champion form sealed inside the egg
      const crackDescription = 'perfectly intact and pristine, sealing the potential within.';
      
      console.log(`Creating stage 0 champion destiny preview`);
      
      userPrompt = `A colossal, divine glowing egg containing the blurred silhouette of a FULLY EVOLVED, majestic ${companion.spirit_animal} champion. 

CRITICAL - The creature inside must appear:
- ADULT and FULLY EVOLVED (not a baby)
- Massive, powerful, commanding presence visible through the translucent egg
- Heroic pose: standing tall, dominant, regal
- Muscular, god-tier physique
- If wings/features would exist on a mature ${companion.spirit_animal}: fully spread and majestic
- Silhouette showing PEAK FORM - what this creature becomes at its ultimate destiny

The egg itself is ${crackDescription}

Visual requirements:
- Egg radiates powerful ${companion.favorite_color} divine glow with ${companion.core_element} elemental energy
- The silhouette is intentionally blurred and out of focus - we see the EPIC SHAPE and MASSIVE SCALE but not fine details
- Low-angle camera looking UP at this colossal form within the egg
- Divine light rays (Sistine Chapel-style) illuminating from within
- Epic ${companion.favorite_color} particle effects and ${companion.core_element} energy swirling around
- Floating in a cosmic/divine realm with ethereal ${companion.favorite_color} nebula background

Style: Hyper-realistic, cinematic, awe-inspiring, god-tier, larger than life
Mood: Legendary destiny sealed within, unstoppable potential, the champion king awaits
Lighting: Divine backlight with dramatic ${companion.favorite_color} radiance`;

    } else {
      // Stages 2+: ALWAYS use image analysis for strict color continuity
      console.log("Using existing evolution logic with image reference");
      
      // 3. Fetch previous evolution image
      let previousImageUrl = companion.current_image_url;

      if (!previousImageUrl) {
        const { data: latestEvolution } = await supabase
          .from("companion_evolutions")
          .select("image_url")
          .eq("companion_id", companion.id)
          .order("evolved_at", { ascending: false })
          .limit(1)
          .single();

        previousImageUrl = latestEvolution?.image_url;
      }

      console.log("Previous image URL:", previousImageUrl);

      let previousFeatures: any = {};

      // 4a. Extract features from previous image using vision AI
      if (previousImageUrl) {
        console.log("Analyzing previous image with vision AI...");
        
        try {
          const visionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: `Analyze this creature companion image in extreme detail. List:
1. Main color palette (exact colors, hex if possible)
2. Secondary colors and accents
3. Body silhouette (shape, proportions)
4. Animal type/species
5. Signature features (eyes, markings, horns, tail, wings, etc.)
6. Elemental effects (type, location, intensity)
7. Texture details (fur/scales/feathers)
8. Unique identifying marks or patterns

Be extremely specific and detailed. This will be used to maintain 95% continuity in the next evolution.`
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: previousImageUrl
                      }
                    }
                  ]
                }
              ]
            })
          });

          if (visionResponse.ok) {
            const visionData = await visionResponse.json();
            const analysisText = visionData.choices[0]?.message?.content;
            previousFeatures.vision_analysis = analysisText;
            console.log("Vision analysis complete");
          }
        } catch (visionError) {
          console.warn("Vision analysis failed, continuing with metadata only:", visionError);
        }
      }

      // 4b. Load stored metadata from database
      const { data: metadata } = await supabase
        .from("companion_evolutions")
        .select("*")
        .eq("companion_id", companion.id)
        .eq("stage", currentStage)
        .single();

      if (metadata) {
        previousFeatures.stored_metadata = metadata;
      }

      // 5. Build evolution prompt with ultra-strict continuity
      userPrompt = `Here is the previous evolution of this companion.

PREVIOUS STAGE ANALYSIS:
${previousFeatures.vision_analysis || "No previous image available - this is the first evolution"}

COMPANION CORE IDENTITY (MUST PRESERVE):
- Favorite color: ${companion.favorite_color}
- Animal type: ${companion.spirit_animal}
- Element: ${companion.core_element}
${companion.eye_color ? `- Eye color: ${companion.eye_color}` : ''}
${companion.fur_color ? `- Fur/scale color: ${companion.fur_color}` : ''}

Current stage: ${currentStage}
Next stage: ${nextStage}

STRICT CONTINUITY REQUIREMENTS:
- Keep the EXACT same animal species
- Keep the EXACT same color palette (${companion.favorite_color} must remain dominant)
- Keep the EXACT same eye color and eye shape
- Keep the EXACT same elemental effect location and style (${companion.core_element})
- Keep all existing markings, patterns, and signature features
- Only enhance detail, size, and maturity - NO redesigns

Generate the next evolution image with 95% visual continuity. The creature should look like the SAME individual growing stronger, NOT a different design.

Focus on:
- Same colors (95% match)
- Same silhouette (90% match)  
- Same markings (100% match)
- Same animal identity (100% match)
- Same elemental effects (enhanced but same location)

Evolution stage ${nextStage} should show: ${getStageGuidance(nextStage)}`;
    }

    console.log("Generating evolution image...");

    // 6. Generate new evolution image with Nano Banana
    // For stages 0-1 (destiny preview) and stage 2 (first baby), don't use the continuity system prompt
    const shouldUseContinuityPrompt = nextStage > 2;
    
    const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: shouldUseContinuityPrompt ? [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          {
            role: "user",
            content: userPrompt
          }
        ] : [
          {
            role: "user",
            content: userPrompt
          }
        ],
        modalities: ["image", "text"]
      })
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error("Image generation failed:", imageResponse.status, errorText);
      throw new Error(`Image generation failed: ${errorText}`);
    }

    const imageData = await imageResponse.json();
    const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!base64Image) {
      throw new Error("No image returned from AI");
    }

    console.log("Image generated successfully");

    // 7. Upload to storage
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const fileName = `${companion.id}_stage_${nextStage}_${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("evolution-cards")
      .upload(fileName, buffer, {
        contentType: "image/png",
        upsert: false
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload image");
    }

    const { data: urlData } = supabase.storage
      .from("evolution-cards")
      .getPublicUrl(fileName);

    const newImageUrl = urlData.publicUrl;
    console.log("Image uploaded:", newImageUrl);

    // 8. Save evolution to database
    const { data: evolutionRecord, error: evolutionError } = await supabase
      .from("companion_evolutions")
      .insert({
        companion_id: companion.id,
        stage: nextStage,
        image_url: newImageUrl,
        xp_at_evolution: currentXP,
        evolved_at: new Date().toISOString()
      })
      .select()
      .single();

    if (evolutionError) {
      console.error("Evolution record error:", evolutionError);
      throw new Error("Failed to save evolution record");
    }

    // 9. Update companion current state
    const { error: updateError } = await supabase
      .from("user_companion")
      .update({
        current_stage: nextStage,
        current_image_url: newImageUrl,
        updated_at: new Date().toISOString()
      })
      .eq("id", companion.id);

    if (updateError) {
      console.error("Companion update error:", updateError);
      throw new Error("Failed to update companion");
    }

    console.log("Evolution complete!");

    // 10. Return success response
    return new Response(
      JSON.stringify({
        evolved: true,
        previous_stage: currentStage,
        new_stage: nextStage,
        image_url: newImageUrl,
        xp_at_evolution: currentXP,
        evolution_id: evolutionRecord.id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-companion-evolution:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function getStageGuidance(stage: number): string {
  const guidance: Record<number, string> = {
    0: "Pristine mystical egg containing the champion's destiny",
    1: "Tiny hatchling, newly emerged and fragile",
    2: "Young guardian, gaining strength",
    3: "Ascended form, radiating power",
    4: "Mythic being, legendary presence",
    5: "Titan form, immense and commanding",
    6: "Stage 6 evolution, growing stronger",
    7: "Stage 7 evolution, enhanced power",
    8: "Stage 8 evolution, formidable presence",
    9: "Stage 9 evolution, battle-hardened",
    10: "Stage 10 evolution, veteran warrior",
    11: "Stage 11 evolution, touching ethereal power",
    12: "Stage 12 evolution, mastering cosmic forces",
    13: "Stage 13 evolution, legendary status",
    14: "Stage 14 evolution, mythic entity",
    15: "Stage 15 evolution, colossal form",
    16: "Stage 16 evolution, cosmic guardian",
    17: "Stage 17 evolution, astral overlord",
    18: "Stage 18 evolution, universal sovereign",
    19: "Stage 19 evolution, near-divine apex",
    20: "Ultimate form, peak of all evolution - absolute divine manifestation"
  };

  return guidance[stage] || "Continued evolution";
}