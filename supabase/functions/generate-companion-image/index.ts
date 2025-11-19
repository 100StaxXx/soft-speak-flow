import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ELEMENT_EFFECTS = {
  fire: "glowing embers, flame trails, warm orange-red aura",
  water: "flowing water effects, ripple patterns, cool blue mist",
  earth: "stone textures, crystal formations, moss details",
  air: "wind swirls, feather details, cloud wisps",
  lightning: "electric arcs, crackling purple-blue glow, sparks",
  ice: "frost patterns, crystal shards, cold cyan vapor",
  light: "radiant golden beams, holy glow, sparkles",
  shadow: "dark purple wisps, mysterious smoke, ethereal darkness",
};

const EVOLUTION_STAGES = {
  0: { name: "Dormant Egg", prompt: "A small, hand-sized mystical egg or origin core. Smooth surface with faint {element} glow. Subtle markings in {color} tones. Inside, the silhouette of a {spirit} is faintly visible, curled and sleeping. Gentle pulsing energy." },
  1: { name: "Cracking Awakening", prompt: "The origin egg fracturing with glowing cracks of {element} energy. The internal silhouette of the {spirit} shifts. {element} light leaks out. Shell reveals {spirit}-accurate textures beginning to form." },
  2: { name: "Newborn Emergence", prompt: "A tiny {spirit} fully emerged from the egg, fragile and newborn. Anatomically accurate to species. Oversized curious eyes, soft body, faint markings in {color} tones on fur/feathers/scales. Gentle {element} aura flickering around it." },
  3: { name: "Early Infant Form", prompt: "A slightly larger infant {spirit}, steadier posture but still round proportions. Bright curious eyes. Species-specific textures becoming clearer. {element} effects forming tiny motifs around body." },
  4: { name: "Juvenile Form", prompt: "A young {spirit} with lengthening body and strengthening limbs. Playful movements. Fur/feathers/scales showing early patterning in {color} tones. {element} energy forming natural highlights." },
  5: { name: "Young Explorer", prompt: "A noticeably growing {spirit}, still youthful but more balanced proportions. Early signature traits (horns/wings/claws/fins/tail) sharpening. {element} energy wraps gently along limbs or body edges." },
  6: { name: "Adolescent Guardian", prompt: "A larger adolescent {spirit} with developing musculature or body density. Confident posture. {element} markings glowing lightly across body in patterns or runes. {color} highlights prominent." },
  7: { name: "Initiate Protector", prompt: "A {spirit} with strengthened silhouette and sharper edges. Maturing facial features. Fur/feathers/scales gaining depth and complexity in {color} patterns. {element} aura forming a soft shield-like halo." },
  8: { name: "Seasoned Guardian", prompt: "An impressively larger {spirit}, fully grounded in species anatomy. Powerful, controlled movements. Patterns glowing brighter in {color} tones. {element} energy subtly influencing the environment." },
  9: { name: "Mature Protector", prompt: "An adult {spirit} at peak physical form. Strong, balanced, poised. Environment reacting gently (rustling wind, glowing particles, rippling effects). {element} power radiating. {color} markings intricate." },
  10: { name: "Veteran Form", prompt: "A hardened, experienced {spirit}. Muscles/feathers/scales/skin showing refinement and elegance. {element} markings deepening and illuminating in controlled pulses. Wise eyes, {color} patterns telling stories of growth." },
  11: { name: "Elevated Form", prompt: "A {spirit} with slight levitation or lighter movement. {element} trails extending behind movements. Eyes shining brighter. Body maintaining perfect species anatomy but with enhanced presence." },
  12: { name: "Ascended Form", prompt: "A {spirit} with heightened presence, hovering slightly in ambient energy. Species silhouette 100% intact. {element} forming a radiant outline around the creature. {color} aura intensifying." },
  13: { name: "Ether-Born Avatar", prompt: "A {spirit} with semi-transparent layers of {element} energy appearing around body. Cosmic or elemental patterns emerging faintly on fur/feathers/scales in {color} tones. Silhouette still unaltered, just enhanced." },
  14: { name: "Primordial Aspect", prompt: "A significantly enlarged {spirit}. {element} energy condensing into luminous lines or glyphs wrapping around anatomy (never modifying it). Background subtly warping. Ancient power in {color} hues." },
  15: { name: "Colossus Form", prompt: "A giant, mythic-scale {spirit}. Features remain identical to base species but more defined, ancient, powerful. {element} effects thick, flowing, majestic in {color} shades. Colossal presence, unchanged silhouette." },
  16: { name: "Cosmic Guardian", prompt: "A {spirit} surrounded by nebula-like wisps in {element} energy and {color} tones. Eyes holding star-like glints. Body patterns glowing with complex geometry following species contours perfectly." },
  17: { name: "Astral Overlord", prompt: "A large, radiant {spirit}. Multi-layered transparent versions of the creature echo faintly behind it in {element} energy. {color} aura expanding massively. Silhouette crystal clear." },
  18: { name: "Universal Sovereign", prompt: "A {spirit} appearing grand and unstoppable. {element} storms or cosmic tides swirling behind in {color} hues. Creature itself anatomically unchanged, simply at impossible scale." },
  19: { name: "Mythic Apex", prompt: "A {spirit} standing as a mythic deity of its species. Runes or sigils floating around it in {element} energy. Light and shadow contouring the body in {color} tones, emphasizing every species-specific detail." },
  20: { name: "Origin of Creation", prompt: "The ultimate {spirit}: embodiment of pure {element} essence while retaining exact face, body, limb structure, wings, fins, tail of base species. Glowing cosmic patterns pulsing through fur/feathers/scales in {color} brilliance. Majestic, infinite, recognizably the same creature — perfected." }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid user token");

    const { spiritAnimal, element, stage, favoriteColor, eyeColor, furColor } = await req.json();

    if (!spiritAnimal) throw new Error("spiritAnimal is required");
    if (!element) throw new Error("element is required");
    if (stage === undefined || stage === null) throw new Error("stage is required");
    if (!favoriteColor) throw new Error("favoriteColor is required");

    const stageInfo = EVOLUTION_STAGES[stage as keyof typeof EVOLUTION_STAGES];
    if (!stageInfo) throw new Error(`Invalid stage: ${stage}`);

    const elementEffect = ELEMENT_EFFECTS[element.toLowerCase() as keyof typeof ELEMENT_EFFECTS] || ELEMENT_EFFECTS.light;
    const basePrompt = stageInfo.prompt.replace(/{spirit}/g, spiritAnimal).replace(/{element}/g, element).replace(/{color}/g, favoriteColor);

    const fullPrompt = `Ultra high quality digital art, photorealistic fantasy creature:\n\n${basePrompt}\n\nCRITICAL: MUST be anatomically accurate ${spiritAnimal}. Maintain EXACT ${spiritAnimal} silhouette, proportions, and features.\n\nCOLORS: Primary ${favoriteColor}, Eyes ${eyeColor || favoriteColor}, Fur/Feathers/Scales ${furColor || favoriteColor}, Element ${elementEffect}\n\nSTYLE: Hyper-detailed textures, cinematic lighting, ethereal magical atmosphere, depth of field\n\nStage ${stage}: ${stageInfo.name}\n${element} element creature\nPerfect ${spiritAnimal} anatomy\n\nUltra detailed, 8K quality, professional concept art`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash-image", messages: [{ role: "user", content: fullPrompt }], modalities: ["image", "text"] })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Lovable AI error:", errorText);
      
      // Handle specific error cases
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "Insufficient AI credits. Please contact support or try again later.",
            code: "INSUFFICIENT_CREDITS"
          }), 
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" }, 
            status: 402 
          }
        );
      }
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: "AI service is currently busy. Please wait a moment and try again.",
            code: "RATE_LIMITED"
          }), 
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" }, 
            status: 429 
          }
        );
      }
      
      throw new Error(`Lovable AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) throw new Error("No image URL in response");

    const base64Data = imageUrl.split(",")[1];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const filePath = `${user.id}/companion_${user.id}_stage${stage}_${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage.from("mentors-avatars").upload(filePath, binaryData, { contentType: "image/png", upsert: false });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from("mentors-avatars").getPublicUrl(filePath);

    return new Response(JSON.stringify({ imageUrl: publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
