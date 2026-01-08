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
    const { companionId, userId } = await req.json();

    if (!companionId || !userId) {
      throw new Error("Missing companionId or userId");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get companion data
    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select("current_image_url, dormant_image_url, spirit_animal, companion_name")
      .eq("id", companionId)
      .single();

    if (companionError || !companion) {
      throw new Error("Companion not found");
    }

    // If already has dormant image, return it
    if (companion.dormant_image_url) {
      return new Response(
        JSON.stringify({ success: true, imageUrl: companion.dormant_image_url, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!companion.current_image_url) {
      throw new Error("No current image to base dormant image on");
    }

    console.log(`[Dormant Image] Generating for companion ${companionId}`);

    // Generate dormant/sleeping version of the companion
    const editPrompt = `Transform this creature into a peaceful sleeping state:
- Eyes gently closed, serene expression
- Curled up in a comfortable resting position
- Soft, muted colors with a slight blue-grey tint suggesting deep sleep
- Gentle breathing visible through subtle chest movement suggestion
- Surrounded by soft shadow or comfortable darkness
- Dreamlike atmosphere with subtle stardust or sleep particles
- Peaceful but with a hint of waiting/longing
- The creature should look like it's in a deep, protective slumber
- Preserve the core identity and features of the creature
- Add a subtle ethereal glow suggesting the spirit is dormant but alive`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: editPrompt },
              { type: "image_url", image_url: { url: companion.current_image_url } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Dormant Image] API error:", errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImage) {
      throw new Error("No image generated");
    }

    // Upload to Supabase Storage
    const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const fileName = `dormant/${companionId}-${Date.now()}.png`;
    
    const { error: uploadError } = await supabase.storage
      .from("companion-images")
      .upload(fileName, imageBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("[Dormant Image] Upload error:", uploadError);
      throw uploadError;
    }

    const { data: publicUrl } = supabase.storage
      .from("companion-images")
      .getPublicUrl(fileName);

    // Update companion with dormant image
    await supabase
      .from("user_companion")
      .update({ dormant_image_url: publicUrl.publicUrl })
      .eq("id", companionId);

    console.log(`[Dormant Image] Generated and saved for companion ${companionId}`);

    return new Response(
      JSON.stringify({ success: true, imageUrl: publicUrl.publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Dormant Image] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
