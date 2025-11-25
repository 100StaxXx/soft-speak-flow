import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error('No user found');
    }

    const { 
      companionId, 
      evolutionId, 
      stage, 
      species, 
      element, 
      color,
      userAttributes // mind, body, soul
    } = await req.json();

    console.log('Generating evolution card for:', { companionId, stage, species, element });

    // Check if this companion already has cards with a name (to maintain consistency)
    const { data: existingCards } = await supabaseClient
      .from('companion_evolution_cards')
      .select('creature_name')
      .eq('companion_id', companionId)
      .order('evolution_stage', { ascending: true })
      .limit(1);

    const existingName = existingCards && existingCards.length > 0 ? existingCards[0].creature_name : null;
    console.log('Existing creature name:', existingName);

    // Generate card ID
    const randomHex = crypto.randomUUID().split('-')[0].toUpperCase();
    const cardId = `ALP-${species.toUpperCase()}-${user.id.split('-')[0].toUpperCase()}-E${stage}-${randomHex}`;

    // Determine rarity based on stage (21-stage system: 0-20)
    let rarity = 'Common';
    if (stage >= 19) rarity = 'Origin';       // Stage 19-20: Apex, Ultimate
    else if (stage >= 16) rarity = 'Primal';  // Stage 16-18: Regal, Eternal, Transcendent
    else if (stage >= 13) rarity = 'Celestial'; // Stage 13-15: Titan, Mythic, Prime
    else if (stage >= 10) rarity = 'Mythic';  // Stage 10-12: Champion, Ascended, Vanguard
    else if (stage >= 7) rarity = 'Legendary'; // Stage 7-9: Fledgling, Warrior, Guardian
    else if (stage >= 4) rarity = 'Epic';      // Stage 4-6: Juvenile, Apprentice, Scout
    else if (stage >= 1) rarity = 'Rare';      // Stage 1-3: Hatchling, Sproutling, Cub

    // Generate stats based on stage and average attribute (balanced)
    const baseStatValue = 20 + (stage * 8);
    const avgAttribute = (
      (userAttributes?.mind || 0) + 
      (userAttributes?.body || 0) + 
      (userAttributes?.soul || 0)
    ) / 3;
    
    const stats = {
      mind: Math.floor(baseStatValue + avgAttribute * 0.15),
      body: Math.floor(baseStatValue + avgAttribute * 0.15),
      soul: Math.floor(baseStatValue + avgAttribute * 0.15),
    };

    // Assign energy cost based on stage (0-9: 1, 10-14: 2, 15-20: 3)
    const energyCost = stage <= 9 ? 1 : stage <= 14 ? 2 : 3;

    // Generate frame type based on element
    const frameType = `${element.toLowerCase()}-frame`;

    // Use Lovable AI to generate creature name, traits, story, and lore seed
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const personality = userAttributes?.body > 60 ? 'powerful and energetic' :
                       userAttributes?.mind > 60 ? 'wise and focused' :
                       userAttributes?.soul > 60 ? 'compassionate and deeply connected' : 'mysterious and evolving';
    
    const vibes = stage >= 15 ? 'ancient, radiant, transcendent' :
                 stage >= 10 ? 'majestic, powerful, legendary' :
                 stage >= 5 ? 'fierce, loyal, determined' :
                 'curious, cute, eager';

    // Stage 20 Special: Generate personalized ultimate title
    let finalCreatureName = existingName;
    let skipAI = false;
    
    if (stage === 20 && !existingName) {
      // Generate ultimate personalized title for Stage 20 first evolution
      const powerTitles = ['Sovereign', 'Apex', 'Colossus', 'Warlord', 'Primeborn', 'Overlord', 'Sentinel', 'Emperor', 'Archon', 'Omega'];
      const randomTitle = powerTitles[Math.floor(Math.random() * powerTitles.length)];
      finalCreatureName = `${element} ${randomTitle} ${species}`;
      skipAI = true; // Use the generated title, no AI needed
      console.log('Generated Stage 20 ultimate title:', finalCreatureName);
    }

    let aiPrompt;
    
    if (existingName) {
      // Use existing name and generate story for evolution
      aiPrompt = `You are a master storyteller continuing the legend of a companion creature named "${existingName}".

CREATURE ATTRIBUTES:
- Name: ${existingName} (DO NOT CHANGE THIS)
- Species: ${species}
- Element: ${element}
- Evolution Stage: ${stage}/20 (evolved from stage ${stage - 1})
- Rarity: ${rarity}
- Personality: ${personality}

Generate a card with these exact fields in JSON:

{
  "creature_name": "${existingName}",
  "traits": ["3-5 dynamic trait names that reflect ${existingName}'s NEW abilities at stage ${stage}"],
  "story_text": "2-4 paragraphs telling how ${existingName} has evolved to stage ${stage}. Make it epic and personal, showing growth and new power.",
  "lore_seed": "One mysterious sentence about ${existingName}'s destiny or deeper mythology"
}

Make it LEGENDARY. ${existingName} is growing stronger.`;
    } else {
      // First evolution - generate a new name
      aiPrompt = `You are a master fantasy creature naming expert. Generate a UNIQUE, ORIGINAL creature name for this companion's FIRST evolution.

CREATURE ATTRIBUTES:
- Species: ${species}
- Element: ${element}
- Primary Color: ${color}
- Secondary Color: ${element} undertones
- Personality: ${personality}
- Vibes: ${vibes}
- Evolution Stage: ${stage}/20
- Rarity: ${rarity}

NAME GENERATION RULES:
• 1-2 words maximum
• Must be mythic, elegant, and slightly otherworldly
• Easy to pronounce
• NO references to Pokémon, Digimon, Marvel, Warcraft, or mythology
• NO real-world names
• NO numbers
• Must feel ORIGINAL and fresh
• Should evoke the creature's element, species, and personality

Generate a card with these exact fields in JSON:

{
  "creature_name": "Generate a unique name following all rules above. This will be permanent.",
  "traits": ["3-5 dynamic trait names that reflect the creature's abilities at stage ${stage}"],
  "story_text": "2-4 paragraphs telling the origin story of this newly awakened creature. Use the generated name throughout.",
  "lore_seed": "One mysterious sentence hinting at the creature's destiny, mentioning its name"
}

Make it LEGENDARY. This is the birth of a companion.`;
    }

    let cardData;
    
    if (skipAI) {
      // For Stage 20 ultimate form, use pre-generated title
      cardData = {
        creature_name: finalCreatureName,
        traits: ['Ultimate Power', 'Legendary Presence', 'Peak Evolution', 'Unstoppable Force', 'Eternal Bond'],
        story_text: `At the pinnacle of evolution, ${finalCreatureName} stands as the ultimate manifestation of power and bond. This legendary ${species} has transcended all limits, becoming a force of nature itself. The ${element.toLowerCase()} energy that flows through them is unmatched, a testament to the countless battles fought and lessons learned throughout their journey.\n\nTheir bond with their companion has reached its absolute peak, creating a connection that goes beyond the physical realm. Every action, every thought, perfectly synchronized. They are no longer just partners—they are one.\n\nThe world trembles at the mere presence of ${finalCreatureName}, not out of fear, but in awe of what dedication and perseverance can achieve. This is the ultimate form—the peak of all possibilities.`,
        lore_seed: `Legends speak of ${finalCreatureName} as the harbinger of a new era, where the boundaries between companion and master dissolve into pure unity.`
      };
      console.log('Using pre-generated Stage 20 card data');
    } else {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a creative card game designer. Always respond with valid JSON only.' },
          { role: 'user', content: aiPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

      const aiData = await aiResponse.json();
      const content = aiData.choices[0].message.content;
      
      // Parse JSON from AI response
      try {
        // Extract JSON if wrapped in markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
        const jsonString = jsonMatch ? jsonMatch[1] : content;
        cardData = JSON.parse(jsonString);
      } catch (e) {
        console.error('Failed to parse AI response:', content);
        throw new Error('AI response was not valid JSON');
      }
    }

    // Calculate bond level based on user attributes
    const totalAttributes = (userAttributes?.mind || 0) + 
                          (userAttributes?.body || 0) + 
                          (userAttributes?.soul || 0);
    const bondLevel = Math.min(100, Math.floor(10 + (totalAttributes / 3) + (stage * 2)));

    // Insert the card into database
    const { data: card, error: insertError } = await supabaseClient
      .from('companion_evolution_cards')
      .insert({
        card_id: cardId,
        user_id: user.id,
        companion_id: companionId,
        evolution_id: evolutionId,
        evolution_stage: stage,
        creature_name: cardData.creature_name,
        species: species,
        element: element,
        stats: stats,
        traits: cardData.traits,
        story_text: cardData.story_text,
        lore_seed: cardData.lore_seed,
        bond_level: bondLevel,
        rarity: rarity,
        frame_type: frameType,
        energy_cost: energyCost,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting card:', insertError);
      throw insertError;
    }

    console.log('Card generated successfully:', cardId);

    return new Response(
      JSON.stringify({ card }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-evolution-card:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});