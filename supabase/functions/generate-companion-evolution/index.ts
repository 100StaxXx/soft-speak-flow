import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, RATE_LIMITS, createRateLimitResponse } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Evolution thresholds are now loaded from database (single source of truth)
// No more hardcoded values!

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId } = await req.json();
    const resolvedUserId = userId ?? user.id;

    if (resolvedUserId !== user.id) {
      return new Response(
        JSON.stringify({ error: "User mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limiting check - evolution is expensive
    const rateLimit = await checkRateLimit(supabase, resolvedUserId, 'companion-evolution', RATE_LIMITS['companion-evolution']);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit, corsHeaders);
    }

    console.log("Fetching companion for user:", resolvedUserId);

    // 1. Load current companion
    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select("*")
      .eq("user_id", resolvedUserId)
      .maybeSingle();

    if (companionError) {
      console.error("Companion fetch error:", companionError);
      throw new Error(`Failed to fetch companion: ${companionError.message}`);
    }

    if (!companion) {
      console.error("No companion found for user:", resolvedUserId);
      throw new Error("Companion not found");
    }

    const currentStage = companion.current_stage;
    const currentXP = companion.current_xp;

    console.log("Current stage:", currentStage, "XP:", currentXP);

    // 2. Load evolution thresholds from database
    const { data: thresholds, error: thresholdsError } = await supabase
      .from("evolution_thresholds")
      .select("*")
      .order("stage", { ascending: true });

    if (thresholdsError || !thresholds) {
      console.error("Failed to load evolution thresholds:", thresholdsError);
      throw new Error("Evolution thresholds not available");
    }

    const maxStage = thresholds[thresholds.length - 1].stage;
    
    // 3. Determine if evolution is needed
    if (currentStage >= maxStage) {
      return new Response(
        JSON.stringify({ evolved: false, message: "Max stage reached", current_stage: currentStage, xp: currentXP }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nextThresholdData = thresholds.find(t => t.stage === currentStage + 1);
    if (!nextThresholdData) {
      throw new Error(`No threshold found for stage ${currentStage + 1}`);
    }

    const nextThreshold = nextThresholdData.xp_required;
    
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

    // Stage 0 = egg destiny preview, Stage 1 = hatchling emerging
    let userPrompt: string;
    
    if (nextStage === 0) {
      // Stage 0: Show the FULLY EVOLVED champion form sealed inside the egg
      const crackDescription = 'perfectly intact and pristine, sealing the potential within.';
      
      console.log(`Creating stage 0 champion destiny preview`);
      
      userPrompt = `PHOTOREAL EPIC FANTASY - Stage 0 Divine Egg:

SUBJECT: A monumental crystalline egg suspended in cosmic realm, containing the destiny of a legendary ${companion.spirit_animal} champion.

EGG CONSTRUCTION:
- Massive scale suggesting the colossal being within
- Semi-translucent opalescent shell with iridescent shimmer
- Crystalline structure with visible depth and refraction
- ${crackDescription}
- Surface catching and refracting divine light with realistic material physics
- Subsurface scattering showing thickness and translucency

CRITICAL SILHOUETTE WITHIN (MUST BE VISIBLE):
Through the mystical shell, a dark shadowy form of a FULLY EVOLVED ${companion.spirit_animal}:
- ADULT peak form at maximum power (Stage 15+ appearance)
- Anatomically correct ${companion.spirit_animal} silhouette showing proper proportions
- Heroic regal pose: standing tall, dominant, wings spread (if applicable), commanding stance
- Muscular god-tier physique visible in shadow form
- The outline suggests IMMENSE SIZE and MAJESTIC PRESENCE
- Shadow is intentionally blurred/out of focus - we see EPIC SHAPE not details
- This is what the creature will become at ultimate evolution
- Properly proportioned: correct limb structure, head size, body shape for mature ${companion.spirit_animal}

ELEMENTAL & COLOR:
- ${companion.core_element} energy radiating with realistic physics and particle effects
- Divine ${companion.favorite_color} glow pulsing rhythmically like a cosmic heartbeat
- Energy wisps and particles swirling with volumetric rendering
- Light bleeding through shell showing internal power

ENVIRONMENT & ATMOSPHERE:
- Floating in ethereal cosmic realm with ${companion.favorite_color} nebula clouds
- Distant stars and cosmic phenomena in background
- Divine volumetric god rays (Sistine Chapel-style) piercing through mystical atmosphere
- Atmospheric depth and scale perspective

COMPOSITION:
- Low-angle heroic shot looking UP at the colossal egg
- Dramatic perspective emphasizing scale and grandeur
- Cinematic depth of field with bokeh effects
- Rule of thirds composition with egg as dominant focal point

LIGHTING:
- Divine backlight creating rim glow around egg
- Dramatic ${companion.favorite_color} radiance from within
- Motivated light sources showing dimensional depth
- High contrast creating epic mood

STYLE & QUALITY:
- Hyper-realistic photoreal rendering (Unreal Engine 5 quality)
- Cinematic blockbuster VFX
- Awe-inspiring larger-than-life scale
- Professional concept art mastery
- 8K detail with perfect materials

MOOD: Legendary destiny sealed within, unstoppable divine potential, the champion awaits`;

    } else if (nextStage === 1) {
      // Stage 1: Hatchling emerging from the egg - NEW LIFE!
      console.log("Creating stage 1 hatchling emergence");
      
      // Special handling for aquatic creatures to prevent legs
      const aquaticCreatures = ['shark', 'whale', 'dolphin', 'fish', 'orca', 'manta ray', 'stingray', 'seahorse', 'jellyfish', 'octopus', 'squid'];
      const isAquatic = aquaticCreatures.some(creature => companion.spirit_animal.toLowerCase().includes(creature));
      const aquaticNote = isAquatic ? '\n\nCRITICAL AQUATIC ANATOMY:\n- This is a baby aquatic creature - NO LEGS OR LIMBS of any kind\n- Only fins, tail, and streamlined hydrodynamic body\n- Absolutely no legs, arms, feet, hands, or terrestrial limbs\n- Underwater environment with water physics and bubbles' : '';
      
      userPrompt = `PHOTOREAL CREATURE BIRTH - Stage 1 Hatchling:

SUBJECT: A tiny newborn baby ${companion.spirit_animal} at the sacred moment of hatching.

CREATURE DETAILS (ANATOMICALLY ACCURATE):
- Species: ${companion.spirit_animal} - perfect baby anatomy for this species
- Size: NEWBORN tiny scale - small, fragile, precious
- Proportions: Realistic hatchling proportions (large head-to-body ratio, short limbs, oversized features)
- Eyes: Big curious infant eyes with proper iris detail, light reflection, innocent wonder
- Body: Soft vulnerable form with visible baby features (chubby, round, delicate)
- Posture: Wobbly, uncertain stance - first moments discovering balance and movement
- Expression: Pure innocence and wonder, slightly confused but curious
- Still glistening wet from egg with subtle sheen${aquaticNote}

HATCHING SCENE:
- Broken eggshell pieces scattered around showing recent emergence
- Egg fragments still glowing with residual magical energy
- Some shells stuck to the hatchling's back/head (cute detail)
- Clear evidence this just happened - wet, fresh, brand new life

COLOR PALETTE (CRITICAL MATCH):
- Primary colors: ${companion.favorite_color} tones
- Animal species: ${companion.spirit_animal}
- Elemental affinity: ${companion.core_element}
${companion.eye_color ? `- Eye color: ${companion.eye_color} with infant brightness` : ''}
${companion.fur_color ? `- Fur/scales/feathers: ${companion.fur_color} with baby softness` : ''}

ELEMENTAL MANIFESTATION:
- Small delicate wisps of ${companion.core_element} elemental energy beginning to manifest
- Energy tentative and gentle, just awakening
- Soft ${companion.favorite_color} glow particles rising from the hatching
- Elemental aura flickering uncertainly like a candle flame

ENVIRONMENT:
- Mystical nursery realm with soft ethereal lighting
- Warm ambient ${companion.favorite_color} atmospheric glow
- Gentle floating particles and magical dust motes
- Soft ground with natural materials (moss, petals, soft earth, or water)
- Background slightly out of focus creating dreamy depth

LIGHTING:
- Warm soft key light from above (motherly protective feel)
- Gentle rim lighting defining the tiny form
- Glow from broken egg illuminating from below
- Subsurface scattering through delicate baby skin/scales
- Magical sparkle in eyes catching light

COMPOSITION:
- Eye-level perspective with the tiny hatchling (we see the world from its view)
- Shallow depth of field focusing on the baby creature
- Rule of thirds with creature slightly off-center
- Negative space emphasizing vulnerability and small scale
- Environmental elements framing the subject

STYLE & QUALITY:
- Photoreal rendering with tender softness
- Studio Ghibli emotional resonance meets fantasy realism
- Natural history photography precision
- Cinematic newborn portrait quality
- 8K detail showing every delicate feature

MOOD: Pure wonder, new beginning, innocent potential, sacred first breath, protective tenderness, hope incarnate`;
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
          .maybeSingle();

        previousImageUrl = latestEvolution?.image_url;
      }

      console.log("Previous image URL:", previousImageUrl);

      const previousFeatures: Record<string, unknown> = {};

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
      // Special handling for aquatic creatures to prevent legs
      const aquaticCreatures = ['shark', 'whale', 'dolphin', 'fish', 'orca', 'manta ray', 'stingray', 'seahorse', 'jellyfish', 'octopus', 'squid'];
      const isAquatic = aquaticCreatures.some(creature => companion.spirit_animal.toLowerCase().includes(creature));
      const aquaticNote = isAquatic ? '\n\nCRITICAL AQUATIC ANATOMY: This is an aquatic creature. NO LEGS OR LIMBS of any kind. Only fins, tail, and streamlined body. Absolutely no legs, arms, or terrestrial limbs. Maintain purely aquatic anatomy.' : '';
      
      userPrompt = `PHOTOREAL EVOLUTION CONTINUATION - Stage ${currentStage} to ${nextStage}:

=== PREVIOUS EVOLUTION ANALYSIS ===
${previousFeatures.vision_analysis || "No previous image available - using core identity as foundation"}

=== CORE IDENTITY (100% PRESERVATION REQUIRED) ===
THESE ARE ABSOLUTE UNCHANGEABLE FACTS ABOUT THIS CREATURE:
- Species: ${companion.spirit_animal}
- Primary Color Theme: ${companion.favorite_color}
- Elemental Affinity: ${companion.core_element}
${companion.eye_color ? `- Eye Color: ${companion.eye_color} (exact match required)` : ''}
${companion.fur_color ? `- Fur/Scale/Feather Color: ${companion.fur_color} (exact match required)` : ''}${aquaticNote}

=== EVOLUTION STAGE CONTEXT ===
- Previous Stage: ${currentStage}
- New Stage: ${nextStage}
- Evolution Theme: ${getStageGuidance(nextStage)}

=== CRITICAL CONTINUITY REQUIREMENTS (DO NOT BREAK) ===

1. SPECIES ANATOMY (100% PRESERVATION):
   - Maintain EXACT ${companion.spirit_animal} skeletal structure and proportions
   - Same bone structure, joint placement, limb configuration
   - Same facial structure, skull shape, feature placement
   - Same body type and natural physique for this species
   - NO species changes, NO hybrid features, NO anatomical redesigns

2. COLOR PALETTE (95% MATCH):
   - ${companion.favorite_color} MUST remain the dominant color
   - Exact same primary, secondary, and accent colors
   - Same color placement and distribution patterns
   - Same hue, saturation relationships
   - Only allow subtle increases in luminosity/glow intensity

3. FACIAL FEATURES (100% PRESERVATION):
   - EXACT same eye color (${companion.eye_color || companion.favorite_color})
   - Same eye shape, size, and placement
   - Same iris patterns and pupil shape
   - Same facial markings and patterns
   - Same expression capability and character

4. SIGNATURE MARKINGS (100% MATCH):
   - Every stripe, spot, pattern MUST be in exact same location
   - Same marking colors and contrast
   - Same pattern complexity and style
   - Markings can become more defined but NOT relocated or redesigned

5. ELEMENTAL EFFECTS (SAME LOCATION, ENHANCED INTENSITY):
   - ${companion.core_element} energy in EXACT same locations as previous stage
   - Same elemental manifestation style (aura/wisps/glow/particles)
   - Enhanced intensity and detail but same placement
   - Energy follows same anatomical contours

6. SIGNATURE FEATURES:
   - Same horns/antlers (if present) - location and base shape unchanged
   - Same wings (if present) - structure and attachment unchanged  
   - Same tail structure and length ratio
   - Same claws/talons - shape and configuration
   - Same unique identifying characteristics

=== ALLOWED EVOLUTION CHANGES ===
You MAY enhance these aspects while maintaining continuity:
- Size and scale increase (growth)
- Muscle definition and anatomical detail
- Texture quality and material rendering
- Pose confidence and dynamic energy
- Elemental effect intensity and particle count
- Environmental interaction scope
- Detail level and rendering quality
- Battle scars or experience marks that ADD to the design

=== EVOLUTION GENERATION INSTRUCTIONS ===

Create the Stage ${nextStage} evolution showing:
${getStageGuidance(nextStage)}

This creature MUST look like the SAME INDIVIDUAL growing more powerful.
Think: "This is my companion, my friend, more mature and stronger"
NOT: "This is a redesign" or "This is a different creature"

The viewer should immediately recognize this as THE SAME companion from Stage ${currentStage}.

=== TECHNICAL RENDERING REQUIREMENTS ===
- Photoreal quality (Unreal Engine 5 / Octane render)
- Anatomically accurate ${companion.spirit_animal} at Stage ${nextStage} maturity
- Museum-specimen precision in biological details
- Cinematic three-point lighting
- Proper subsurface scattering and material response
- Atmospheric volumetric effects
- Dynamic heroic composition
- 8K ultra-detail resolution

Focus on these continuity percentages:
✓ Species Identity: 100% match
✓ Markings & Patterns: 100% match
✓ Eye Features: 100% match
✓ Color Palette: 95% match
✓ Silhouette: 90% match (growth allowed)
✓ Elemental Style: 95% match (intensity increase allowed)

Generate an evolution that honors the companion's journey while showing clear growth and power increase.`;
    }

    console.log("Generating evolution image...");

    // 6. Generate new evolution image with Nano Banana
    // For stage 0 (destiny preview) and stage 1 (first hatchling), don't use the continuity system prompt
    const shouldUseContinuityPrompt = nextStage > 1;
    
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

    // 8. Save evolution to database using service role client (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    
    const { data: evolutionRecord, error: evolutionError } = await supabaseAdmin
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
    0: "Pristine mystical egg containing the champion's divine destiny, silhouette of ultimate form barely visible within",
    1: "Newborn hatchling emerging with first breath of life, tiny and vulnerable yet radiating pure potential",
    2: "Young guardian taking first steps, anatomically accurate infant form with oversized features, gaining confidence",
    3: "Early adolescent form, lengthening body with developing musculature, playful energy and growing coordination",
    4: "Juvenile warrior, balanced proportions emerging, signature features becoming prominent, athletic and agile",
    5: "Young adult reaching full size, powerful stance, all anatomical features fully developed and majestic",
    6: "Seasoned protector with battle scars and experience, peak physical conditioning, commanding presence",
    7: "Elite guardian radiating heroic energy, perfected anatomy, elemental mastery evident in every movement",
    8: "Legendary champion, imposing scale, flawless physique, environmental reality bending to its power",
    9: "Mythic warrior at absolute peak, battle-hardened yet elegant, aura of invincibility and wisdom",
    10: "Veteran legend, refined grace, every detail telling stories of countless victories, museum-quality perfection",
    11: "Transcendent being achieving weightlessness, gravitational defiance, ethereal trails and elevated consciousness",
    12: "Ascended entity hovering in pure energy, species perfection enhanced by cosmic power, reality-bending presence",
    13: "Ether-born avatar phasing between dimensions, sacred geometry manifesting, cosmic patterns on biological form",
    14: "Primordial aspect at titan scale, ancient power condensed into runic energy wrapping anatomically perfect form",
    15: "Colossal divine champion, monumental scale yet every detail pristine, environmental phenomena manifest its presence",
    16: "Cosmic guardian merged with nebula and stars, eyes containing galaxies, biological perfection meets stellar phenomenon",
    17: "Astral overlord transcending dimensions, multiple temporal echoes, reality fragmenting around ultimate power",
    18: "Universal sovereign at planetary scale, apocalyptic environmental forces, godlike yet anatomically unchanged",
    19: "Mythic apex standing as deity of its species, divine proportions, golden ratio perfection, worshipful grandeur",
    20: "Origin of Creation - the primordial first, absolute divine completion, universe-birthing presence, perfection incarnate"
  };

  return guidance[stage] || "Continued evolution with enhanced power and presence";
}