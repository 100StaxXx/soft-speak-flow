import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidationResult {
  valid: boolean;
  issues: string[];
  confidence: number;
  issueTypes: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, spiritAnimal, expectedLimbs } = await req.json();
    
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Validating companion image for species: ${spiritAnimal}`);

    // Determine expected anatomy based on species
    const aquaticCreatures = ['shark', 'whale', 'dolphin', 'fish', 'orca', 'manta ray', 'stingray', 'seahorse', 'jellyfish', 'octopus', 'squid', 'sea turtle', 'kraken', 'leviathan'];
    const isAquatic = aquaticCreatures.some(creature => spiritAnimal?.toLowerCase().includes(creature));
    
    const limbExpectation = isAquatic 
      ? "This is an AQUATIC creature - it should have ZERO legs/arms. Only fins and tail."
      : `This is a ${spiritAnimal} - count the limbs and verify they match the expected anatomy.`;

    const validationPrompt = `You are a quality assurance expert for AI-generated creature images. Analyze this creature image for ANATOMICAL ANOMALIES that would make it look wrong or disturbing.

SPECIES: ${spiritAnimal || 'unknown creature'}
${limbExpectation}

Check for these specific issues:

1. EXTRA LIMBS: Does the creature have MORE limbs than expected?
   - Count all legs, arms, wings, fins carefully
   - Look for phantom limbs or duplicated appendages
   - ${isAquatic ? 'Aquatic creatures should have NO legs at all' : 'Quadrupeds should have exactly 4 legs'}

2. MULTIPLE HEADS: Does the creature have MORE than ONE head?
   - Look for duplicate faces, extra heads, or merged heads
   - Check for additional eyes in wrong places

3. MERGED/FUSED BODY PARTS: Are there limbs or features that are incorrectly merged?
   - Two limbs becoming one
   - Faces merged together
   - Body parts in wrong locations

4. ANATOMICAL DEFORMITIES: Are there obvious physical errors?
   - Limbs bending wrong way
   - Missing essential body parts
   - Grossly incorrect proportions

5. WRONG SPECIES: Does this look like the intended species (${spiritAnimal})?
   - If it's supposed to be a wolf, does it look like a wolf?
   - Has it turned into a completely different animal?

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "valid": true/false,
  "confidence": 0-100,
  "issues": ["issue 1 description", "issue 2 description"],
  "issueTypes": ["extra_limbs", "multiple_heads", "deformity", "wrong_species", "merged_parts"]
}

Set "valid" to false if confidence of ANY issue is above 70%.
Only include issueTypes that are actually detected.
Be strict - if something looks off, flag it.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: validationPrompt },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      console.error("Vision API error:", response.status);
      // If validation fails, default to accepting the image (don't block on validation errors)
      return new Response(
        JSON.stringify({ valid: true, issues: [], confidence: 0, issueTypes: [], error: "Validation service unavailable" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    console.log("Raw validation response:", content);

    // Parse the JSON response
    let validationResult: ValidationResult;
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();
      
      validationResult = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse validation response:", parseError);
      // Default to accepting if we can't parse
      validationResult = { valid: true, issues: [], confidence: 0, issueTypes: [] };
    }

    console.log(`Validation result: valid=${validationResult.valid}, confidence=${validationResult.confidence}, issues=${validationResult.issues?.length || 0}`);

    return new Response(
      JSON.stringify(validationResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Validation error:", error);
    // On error, default to accepting the image
    return new Response(
      JSON.stringify({ valid: true, issues: [], confidence: 0, issueTypes: [], error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
