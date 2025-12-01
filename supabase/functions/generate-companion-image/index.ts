import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ELEMENT_EFFECTS = {
  fire: "glowing embers dancing upward, molten lava veins, flame trails with realistic heat distortion, warm orange-red volumetric aura with ember particles",
  water: "flowing liquid water droplets, dynamic ripple patterns with realistic refraction, cool blue translucent mist, bioluminescent aquatic glow",
  earth: "weathered stone textures with moss growth, crystalline mineral formations catching light, floating dust particles, ancient runic carvings",
  air: "swirling wind currents with visible motion blur, delicate feather details with realistic barbs, cumulus cloud wisps, atmospheric pressure waves",
  lightning: "branching electric arcs following realistic paths, crackling purple-blue plasma glow, electromagnetic field distortions, ozone shimmer",
  ice: "intricate frost patterns with hexagonal crystals, sharp ice shards refracting light, cold cyan vapor condensation, frozen breath effects",
  light: "divine radiant beams with god rays, holy luminescence with lens flare, iridescent sparkle particles, prismatic rainbow refraction",
  shadow: "volumetric dark purple tendrils, mysterious smoke with depth, ethereal darkness with subtle gradients, void energy wisps",
};

const EVOLUTION_STAGES = {
  0: { 
    name: "Dormant Egg", 
    prompt: "A mystical egg floating in gentle {element} energy. The egg has a smooth, opalescent surface with subtle {color} undertones. Deep within the translucent shell, a dark shadowy silhouette is barely visible - the mysterious outline of a powerful, mature {spirit} creature curled in dormant slumber. The silhouette should be a dark, featureless shadow showing only the basic shape and posture of what will become a majestic creature at stage 15. Faint {element} glow pulses around the egg.",
    useFutureSilhouette: true,
    futureStage: 15
  },
  1: { 
    name: "Cracking Awakening", 
    prompt: "The same mystical egg now with luminous cracks spreading across its surface, leaking {element} energy. Through the larger cracks, a dark shadowy silhouette is more visible - the outline of an even more powerful {spirit} creature in its ultimate form (stage 20), still curled but beginning to stir. The silhouette remains a dark, featureless shadow showing only the magnificent shape and presence of the creature's final evolution. {color} light emanates from the fractures.",
    useFutureSilhouette: true,
    futureStage: 20
  },
  2: { name: "Newborn Emergence", prompt: "A tiny newborn {spirit} taking its first breaths, anatomically accurate with realistic proportions for a hatchling. Oversized curious eyes with proper iris detail and light reflection, soft vulnerable body with correct skeletal structure visible beneath skin/fur/scales. Realistic newborn proportions: large head-to-body ratio, short stubby limbs with proper joint placement. Delicate faint markings in {color} tones. Gentle {element} aura flickering softly. Cinematic lighting highlighting vulnerability and innocence." },
  3: { name: "Early Infant Form", prompt: "A slightly larger infant {spirit} with improved motor control, steadier posture showing proper spine alignment and center of gravity. Still youthfully round with baby fat/fluff but developing muscle definition. Bright intelligent eyes with proper anatomical positioning. Species-accurate features emerging: correct number of digits, proper ear/horn placement, accurate tail structure. {element} effects manifesting naturally along the creature's energetic meridians. Dynamic lighting showing form and depth." },
  4: { name: "Juvenile Form", prompt: "A young {spirit} entering adolescence with lengthening limbs showing proper bone structure and joint articulation. Playful athletic pose demonstrating agility and emerging coordination. Anatomically correct musculature beginning to define beneath fur/feathers/scales. Realistic texture details: individual hair strands, scale overlap patterns, or feather barbules. {color} patterning following natural pigmentation paths. {element} energy highlighting movement with motion blur and particle effects." },
  5: { name: "Young Explorer", prompt: "A growing {spirit} reaching balanced adult proportions with realistic skeletal structure and proper weight distribution. Signature anatomical features now prominent: horns with proper keratin texture, wings with accurate bone structure and membrane/feather detail, claws with realistic curvature, fins with proper ray structure, or tail with correct vertebrae articulation. {element} energy flowing along natural body contours. Confident dynamic pose with cinematic three-point lighting." },
  6: { name: "Adolescent Guardian", prompt: "A larger adolescent {spirit} with well-defined musculature showing proper anatomical groups: shoulders, haunches, core. Realistic skin/fur/scale texture with subsurface scattering. Confident powerful stance with accurate weight-bearing posture. {element} markings following natural body patterns like tiger stripes or leopard spots but glowing with magical energy. {color} highlights emphasizing anatomical form. Dramatic atmospheric lighting with rim light defining silhouette." },
  7: { name: "Initiate Protector", prompt: "A mature {spirit} with peak physical conditioning, every muscle group anatomically correct and properly defined. Majestic facial features with realistic bone structure, proper eye socket depth, accurate muzzle/beak proportions. Fur/feathers/scales rendered with microscopic detail showing individual elements. Battle-ready stance with proper weight distribution and tension. {element} aura forming a luminous shield-like corona with atmospheric perspective. {color} patterns creating visual hierarchy. Epic hero lighting with motivated shadows." },
  8: { name: "Seasoned Guardian", prompt: "An imposing {spirit} at full adult size with flawless species anatomy and heroic proportions. Powerful physique showing realistic muscle tension and relaxation. Every anatomical detail perfect: teeth/fangs with proper dental structure, eyes with corneal reflection and depth, skin showing appropriate thickness and texture variation. Dynamic pose mid-motion with realistic momentum. {element} energy creating environmental interaction: heat waves, water displacement, ground fissures. Cinematic wide-angle composition with depth of field." },
  9: { name: "Mature Protector", prompt: "A battle-hardened {spirit} in its prime, anatomically perfect with scars and weathering that tell a story. Peak physical condition with defined musculature showing proper insertion points and fiber direction. Regal commanding pose with perfect posture and balance. Environment responding realistically: wind-blown debris, displaced water, crackling energy, gravitational distortion. {element} power radiating with volumetric lighting effects. {color} markings intricate and luminous. Dramatic low-angle cinematic framing emphasizing power." },
  10: { name: "Veteran Form", prompt: "A legendary {spirit} with refined elegant anatomy showing both power and grace. Muscles/feathers/scales/skin exhibiting masterful detail: individual muscle striations, scale iridescence, feather microstructures, skin pores and texture. Wise battle-scarred face with deep intelligent eyes showing inner light. Poised stance radiating authority. {element} markings pulsing with rhythmic energy following circulatory patterns. {color} accents creating focal points. Museum-quality rendering with perfect subsurface scattering and ambient occlusion." },
  11: { name: "Elevated Form", prompt: "A transcendent {spirit} achieving weightless grace while maintaining perfect anatomical accuracy. Slight gravitational defiance with realistic physics: fur/feathers flowing upward, subtle ground separation with energy cushion. {element} trails creating realistic motion paths with particle physics. Eyes glowing with inner luminescence showing proper eye anatomy with magical enhancement. Every muscle, bone, and feature rendered flawlessly. Ethereal atmospheric lighting with volumetric god rays." },
  12: { name: "Ascended Form", prompt: "A majestic {spirit} hovering in concentrated ambient energy field, species anatomy 100% preserved and enhanced. Powerful physique showing peak evolutionary form with perfect proportions. {element} forming a brilliant radiant outline following exact body contours with proper light diffusion. {color} aura intensifying with realistic energy physics. Heroic floating pose with proper center of gravity. IMAX-quality cinematic composition with dramatic scale and atmospheric depth. Photorealistic fur/scale/feather rendering with every detail visible." },
  13: { name: "Ether-Born Avatar", prompt: "A reality-bending {spirit} with semi-transparent layers of {element} energy phasing around its physically perfect body. Cosmiq or elemental sacred geometry patterns emerging organically on anatomically accurate fur/feathers/scales in {color} luminescence. Base creature silhouette completely unaltered, just cosmiqly enhanced. Multiple energy layers creating depth with atmospheric perspective. Mystical aura suggesting dimensional transcendence while maintaining biological perfection. Octane render quality with path-traced lighting." },
  14: { name: "Primordial Aspect", prompt: "A monumentally enlarged {spirit} radiating ancient primordial power while maintaining exact anatomical proportions at massive scale. {element} energy condensing into luminous runic lines and glyphs wrapping around body following natural anatomy (veins, muscle groups, bone structure) without modifying base form. Reality warping subtly around the creature with spacetime distortion effects. Ground cracking beneath its weight with realistic physics. Ancient cosmiq power radiating in {color} hues. Epic fantasy art quality with perfect anatomy at titan scale." },
  15: { name: "Colossus Form", prompt: "A colossal mythic-scale {spirit} towering with divine presence. Every anatomical feature identical to base species but rendered at monumental scale with museum-quality detail: individual scales/feathers visible despite size, proper muscle definition throughout, correct skeletal structure, accurate proportions maintained. {element} effects manifesting as massive environmental phenomena in {color} brilliance. Kaiju-scale cinematography with proper forced perspective. The creature is impossibly large yet perfectly anatomically sound. Photoreal rendering showing atmospheric scattering and scale depth cues." },
  16: { name: "Cosmiq Guardian", prompt: "A celestial {spirit} merged with cosmiq forces while retaining perfect biological anatomy. Surrounded by photorealistic nebula clouds in {element} energy and {color} star matter. Eyes containing actual galaxies with realistic astronomical detail while maintaining proper eye structure. Body covered in bioluminescent patterns following natural markings with complex sacred geometry overlays. Every anatomical feature present and correct beneath cosmiq enhancement. Space-based environment with realistic stellar lighting. NASA-quality astrophotography meets natural history museum specimen." },
  17: { name: "Astral Overlord", prompt: "A dimension-transcending {spirit} with crystal-clear anatomical definition. Multiple ghost-image echoes trailing behind showing motion through dimensional space, each maintaining perfect species anatomy. {element} energy creating chromatic aberration effects and reality ripples. {color} aura expanding into a massive presence field with realistic energy falloff. Main body hyper-detailed showing every muscle fiber, scale ridge, feather barbule in sharp focus. Dramatic dutch angle with impossible scale. Reality fragmenting around absolute power while creature remains anatomically flawless." },
  18: { name: "Universal Sovereign", prompt: "A world-ending scale {spirit} appearing catastrophically powerful yet anatomically pristine. {element} manifesting as apocalyptic environmental phenomena: hurricane-force winds, tsunami waves, seismic ruptures, plasma storms swirling in {color} cosmiq fury. The creature itself maintains perfect unchanged anatomy simply existing at impossible planetary scale. Every biological detail correct and visible despite godlike size. Satellite-view composition showing creature affecting continental-scale environment. Photoreal disaster-movie cinematography with the creature as unstoppable natural force." },
  19: { name: "Mythic Apex", prompt: "A deity-tier {spirit} standing as the perfected mythological ideal of its species. Floating runes and sigils orbiting in {element} script with ancient divine power. Physically flawless with every anatomical detail representing the absolute peak of evolutionary design: perfect symmetry, ideal muscle definition, pristine features, divine proportions following golden ratio. Light and shadow playing across form in {color} divine radiance emphasizing every species-specific detail like a Baroque religious painting. Heroic pose on cosmiq throne or platform. Worshipful low-angle composition with dramatic chiaroscuro lighting." },
  20: { name: "Origin of Creation", prompt: "The absolute ultimate {spirit}: the primordial template from which all others descend. Pure embodiment of {element} in its creation-myth form while retaining EXACT anatomical accuracy of face, eyes, skull structure, body, musculature, skeletal system, limb articulation, wings, fins, tail, and every species-defining feature of base creature. Every surface glowing with {color} cosmiq genesis energy pulsing through perfect fur/feathers/scales like living stardust. The creature that existed before time, perfect in every biological detail. Background shows universe being born from its presence. Biblical/mythological grandeur with museum-specimen anatomical accuracy. This is perfection incarnate: the Original, the First, the Eternal - recognizably the same beloved companion but ascended to absolute divine completion." }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("Generating companion image - request received");
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ 
          error: "Authentication required. Please refresh the page and try again.",
          code: "NO_AUTH_HEADER"
        }), 
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: 401 
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase configuration missing");
      return new Response(
        JSON.stringify({ 
          error: "Server configuration error. Please contact support.",
          code: "SERVER_CONFIG_ERROR"
        }), 
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: 500 
        }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("Authentication failed:", authError);
      return new Response(
        JSON.stringify({ 
          error: "Invalid authentication. Please refresh the page and try again.",
          code: "INVALID_AUTH"
        }), 
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: 401 
        }
      );
    }

    console.log(`User authenticated: ${user.id}`);

    const { spiritAnimal, element, stage, favoriteColor, eyeColor, furColor } = await req.json();

    console.log(`Request params - Animal: ${spiritAnimal}, Element: ${element}, Stage: ${stage}, Color: ${favoriteColor}`);

    if (!spiritAnimal) throw new Error("spiritAnimal is required");
    if (!element) throw new Error("element is required");
    if (stage === undefined || stage === null) throw new Error("stage is required");
    if (!favoriteColor) throw new Error("favoriteColor is required");

    const stageInfo = EVOLUTION_STAGES[stage as keyof typeof EVOLUTION_STAGES];
    if (!stageInfo) {
      console.error(`Invalid stage provided: ${stage}`);
      throw new Error(`Invalid stage: ${stage}`);
    }

    const elementEffect = ELEMENT_EFFECTS[element.toLowerCase() as keyof typeof ELEMENT_EFFECTS] || ELEMENT_EFFECTS.light;
    
    let fullPrompt: string;
    
    // Stage 0 uses special silhouette prompt
    if (stage === 0) {
      fullPrompt = `STYLIZED ANIMATED FANTASY ART - Cute cartoon style, vibrant colors:

SUBJECT: A magical mystical egg floating in a whimsical realm, glowing with ${element} elemental energy.

EGG DETAILS:
- Smooth glossy surface with sparkly iridescent shimmer
- Beautiful ${favoriteColor} undertones with cute magical patterns
- Semi-translucent crystalline shell that looks magical and precious
- Soft cartoon shading with gentle gradients
- Adorable size that looks like it holds something precious

SILHOUETTE INSIDE (CUTE STYLE):
Within the translucent shell, a cute dark silhouette is visible:
- The adorable outline of a ${spiritAnimal.toUpperCase()} curled up sleeping
- Stylized cartoon proportions - recognizable but cute
- Curled in a cozy sleeping position
- Shadow shows recognizable ${spiritAnimal} features (ears, tail shape)
- Mysterious but endearing - creates anticipation for a cute creature
- Hints at the adorable companion waiting to hatch

ELEMENTAL EFFECTS:
- Magical sparkles and gentle glowing particles
- Soft ${element} energy swirling around the egg
- Cute magical effects like stars, hearts, or element-themed particles
- Pulsing gentle glow in ${favoriteColor} suggesting a heartbeat

COMPOSITION & LIGHTING:
- Warm inviting lighting with soft shadows
- Magical sparkle effects throughout
- Soft dreamy background with gentle blur
- Whimsical atmosphere

STYLE REFERENCES:
- Pixar/Disney animated movie quality
- Cute mobile game art style
- Anime-inspired magical objects
- Pokemon egg aesthetics
- NEVER photorealistic - always cute and stylized`;
    } else {
      const basePrompt = stageInfo.prompt.replace(/{spirit}/g, spiritAnimal).replace(/{element}/g, element).replace(/{color}/g, favoriteColor);
      
      // Progressive creative freedom based on stage
      // Early stages (1-10): Strict realism
      // Mid stages (11-14): Allow mythic enhancements
      // Late stages (15-20): Full grandiose creativity
      const stageLevel = stage <= 10 ? 'realistic' : stage <= 14 ? 'mythic' : 'legendary';
      
      // Special handling for aquatic creatures to prevent legs (applies to ALL tiers including legendary)
      const aquaticCreatures = ['shark', 'whale', 'dolphin', 'fish', 'orca', 'manta ray', 'stingray', 'seahorse', 'jellyfish', 'octopus', 'squid'];
      const isAquatic = aquaticCreatures.some(creature => spiritAnimal.toLowerCase().includes(creature));
      
      // Stage-appropriate aquatic enforcement
      let aquaticNote = '';
      if (isAquatic) {
        if (stageLevel === 'realistic' || stageLevel === 'mythic') {
          aquaticNote = '\n\nCRITICAL AQUATIC ANATOMY:\n- This is a purely AQUATIC creature - NO LEGS OR LIMBS of any kind\n- Only fins, tail, and streamlined hydrodynamic body\n- Absolutely no legs, arms, feet, hands, or terrestrial limbs\n- Must follow real-world aquatic animal anatomy\n- Underwater environment with water physics';
        } else {
          // Legendary tier - aquatic still maintained even at cosmiq scale
          aquaticNote = '\n\nCRITICAL AQUATIC ESSENCE (COSMIQ SCALE):\n- Even at universe-scale, this remains an AQUATIC entity - NO LEGS OR TERRESTRIAL LIMBS\n- Cosmiq fins, nebula tail flukes, galaxy-scale streamlined form\n- NEVER legs, arms, or terrestrial appendages - aquatic movement through space itself\n- Can have ethereal fins, stellar tail, cosmiq flippers - but must remain recognizably aquatic\n- Think: cosmiq whale swimming through stars, not a legged deity';
        }
      }
      
      // Stage-appropriate species enforcement
      let speciesGuidance = '';
      if (stageLevel === 'realistic') {
        speciesGuidance = `
SPECIES IDENTITY (ABSOLUTELY NON-NEGOTIABLE):
THIS IS A ${spiritAnimal.toUpperCase()} - Nothing else, no exceptions, no creative interpretation.

CRITICAL SPECIES REQUIREMENTS:
- Species: Pure ${spiritAnimal} - 100% anatomically accurate to real-world ${spiritAnimal} biology
- NO HYBRIDS: This is NOT a ${spiritAnimal}-dragon, NOT a ${spiritAnimal}-human, NOT any other species
- NO ADDED FEATURES: Do not add wings unless ${spiritAnimal} naturally has wings in reality
- NO REMOVED FEATURES: Do not remove limbs that real ${spiritAnimal} have
- EXACT ${spiritAnimal} skeletal structure following real animal anatomy textbooks
- EXACT ${spiritAnimal} proportions (head-to-body ratio, limb length, body shape)
- Correct number of limbs: Real ${spiritAnimal} have [X] legs - match this exactly
- Correct digit count: Real ${spiritAnimal} have [Y] toes/claws - match this exactly
- Species-defining features: ${spiritAnimal} have specific ears/snout/tail - include all of them
- Realistic muscle groups and bone structure for ${spiritAnimal} species
- Species-appropriate posture, gait, and natural movement for ${spiritAnimal}${aquaticNote}

REFERENCE: Imagine a ${spiritAnimal} from a nature documentary or zoo, then add magical elements WITHOUT changing the animal's anatomy.`;
      } else if (stageLevel === 'mythic') {
        speciesGuidance = `
SPECIES IDENTITY (CORE FOUNDATION):
THIS IS A ${spiritAnimal.toUpperCase()} - Recognizable species with mythic enhancements allowed.

ENHANCED SPECIES REQUIREMENTS:
- Base Species: ${spiritAnimal} - core anatomy maintained but mythic features now permitted
- Species recognizable: Should still be identifiable as ${spiritAnimal} at first glance
- Core features preserved: Maintain ${spiritAnimal} head shape, body structure, limb configuration
- Mythic enhancements allowed: Can add divine horns, ethereal wings, cosmiq patterns, reality-bending features
- Size enhancement: Can be larger than real-world scale
- Proportions can be heroic/idealized while maintaining ${spiritAnimal} identity
- Elemental features can manifest as additional visual elements (energy wings, particle effects, auras)${aquaticNote}

CREATIVE FREEDOM: You may add mythic/divine features that enhance the ${spiritAnimal} into a legendary form, BUT the creature must remain recognizable as a ${spiritAnimal}.`;
      } else {
        speciesGuidance = `
SPECIES IDENTITY (DIVINE EVOLUTION):
THIS IS THE ULTIMATE ${spiritAnimal.toUpperCase()} - A god-tier, reality-breaking, cosmiq entity that transcends while maintaining ${spiritAnimal} essence.

LEGENDARY CREATIVE FREEDOM:
- Base Species Recognition: ${spiritAnimal} identity visible through divine form
- FULL CREATIVE LIBERTY: Add cosmiq wings, divine horns, multiple forms, reality fragments, celestial features
- Scale: Colossal, planetary, universe-scale presence
- Anatomy can be fantastical: Multiple ethereal limbs, cosmiq energy constructs, dimensional features
- Can transcend physical form: Ghost images, dimensional echoes, astral projections
- Divine enhancements: Halos, crowns, divine armor, cosmiq patterns, universe-birthing energy
- Reality-bending: Environment warps around the creature, space-time distortions, cosmiq phenomena${aquaticNote}

GRANDIOSE MANDATE: Make this creature LARGER THAN LIFE. This is the pinnacle of evolution - a living god, a force of nature, an entity of pure legend. Push creative boundaries while keeping the soul of the ${spiritAnimal} recognizable in the design.`;
      }
      
      // Determine cuteness level based on stage
      const cutenessLevel = stage <= 5 ? 'adorable' : stage <= 10 ? 'charming' : stage <= 15 ? 'majestic-cute' : 'epic-cute';
      
      fullPrompt = `STYLIZED ANIMATED FANTASY CREATURE - Cute cartoon art style, NOT photorealistic:

CREATURE EVOLUTION STAGE ${stage}: ${stageInfo.name}

CRITICAL STYLE DIRECTION:
- ANIMATED CARTOON STYLE like Pixar, Disney, or high-quality mobile game art
- CUTE and APPEALING with big expressive eyes and soft rounded features
- NOT photorealistic - stylized, colorful, and charming
- Think: adorable fantasy creature from an animated movie
- Smooth gradients, soft shadows, vibrant saturated colors
- ${cutenessLevel === 'adorable' ? 'Maximum cuteness - round shapes, big sparkly eyes, tiny paws, fluffy appearance' : 
    cutenessLevel === 'charming' ? 'Very cute but growing stronger - still has big eyes and appealing features' :
    cutenessLevel === 'majestic-cute' ? 'Majestic but still endearing - powerful yet lovable' :
    'Epic scale but retains charm - awe-inspiring yet still has cute appeal'}

BASE DESCRIPTION:
${basePrompt}
${speciesGuidance}

COLOR PALETTE:
- Primary colors: Vibrant ${favoriteColor} tones with high saturation
- Eye color: ${eyeColor || favoriteColor} - BIG SPARKLY EXPRESSIVE EYES
- Fur/Feathers/Scales: ${furColor || favoriteColor} - soft, fluffy appearance
- Elemental glow: ${element} effects with magical sparkles

RENDERING STYLE:
- Smooth cartoon shading (cel-shaded or soft gradient style)
- Rounded, appealing shapes - no harsh edges
- Big expressive eyes with shine/sparkle highlights
- Soft fluffy textures that look huggable
- Clean linework with soft shadows

CUTE PRESENTATION:
- Warm, inviting lighting
- Sparkles and magical particles
- Friendly approachable pose
- Soft background with magical atmosphere
- Emphasis on charm and personality

ELEMENTAL INTEGRATION:
- ${element} element as cute magical effects (sparkles, gentle glows, soft particles)
- Energy effects that look magical and whimsical, not harsh
- Colorful, vibrant elemental accents

STYLE REFERENCES:
- Pixar/Disney animated movie quality
- Mobile game character art (high quality)
- Anime-inspired fantasy creatures
- Pokemon/creature collector game aesthetics
- Cute fantasy art with mass appeal
- NEVER photorealistic - always stylized and animated`;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured in environment");
      return new Response(
        JSON.stringify({ 
          error: "AI service not configured. Please contact support.",
          code: "AI_SERVICE_NOT_CONFIGURED"
        }), 
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: 500 
        }
      );
    }

    console.log("Calling Lovable AI for image generation...");
    let aiResponse;
    try {
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash-image", messages: [{ role: "user", content: fullPrompt }], modalities: ["image", "text"] })
      });
    } catch (fetchError) {
      console.error("Network error calling AI service:", fetchError);
      return new Response(
        JSON.stringify({ 
          error: "Network error. Please check your connection and try again.",
          code: "NETWORK_ERROR"
        }), 
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: 503 
        }
      );
    }

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
    if (!imageUrl) {
      console.error("No image URL in AI response:", JSON.stringify(aiData));
      throw new Error("No image URL in response");
    }

    console.log("Image generated successfully, uploading to storage...");
    const base64Data = imageUrl.split(",")[1];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const filePath = `${user.id}/companion_${user.id}_stage${stage}_${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage.from("mentors-avatars").upload(filePath, binaryData, { contentType: "image/png", upsert: false });
    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage.from("mentors-avatars").getPublicUrl(filePath);
    console.log(`Companion image uploaded successfully: ${publicUrl}`);

    return new Response(JSON.stringify({ imageUrl: publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
