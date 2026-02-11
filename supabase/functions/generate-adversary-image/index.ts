import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRequestAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const THEME_DESCRIPTIONS: Record<string, string> = {
  distraction: "a swirling vortex entity with multiple floating eyes and hypnotic patterns, draws attention away from focus",
  stagnation: "a moss-covered stone golem, ancient and immovable, roots growing from cracks in its form",
  anxiety: "a creature of crackling lightning and jagged edges, nervous energy radiating outward, flickering unstably",
  doubt: "a shadowy figure with no clear form, constantly shifting between shapes, mirrors reflecting distorted images",
  chaos: "a wild elemental of fire and wind intertwined, unpredictable flames dancing in spiral patterns",
  laziness: "a large slumbering beast made of clouds and soft mist, comfortable and heavy, weighing down everything",
  overthinking: "a many-headed serpent with gears and clockwork visible through transparent scales, endless calculation",
  fear: "a dark wraith with hollow eyes that glow with pale light, long spectral claws reaching from shadow",
  confusion: "a maze-like creature whose body is corridors and dead ends, geometric and impossible angles",
  vulnerability: "a cracked crystal being with exposed inner light, beautiful but fragile, defensive spikes emerging",
  imbalance: "a creature split down the middle - one half fire, one half ice, struggling against itself",
};

const TIER_MODIFIERS: Record<string, string> = {
  common: "simple and small, faint glow, apprentice-level threat",
  uncommon: "moderate size with emerging power, subtle magical aura",
  rare: "impressive and dangerous, strong magical presence, glowing runes",
  epic: "massive and terrifying, reality-bending presence, cosmic energy crackling",
  legendary: "god-like entity of immense power, celestial and apocalyptic, universe-shaking presence",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireRequestAuth(req, corsHeaders);
    if (auth instanceof Response) {
      return auth;
    }

    const { theme, tier, name } = await req.json();

    if (!theme || !tier) {
      throw new Error("Missing required parameters: theme, tier");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check cache first
    const { data: cachedImage } = await supabase
      .from("adversary_images")
      .select("image_url")
      .eq("theme", theme)
      .eq("tier", tier)
      .single();

    if (cachedImage?.image_url) {
      console.log(`Cache hit for ${theme}/${tier}`);
      return new Response(
        JSON.stringify({ imageUrl: cachedImage.image_url, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating new adversary image for ${theme}/${tier}`);

    const themeDesc = THEME_DESCRIPTIONS[theme] || "a mysterious dark energy creature";
    const tierMod = TIER_MODIFIERS[tier] || "moderate power level";

    const prompt = `Create a dark fantasy creature portrait for a mobile game battle screen. The creature is called "${name || 'Astral Adversary'}" and represents ${theme} energy.

Description: ${themeDesc}

Power level: ${tierMod}

Style requirements:
- Digital painting style, high-quality fantasy game concept art
- Dark and menacing but stylized and appealing (not grotesque)
- Cosmic/astral aesthetic with subtle star and nebula elements
- Glowing eyes or energy effects
- Portrait composition focused on the creature's upper body/face
- Dark background with magical ambient lighting
- Single creature only, no multiple entities
- Professional game asset quality`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("No image in response:", JSON.stringify(data));
      throw new Error("No image generated");
    }

    // Cache the image
    const { error: insertError } = await supabase
      .from("adversary_images")
      .insert({ theme, tier, image_url: imageUrl });

    if (insertError) {
      console.error("Failed to cache image:", insertError);
      // Continue anyway - image was generated successfully
    }

    console.log(`Successfully generated and cached image for ${theme}/${tier}`);

    return new Response(
      JSON.stringify({ imageUrl, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating adversary image:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
