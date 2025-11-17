import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ELEMENT_EFFECTS = {
  fire: "Add glowing embers, flame trails, warm orange-red aura, heat distortion",
  water: "Add flowing water effects, ripple patterns, cool blue mist, water droplets",
  earth: "Add stone textures, crystal formations, root patterns, moss details",
  air: "Add wind swirls, feather details, cloud wisps, motion blur",
  lightning: "Add electric arcs, storm energy, crackling purple-blue glow, sparks",
  ice: "Add frost patterns, crystal shards, cold cyan vapor, icicles",
  light: "Add radiant golden beams, holy glow, bright white aura, sparkles",
  shadow: "Add dark purple wisps, mysterious smoke, deep contrast, ethereal darkness",
};

// Universal stage descriptions that work for any animal/element/color combination
const EVOLUTION_STAGES = {
  0: {
    name: "Dormant Egg",
    size: "small, fits in both hands",
    pose: "resting in a mystical nest or floating gently",
    powerLevel: "dormant energy, subtle internal glow",
    visualFocus: "The egg itself - smooth, magical shell with subtle patterns",
    atmosphere: "Quiet, anticipation, potential energy building",
    details: "Translucent shell showing faint silhouette of creature inside, gentle pulsing light, peaceful and protected"
  },
  1: {
    name: "Hatching Stage",
    size: "tiny newborn, fits in cupped hands (6-8 inches)",
    pose: "emerging from cracked egg, tentative first movements, vulnerable and curious",
    powerLevel: "awakening energy, flickering elemental sparks, unstable aura",
    visualFocus: "Newborn creature breaking free, egg fragments around it, first glimpse of its form",
    atmosphere: "Birth moment, raw potential, innocent wonder",
    details: "Large eyes, soft features, tiny elemental wisps around body, clumsy but determined, shell pieces glowing nearby"
  },
  2: {
    name: "Juvenile Form",
    size: "small creature, size of a large cat (12-18 inches)",
    pose: "playful exploration stance, discovering its powers, energetic and curious",
    powerLevel: "growing elemental control, visible energy trails, consistent glow",
    visualFocus: "Young creature with distinct species features, practicing abilities",
    atmosphere: "Playfulness, discovery, growing confidence",
    details: "Clear animal features emerging, elemental energy forming small patterns, bright eyes full of wonder, nimble movements"
  },
  3: {
    name: "Adolescent Guardian",
    size: "medium guardian, size of a large dog (2-3 feet)",
    pose: "alert protective stance, ready to defend, showing early mastery",
    powerLevel: "controlled elemental aura, swirling energy patterns, focused power",
    visualFocus: "Teenage creature finding its strength, protective instincts awakening",
    atmosphere: "Determination, loyalty, growing power, protective energy",
    details: "Well-defined musculature, elemental markings on body, confident posture, energy forming defensive shields or barriers"
  },
  4: {
    name: "Mature Protector",
    size: "large protector, size of a horse (4-5 feet)",
    pose: "noble guardian stance, commanding presence, grounded power",
    powerLevel: "stable powerful aura, elemental mastery visible, area effect",
    visualFocus: "Adult creature in prime form, fully realized protector",
    atmosphere: "Strength, wisdom, reliable power, calm authority",
    details: "Impressive physical form, intricate elemental patterns throughout body, eyes glowing with wisdom, environment responding to presence"
  },
  5: {
    name: "Ascended Form",
    size: "majestic being, size of an elephant (6-8 feet)",
    pose: "hovering or floating with energy, transcendent posture, weightless grace",
    powerLevel: "intense elemental storms, reality-bending effects, massive aura",
    visualFocus: "Creature ascending beyond physical limitations, energy manifestation",
    atmosphere: "Transcendence, awe-inspiring, otherworldly majesty",
    details: "Wings or energy appendages, body partially translucent with power, eyes blazing with cosmic energy, ground cracking from power"
  },
  6: {
    name: "Ancient Elder",
    size: "massive ancient, larger than a building (10-15 feet)",
    pose: "seated in wisdom or standing as monument, timeless and eternal",
    powerLevel: "elemental domain control, weather effects, landscape alteration",
    visualFocus: "Ancient creature of legend, time-weathered but supremely powerful",
    atmosphere: "Ancient wisdom, patient power, living legend",
    details: "Battle scars transformed into power symbols, elements orbiting the creature, eyes containing ages of wisdom, aura affecting entire environment"
  },
  7: {
    name: "Mythic Avatar",
    size: "colossal mythic, size of multiple buildings (20-30 feet)",
    pose: "world-shaping stance, unleashing primal forces, reality warper",
    powerLevel: "elemental apocalypse level, reshaping reality, godlike manifestation",
    visualFocus: "Living myth, creature of pure elemental fury and creation",
    atmosphere: "Mythical power, reshaping world, feared and revered",
    details: "Multiple elemental effects simultaneously, body merged with environment, sky and ground reflecting its power, legendary presence"
  },
  8: {
    name: "Celestial Being",
    size: "titan form, mountain-sized (40-60 feet)",
    pose: "cosmic stance bridging earth and sky, universal presence",
    powerLevel: "stellar energy manipulation, cosmic forces, dimensional tears",
    visualFocus: "Creature transcending mortal realm, celestial guardian",
    atmosphere: "Divine majesty, cosmic significance, beyond comprehension",
    details: "Body contains stars and cosmic energy, elements no longer just around but PART of creature, reality bending around it, celestial phenomena"
  },
  9: {
    name: "Primordial Titan",
    size: "world-scale entity, incomprehensibly massive (100+ feet)",
    pose: "existence itself, beyond physical form, ultimate manifestation",
    powerLevel: "creation and destruction balanced, universe-altering presence",
    visualFocus: "The absolute final form, primordial force of nature itself",
    atmosphere: "Ultimate power, beginning and end, alpha and omega",
    details: "Form barely contained in reality, multiple dimensions visible through body, elements of creation swirling, landscape transformed into elemental paradise, godhood achieved"
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      throw new Error("Unauthorized");
    }

    const { 
      favoriteColor, 
      spiritAnimal, 
      coreElement, 
      stage = 0,
      previousImageUrl = null,
      mentorName = "Atlas"
    } = await req.json();

    console.log(`Generating companion for user ${user.id}, stage ${stage}`);

    // Build the prompt
    let prompt = "";
    
    // Sanitize spirit animal input - allow all animals from the companion personalization
    const validAnimals = [
      'dragon', 'phoenix', 'griffin', 'unicorn', 'pegasus',
      'wolf', 'tiger', 'lion', 'bear', 'eagle',
      'fox', 'owl', 'raven', 'hawk', 'falcon',
      'serpent', 'cobra', 'python', 'viper', 'basilisk',
      'deer', 'stag', 'elk', 'moose', 'reindeer',
      'panther', 'jaguar', 'leopard', 'cheetah', 'lynx',
      'mammoth', 'elephant', 'rhino', 'bison', 'buffalo',
      'kraken', 'leviathan', 'hydra', 'chimera', 'cerberus',
      'sphinx', 'minotaur', 'centaur', 'thunderbird', 'roc',
      'kitsune', 'tanuki', 'qilin', 'kirin', 'baku',
      'fenrir', 'sleipnir', 'jormungandr', 'nidhogg', 'fafnir',
      'manticore', 'wyvern', 'drake', 'wyrm', 'lindworm',
      'gryphon', 'hippogriff', 'alicorn', 'kelpie', 'selkie',
      'thundercat', 'storm wolf', 'ember fox', 'frost bear', 'shadow panther',
      'celestial whale', 'cosmic turtle', 'nebula stag', 'aurora owl', 'starlight butterfly'
    ];
    
    let sanitizedAnimal = spiritAnimal.toLowerCase().trim();
    
    // Check if the provided animal matches any valid animal (allows partial matches for multi-word animals)
    const isValid = validAnimals.some(valid => 
      sanitizedAnimal.includes(valid) || valid.includes(sanitizedAnimal)
    );
    
    if (!isValid || sanitizedAnimal.length > 50) {
      sanitizedAnimal = 'dragon'; // Default to dragon for invalid inputs
    }
    
    const stageInfo = EVOLUTION_STAGES[stage as keyof typeof EVOLUTION_STAGES];
    
    if (stage === 0) {
      // Initial egg stage
      prompt = `Create a mystical companion egg in high-quality fantasy art style.

STAGE: ${stageInfo.name}
This egg will eventually hatch into a ${sanitizedAnimal}.

VISUAL SPECIFICATIONS:
- Size: ${stageInfo.size}
- Pose/Position: ${stageInfo.pose}
- Power Level: ${stageInfo.powerLevel}
- Primary Color: ${favoriteColor} (dominant color throughout the egg)
- Element Affinity: ${coreElement} (${ELEMENT_EFFECTS[coreElement as keyof typeof ELEMENT_EFFECTS]})

KEY DETAILS:
${stageInfo.details}

ATMOSPHERE & MOOD:
${stageInfo.atmosphere}

The egg should incorporate ${favoriteColor} as the main color with ${coreElement} energy patterns.
Subtle ${sanitizedAnimal} silhouettes or symbols should be faintly visible through the shell.

IMPORTANT GUIDELINES:
- Warm, hopeful, magical feeling
- Designed for a motivation/self-improvement app
- Not evil, demonic, or horror-themed
- Encouraging and inspiring visual

Art Style: High-quality digital art, mystical fantasy, glowing magical effects, ${favoriteColor} color palette.
Background: Simple dark gradient to make the egg's glow stand out prominently.`;
    } else {
      // Evolution stages 1-9
      prompt = `Create Stage ${stage} evolution of a ${sanitizedAnimal} companion creature.

EVOLUTION STAGE: ${stageInfo.name}

CRITICAL IDENTITY:
- Species: ${sanitizedAnimal} (must be INSTANTLY recognizable with proper ${sanitizedAnimal} anatomy)
- Primary Color: ${favoriteColor} (dominant throughout entire body, aura, and effects)
- Element Affinity: ${coreElement}

STAGE ${stage} SPECIFICATIONS:
- Size: ${stageInfo.size}
- Pose: ${stageInfo.pose}  
- Power Level: ${stageInfo.powerLevel}
- Visual Focus: ${stageInfo.visualFocus}

ELEMENTAL EFFECTS:
${ELEMENT_EFFECTS[coreElement as keyof typeof ELEMENT_EFFECTS]}

KEY VISUAL DETAILS FOR STAGE ${stage}:
${stageInfo.details}

ATMOSPHERE & PRESENCE:
${stageInfo.atmosphere}

CRITICAL REQUIREMENTS:
- The ${sanitizedAnimal} features must be anatomically accurate and immediately recognizable
- Stage ${stage} should look DRAMATICALLY more powerful than Stage ${stage - 1}
- Size should be noticeably larger than previous stage
- ${favoriteColor} must be the dominant color scheme throughout
- ${coreElement} effects should be proportional to this power level

IMPORTANT GUIDELINES:
- Inspiring and empowering, not dark or evil
- Designed for motivation/mental fitness app
- Friendly but powerful and majestic
- Each evolution stage must be DISTINCTLY different

Art Style: Epic high-fantasy digital art, cinematic dramatic lighting, intense ${coreElement} elemental effects, glowing ${favoriteColor} color palette, photorealistic creature design.
Background: Dynamic atmospheric environment that reflects Stage ${stage} power level and complements ${coreElement} element.

Focus on making this Stage ${stage} evolution look significantly more evolved, larger, and more powerful than any previous stage.`;
    }

    console.log("Generated prompt:", prompt);

    // Call Lovable AI image generation
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Always generate from scratch for more distinct evolutions
    const messages: any[] = [
      {
        role: "user",
        content: prompt
      }
    ];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages,
        modalities: ["image", "text"]
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI generation failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI response received");

    const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.error("AI response:", JSON.stringify(aiData));
      throw new Error("No image URL in AI response");
    }

    // Convert base64 to blob and upload to Supabase Storage
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const fileName = `companion_${user.id}_stage${stage}_${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("mentor-audio")
      .upload(fileName, buffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from("mentor-audio")
      .getPublicUrl(fileName);

    console.log("Image uploaded successfully:", publicUrl);

    return new Response(
      JSON.stringify({ 
        imageUrl: publicUrl,
        stage,
        success: true 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-companion-image:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});