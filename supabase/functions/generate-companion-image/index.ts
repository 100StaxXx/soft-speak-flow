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
  0: "A mystical glowing egg, small and cute with subtle energy patterns",
  1: "The egg is cracking with energy leaking out, more intense glow, hints of the creature inside",
  2: "Small mythical creature emerging, features becoming visible, still young and adorable",
  3: "Guardian form with protective stance, more powerful, aura forming around it",
  4: "Ascended form with wings or energy manifestation, majestic and floating",
  5: "Mythic form, large and powerful, commanding presence, legendary aura",
  6: "Final titan form, massive and awe-inspiring, ultimate evolution, cinematic and epic",
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
      // Evolution generation
      // Evolution - emphasize the animal form
      prompt = `Transform and evolve this companion creature to Stage ${stage}.

CRITICAL: This is a ${sanitizedAnimal} companion. It MUST clearly look like a ${sanitizedAnimal} at this stage.

MAINTAIN AND ENHANCE THESE CORE TRAITS:
- Primary color scheme: ${favoriteColor} (keep this as the main color)
- Core form: ${sanitizedAnimal} (this should be VERY clear - the creature IS a ${sanitizedAnimal})
- Elemental energy: ${coreElement} effects and aura

${STAGE_DESCRIPTORS[stage as keyof typeof STAGE_DESCRIPTORS]}

Make the ${sanitizedAnimal} form much more recognizable and prominent. 
The creature should clearly be identifiable as a ${sanitizedAnimal} with ${coreElement} powers.
Keep the ${favoriteColor} color scheme but emphasize the ${sanitizedAnimal} anatomy and features.
${ELEMENT_EFFECTS[coreElement as keyof typeof ELEMENT_EFFECTS]}

IMPORTANT GUIDELINES:
- Do not make this creature look evil, demonic, grotesque, or horror themed
- It should feel encouraging, protective, and inspiring
- Design for a motivation/mental fitness app
- Keep it friendly, powerful, and majestic
- The ${sanitizedAnimal} features must be clear and recognizable

Style: Epic fantasy art, detailed ${sanitizedAnimal} features, more powerful than before, magical, glowing ${favoriteColor} tones.
Keep the same ${sanitizedAnimal} identity but amplify the power, size, and majesty.
Background: Dramatic and atmospheric, complementing the ${coreElement} element.`;
    }

    console.log("Generated prompt:", prompt);

    // Call Lovable AI image generation
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const messages: any[] = [];
    
    if (previousImageUrl && stage > 0) {
      // For evolution, include the previous image
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: previousImageUrl } }
        ]
      });
    } else {
      // For initial generation
      messages.push({
        role: "user",
        content: prompt
      });
    }

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