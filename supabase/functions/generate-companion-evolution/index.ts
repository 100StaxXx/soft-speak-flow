import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// XP thresholds for each evolution stage
const EVOLUTION_THRESHOLDS = [0, 20, 60, 120, 250, 500, 1200, 2000, 3500, 5500, 8000, 12000, 18000, 25000, 35000];

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
    if (currentStage >= EVOLUTION_THRESHOLDS.length - 1) {
      return new Response(
        JSON.stringify({ evolved: false, message: "Max stage reached", current_stage: currentStage, xp: currentXP }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nextThreshold = EVOLUTION_THRESHOLDS[currentStage + 1];
    
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
    const userPrompt = `Here is the previous evolution of this companion.

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

    console.log("Generating evolution image...");

    // 6. Generate new evolution image with Nano Banana
    const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
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
  const guidance = [
    "A tiny newborn form, just emerged, fragile but alive",
    "Small infant form, gaining stability",
    "Young creature, playful and growing",
    "Juvenile form with developing features",
    "Adolescent with strengthening presence",
    "Young adult, confident and capable",
    "Mature guardian, powerful and poised",
    "Seasoned protector, battle-tested",
    "Veteran form, wise and formidable",
    "Elevated being, touching ethereal power",
    "Ascended form, radiating mastery",
    "Legendary avatar, commanding presence",
    "Mythic entity, transcendent power",
    "Ultimate form, peak of evolution",
    "Divine manifestation, apex existence"
  ];

  return guidance[stage] || "Continued evolution";
}