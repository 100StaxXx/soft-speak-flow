import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { memorialId, companionData } = await req.json();

    if (!memorialId || !companionData) {
      throw new Error("Missing memorialId or companionData");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAIApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      companion_name, 
      spirit_animal, 
      core_element, 
      final_image_url,
      days_together,
      final_evolution_stage,
      death_cause 
    } = companionData;

    console.log(`[Memorial Image] Generating memorial for ${companion_name} the ${spirit_animal}`);

    // Generate a peaceful, ethereal memorial portrait
    const memorialPrompt = `Create a beautiful, ethereal memorial portrait of this creature:
- Transform the creature into a peaceful spirit form
- Add soft, glowing ethereal light surrounding it
- The creature should appear serene, at peace, almost translucent
- Add subtle star dust and cosmic particles floating around
- Include gentle aurora-like colors (soft purples, blues, silvers)
- The creature's eyes should be closed or looking peacefully upward
- Add a soft halo or gentle glow behind the head
- The overall mood should be bittersweet but beautiful - a celebration of their life
- Preserve the creature's distinctive features but make them appear more divine/celestial
- Add subtle wing-like ethereal wisps if appropriate for the creature
- The background should fade to a soft cosmic gradient
- Include tiny floating orbs of light like ascending souls/memories
- Element hint: ${core_element} - incorporate subtle ${core_element}-themed visual elements
- This creature lived for ${days_together} days and reached stage ${final_evolution_stage}
- Their departure: "${death_cause}" - the image should evoke peaceful rest`;

    let generatedImageUrl = final_image_url;

    // Try to generate memorial image, fall back to final image if API fails
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAIApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [
            {
              role: "user",
              content: final_image_url 
                ? [
                    { type: "text", text: memorialPrompt },
                    { type: "image_url", image_url: { url: final_image_url } },
                  ]
                : memorialPrompt,
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (generatedImage) {
          // Upload to Supabase Storage
          const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, "");
          const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          
          const fileName = `memorials/${memorialId}-${Date.now()}.png`;
          
          const { error: uploadError } = await supabase.storage
            .from("companion-images")
            .upload(fileName, imageBuffer, {
              contentType: "image/png",
              upsert: true,
            });

          if (!uploadError) {
            const { data: publicUrl } = supabase.storage
              .from("companion-images")
              .getPublicUrl(fileName);

            generatedImageUrl = publicUrl.publicUrl;
            console.log(`[Memorial Image] Successfully generated and uploaded memorial image`);
          } else {
            console.error("[Memorial Image] Upload error:", uploadError);
          }
        }
      } else {
        console.error("[Memorial Image] API response not ok:", response.status);
      }
    } catch (apiError) {
      console.error("[Memorial Image] API error, using final image:", apiError);
    }

    // Update the memorial with the generated image
    const { error: updateError } = await supabase
      .from("companion_memorials")
      .update({ memorial_image_url: generatedImageUrl })
      .eq("id", memorialId);

    if (updateError) {
      console.error("[Memorial Image] Failed to update memorial:", updateError);
      throw updateError;
    }

    console.log(`[Memorial Image] Memorial updated for ${companion_name}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: generatedImageUrl,
        message: `Memorial created for ${companion_name}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Memorial Image] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
