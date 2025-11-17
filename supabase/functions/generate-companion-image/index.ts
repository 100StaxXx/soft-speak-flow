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

const STAGE_DESCRIPTORS = {
  0: "A mystical glowing egg, small and cute with subtle energy patterns, dormant potential",
  1: "The egg is dramatically cracking with brilliant energy exploding out, creature's features emerging from shell fragments",
  2: "Young mythical creature, small but fierce, playful pose, features clearly visible, surrounded by magical energy wisps",
  3: "Adolescent guardian form with protective stance, medium size, more defined muscles and features, swirling elemental aura",
  4: "Mature ascended form with majestic wings or energy manifestation, large and powerful, hovering with confidence, intense magical glow",
  5: "Ancient mythic form, massive and commanding, legendary presence, reality-bending elemental powers visibly emanating",
  6: "Ultimate titan form, colossal and godlike, world-shaking power, cosmic energy radiating, supreme final evolution",
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
    
    if (stage === 0) {
      // Initial generation - egg stage
      prompt = `Create a mystical glowing egg companion creature in a fantasy art style.

This egg will hatch into a ${sanitizedAnimal} companion.

User's personal choices:
- Primary color scheme: ${favoriteColor} (use this as the dominant color throughout)
- Spirit animal: ${sanitizedAnimal} (subtle hints of this creature visible through the egg)
- Elemental affinity: ${coreElement} (add ${coreElement} energy patterns)

${STAGE_DESCRIPTORS[0]}

The egg should be small, cute, and magical. Incorporate ${favoriteColor} as the main color.
Add subtle ${sanitizedAnimal} silhouettes, patterns, or symbols visible through the translucent shell.
The egg should give hints that a ${sanitizedAnimal} will emerge from it.
${ELEMENT_EFFECTS[coreElement as keyof typeof ELEMENT_EFFECTS]}

IMPORTANT GUIDELINES:
- Do not make this creature look evil, demonic, grotesque, or horror themed
- It should feel encouraging, protective, and inspiring
- Design for a motivation/mental fitness app
- Keep it friendly, magical, and uplifting

Style: High quality digital art, mystical, fantasy, glowing, magical, ${favoriteColor} color palette.
Mood: Warm, hopeful, potential, beginning of a journey.
Background: Simple dark gradient to make the egg glow stand out.`;
    } else {
      // Evolution generation - create from scratch with very distinct characteristics per stage
      const sizeDescriptors = {
        1: "tiny newborn, fits in cupped hands",
        2: "small juvenile, size of a house cat",
        3: "medium adolescent, size of a large dog",
        4: "large adult, size of a horse",
        5: "massive elder, size of an elephant",
        6: "colossal titan, larger than a building"
      };

      const poseDescriptors = {
        1: "curled up protectively, cautious and vulnerable",
        2: "curious stance, exploring playfully",
        3: "alert guardian pose, ready to protect",
        4: "majestic spread wings, soaring powerfully",
        5: "commanding presence, radiating authority",
        6: "divine stance, reality-warping power display"
      };

      const powerLevel = {
        1: "gentle magical glow",
        2: "crackling elemental sparks",
        3: "swirling powerful aura",
        4: "intense energy storms",
        5: "reality-bending forces",
        6: "cosmic-scale power manifestation"
      };

      prompt = `Create a Stage ${stage} ${sanitizedAnimal} companion creature. This is a COMPLETELY NEW FORM evolution.

CRITICAL IDENTITY:
- This is a ${sanitizedAnimal} - make it INSTANTLY recognizable
- Size: ${sizeDescriptors[stage as keyof typeof sizeDescriptors]}
- Pose: ${poseDescriptors[stage as keyof typeof poseDescriptors]}
- Power level: ${powerLevel[stage as keyof typeof powerLevel]}

VISUAL SPECIFICATIONS:
- Primary color: ${favoriteColor} (dominant throughout body and aura)
- Element affinity: ${coreElement} (${ELEMENT_EFFECTS[coreElement as keyof typeof ELEMENT_EFFECTS]})
- Stage evolution: ${STAGE_DESCRIPTORS[stage as keyof typeof STAGE_DESCRIPTORS]}

The ${sanitizedAnimal} features must be anatomically clear: proper ${sanitizedAnimal} head shape, body proportions, characteristic features.
The creature should look SIGNIFICANTLY more powerful and larger than Stage ${stage - 1}.

IMPORTANT GUIDELINES:
- Do not make this creature look evil, demonic, grotesque, or horror themed
- It should feel encouraging, protective, and inspiring
- Design for a motivation/mental fitness app
- Keep it friendly, powerful, and majestic
- Each stage should look DISTINCTLY different from the previous one

Style: Epic high-fantasy digital art, cinematic lighting, dramatic ${coreElement} effects, glowing ${favoriteColor} palette.
Background: Dynamic atmospheric scene that complements the ${coreElement} element and Stage ${stage} power level.`;
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