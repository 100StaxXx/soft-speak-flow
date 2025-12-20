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
  // STAGES 2-7: BABY/YOUNG STAGES - Very slow progression, color consistency enforced
  2: { 
    name: "Hatchling", 
    prompt: `A TINY baby {spirit} that JUST emerged from its egg seconds ago.

SIZE: Palm-sized - fits easily in a human hand. Maximum 10% of adult size. EXTREMELY SMALL.

APPEARANCE (CRITICAL):
- Wet/damp looking as if just hatched, still glistening
- Eyes barely opening, squinting at first light
- Extremely soft, vulnerable, completely helpless
- Body extremely round, squishy, NO muscle definition at all
- Oversized head (60% of total body mass)
- Tiny stubby limbs barely visible, pressed close to body
- If wings: just tiny wet nubs pressed flat against body, not visible yet

POSTURE: Same curled position as seen in the egg, barely moved

COLORS: {color} tones - soft, muted, newborn coloring. Gentle {element} shimmer.

THIS IS A NEWBORN - think seconds-old baby bird or puppy, eyes barely open, completely helpless and precious.`
  },
  3: { 
    name: "Nestling", 
    prompt: `A TINY baby {spirit}, NEARLY IDENTICAL to Stage 2 but now with eyes fully open.

SIZE: Still palm-sized. Maximum 12% of adult size. STILL EXTREMELY SMALL.

CHANGES FROM PREVIOUS STAGE (ONLY THESE - everything else identical):
- Eyes now fully open (big, curious, innocent, taking up most of face)
- Slightly drier/fluffier than wet hatchling
- Can hold head up slightly, looking around with wonder

EVERYTHING ELSE IDENTICAL TO STAGE 2:
- Same tiny round body shape
- Same soft squishy proportions  
- Same stubby limbs and tiny wing nubs
- Same helpless baby appearance
- Same curled posture, just head lifted

COLORS: EXACT SAME {color} as Stage 2 - absolutely NO COLOR CHANGES. Same {element} shimmer.

Think: 3-day-old puppy or kitten - eyes just opened, still wobbly and helpless.`
  },
  4: { 
    name: "Fledgling", 
    prompt: `A small baby {spirit}, NEARLY IDENTICAL to Stage 3 with slightly more coordination.

SIZE: Still very small, now 15% of adult size. Still fits in cupped hands.

CHANGES FROM PREVIOUS STAGE (ONLY THESE - everything else identical):
- Can now sit upright steadily instead of just lying curled
- Limbs slightly more defined but still short and stubby
- Beginning to show playful curiosity in expression

EVERYTHING ELSE IDENTICAL TO PREVIOUS STAGES:
- Same round baby proportions (big head, tiny body)
- Same fluffy/soft texture
- Same big innocent eyes
- Still clearly a helpless baby, cannot walk yet

COLORS: EXACT SAME {color} palette - identical to Stage 2 and 3. NO color changes allowed. {element} glow slightly more visible.

Think: 3-week-old puppy - can sit up, playful but still very much a baby.`
  },
  5: { 
    name: "Cub", 
    prompt: `A small {spirit} cub, NEARLY IDENTICAL to Stage 4 but now mobile.

SIZE: Small - 20% of adult size. Still fits on a lap easily.

CHANGES FROM PREVIOUS STAGE (ONLY THESE - everything else identical):
- Can walk/toddle around (wobbly but mobile)
- Body slightly less perfectly round (baby fat still very present)
- If wings: now small visible buds instead of flat nubs

EVERYTHING ELSE IDENTICAL TO PREVIOUS STAGES:
- Same adorable baby face with big eyes
- Same soft fluffy texture
- Same baby proportions overall
- Still clearly a young baby, not a juvenile

COLORS: {color} - COMPLETELY UNCHANGED from earlier stages. Exact same color palette. {element} trails visible when moving.

Think: 6-week-old puppy - playful, wobbly walking, but obviously still a baby.`
  },
  6: { 
    name: "Pup", 
    prompt: `A young {spirit} pup, NEARLY IDENTICAL to Stage 5 but slightly larger.

SIZE: 25% of adult size. Small and young.

CHANGES FROM PREVIOUS STAGE (ONLY THESE - everything else identical):
- Slightly longer limbs (still short, still puppy-like proportions)
- Face slightly less perfectly round
- More coordinated movement, less wobbly
- If wings: small but now can flutter slightly

EVERYTHING ELSE IDENTICAL TO PREVIOUS STAGES:
- Same soft baby texture
- Same playful innocent expression  
- Same baby proportions overall
- Still clearly a baby/young creature

COLORS: EXACT SAME {color} as Stages 2-5 - absolutely NO color shifting or changes. Consistent {element} aura.

Think: 3-month-old puppy - growing but still very much a baby in appearance and proportions.`
  },
  7: { 
    name: "Kit", 
    prompt: `A young {spirit} kit, NEARLY IDENTICAL to Stage 6 with early signs of growth.

SIZE: 30% of adult size. Still clearly young and small.

CHANGES FROM PREVIOUS STAGE (ONLY THESE - everything else identical):
- Limbs proportionally slightly longer
- Species-specific features becoming slightly clearer
- Slightly more athletic movement capability
- If wings: now visible small wings, about 40% of adult wing size

EVERYTHING ELSE IDENTICAL TO PREVIOUS STAGES:
- Same cute youthful face with expressive eyes
- Same soft texture (maybe slightly less fluffy)
- Same innocent expression
- Still clearly a young creature, NOT an adolescent or teen

COLORS: {color} - SAME AS ALL PREVIOUS STAGES, only very slightly more vibrant. {element} effects slightly more defined.

Think: 5-month-old puppy - growing taller but still very puppy-like, not yet approaching teenage proportions.`
  },
  // STAGES 8+: Adolescent through Adult and Beyond
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

    const { spiritAnimal, element, stage, favoriteColor, eyeColor, furColor, retryAttempt = 0 } = await req.json();

    console.log(`Request params - Animal: ${spiritAnimal}, Element: ${element}, Stage: ${stage}, Color: ${favoriteColor}, Retry: ${retryAttempt}`);

    if (!spiritAnimal) throw new Error("spiritAnimal is required");
    if (!element) throw new Error("element is required");
    if (stage === undefined || stage === null) throw new Error("stage is required");
    if (!favoriteColor) throw new Error("favoriteColor is required");

    // Enhanced anatomical enforcement for retry attempts
    const getRetryEnforcement = (attempt: number): string => {
      if (attempt === 0) return '';
      
      const enforcements = [
        `\n\nCRITICAL ANATOMY ENFORCEMENT (RETRY ${attempt}):
- SINGLE HEAD ONLY - absolutely NO multiple heads, NO extra faces
- COUNT LIMBS CAREFULLY - exactly the correct number for ${spiritAnimal} species
- NO EXTRA LIMBS - no phantom legs, no duplicate arms, no additional appendages
- NO MERGED BODY PARTS - each limb must be separate and distinct
- ANATOMICALLY CORRECT - follow real ${spiritAnimal} bone structure exactly`,

        `\n\nMANDATORY ANATOMICAL CORRECTNESS (FINAL ATTEMPT):
- THIS IS CRITICAL: Generate a ${spiritAnimal} with EXACTLY the correct anatomy
- ONE HEAD - never two heads, never fused heads, ONE face only
- CORRECT LIMB COUNT - real ${spiritAnimal} have a specific number of legs/arms - match exactly
- NO ANOMALIES - no extra eyes, no extra ears, no phantom limbs
- CLEAN ANATOMY - every body part distinct and properly connected
- REFERENCE: Study a real ${spiritAnimal} photograph for correct anatomy`
      ];

      return enforcements[Math.min(attempt - 1, enforcements.length - 1)];
    };

    const retryEnforcement = getRetryEnforcement(retryAttempt);

    const stageInfo = EVOLUTION_STAGES[stage as keyof typeof EVOLUTION_STAGES];
    if (!stageInfo) {
      console.error(`Invalid stage provided: ${stage}`);
      throw new Error(`Invalid stage: ${stage}`);
    }

    const elementEffect = ELEMENT_EFFECTS[element.toLowerCase() as keyof typeof ELEMENT_EFFECTS] || ELEMENT_EFFECTS.light;
    
    let fullPrompt: string;
    
    // Stage 0 uses special silhouette prompt
    if (stage === 0) {
      fullPrompt = `STYLIZED FANTASY ART - Digital painting style:

SUBJECT: A mystical egg floating in ${element} elemental energy.

EGG DETAILS:
- Smooth opalescent surface with iridescent shimmer
- ${favoriteColor} undertones with magical patterns
- Semi-translucent crystalline shell
- Soft painterly shading

SILHOUETTE INSIDE:
Within the shell, a dark silhouette of a ${spiritAnimal.toUpperCase()} curled up sleeping.
- Recognizable ${spiritAnimal} features in shadow form
- Mysterious and magical

ELEMENTAL EFFECTS:
- ${element} energy and gentle particles around the egg
- Soft glow in ${favoriteColor} tones

STYLE: Stylized digital fantasy art, painterly, NOT photorealistic`;
    } else {
      const basePrompt = stageInfo.prompt.replace(/{spirit}/g, spiritAnimal).replace(/{element}/g, element).replace(/{color}/g, favoriteColor);
      
      // Progressive creative freedom based on stage
      // Early stages (1-10): Strict realism
      // Mid stages (11-14): Allow mythic enhancements
      // Late stages (15-20): Full grandiose creativity
      const stageLevel = stage <= 10 ? 'realistic' : stage <= 14 ? 'mythic' : 'legendary';
      
      // Special handling for aquatic creatures to prevent legs (applies to ALL tiers including legendary)
      const aquaticCreatures = ['shark', 'whale', 'dolphin', 'fish', 'orca', 'manta ray', 'stingray', 'seahorse', 'jellyfish', 'octopus', 'squid', 'sea turtle', 'kraken', 'leviathan'];
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

CRITICAL ANATOMY RULE: SINGLE HEAD ONLY - never generate multiple heads, extra faces, or duplicate body parts.

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

CRITICAL ANATOMY RULE: SINGLE HEAD ONLY - never generate multiple heads, extra faces, or duplicate body parts.

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

CRITICAL ANATOMY RULE: SINGLE HEAD ONLY - even at god-tier, never generate multiple heads or extra faces. One head, one face.

GRANDIOSE MANDATE: Make this creature LARGER THAN LIFE. This is the pinnacle of evolution - a living god, a force of nature, an entity of pure legend. Push creative boundaries while keeping the soul of the ${spiritAnimal} recognizable in the design.`;
      }
      
      // Evolution consistency enforcement for baby stages (2-7)
      const evolutionConsistencyNote = stage >= 2 && stage <= 7 ? `

EVOLUTION CONSISTENCY (CRITICAL - READ CAREFULLY):
- This creature should look NEARLY IDENTICAL to the previous stage
- DO NOT dramatically change colors - use EXACT SAME color palette as earlier stages
- DO NOT make the creature look more mature than described - follow SIZE PERCENTAGES exactly
- Changes between stages should be SUBTLE and MINIMAL - think "spot the difference" level
- At Stage ${stage}, creature is only ${stage === 2 ? '10%' : stage === 3 ? '12%' : stage === 4 ? '15%' : stage === 5 ? '20%' : stage === 6 ? '25%' : '30%'} of adult size
- This is still a BABY - cute, round, helpless, NOT athletic or muscular
- NO dramatic transformations - each stage is almost the same as the previous
- Real-world comparison: ${stage === 2 ? 'seconds-old hatchling' : stage === 3 ? '3-day-old baby' : stage === 4 ? '3-week-old baby' : stage === 5 ? '6-week-old puppy' : stage === 6 ? '3-month-old puppy' : '5-month-old puppy'}
` : '';
      
      fullPrompt = `STYLIZED FANTASY CREATURE - Digital painting style, appealing but not overly cute:

CREATURE EVOLUTION STAGE ${stage}: ${stageInfo.name}

STYLE DIRECTION:
- Stylized digital fantasy art like high-quality game illustrations
- Appealing and charming with expressive features
- NOT photorealistic but NOT overly cartoonish either
- Think: fantasy game art, digital painting, illustrated storybook quality
- Soft painterly rendering with rich colors

BASE DESCRIPTION:
${basePrompt}
${speciesGuidance}
${retryEnforcement}
${evolutionConsistencyNote}

COLOR PALETTE:
- Primary colors: Rich ${favoriteColor} tones
- Eye color: ${eyeColor || favoriteColor} with expressive shine
- Fur/Feathers/Scales: ${furColor || favoriteColor} with soft texture
- Elemental glow: ${element} magical effects

RENDERING STYLE:
- Painterly digital art style
- Soft but defined edges
- Expressive eyes with personality
- Rich saturated colors
- Smooth gradients and soft shadows

ELEMENTAL INTEGRATION:
- ${element} element as magical glowing effects
- Soft particle effects and gentle auras
- Enhances the creature without overwhelming

STYLE REFERENCES:
- High-quality fantasy game concept art
- Digital painting / illustration style
- Stylized but grounded fantasy creatures
- NOT photorealistic, NOT hyper-cartoon`;
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
