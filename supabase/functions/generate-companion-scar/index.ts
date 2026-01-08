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
    const { companionId, scarContext } = await req.json();

    if (!companionId) {
      throw new Error("Missing companionId");
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
      .select("current_image_url, scarred_image_url, spirit_animal, scars")
      .eq("id", companionId)
      .single();

    if (companionError || !companion) {
      throw new Error("Companion not found");
    }

    // Use scarred image if exists, otherwise use current image
    const baseImage = companion.scarred_image_url || companion.current_image_url;

    if (!baseImage) {
      throw new Error("No image to add scar to");
    }

    const scarCount = (companion.scars?.length || 0);
    
    console.log(`[Scar Image] Generating scar #${scarCount} for companion ${companionId}`);

    // Generate scarred version - subtle, tasteful marks that show history
    const editPrompt = `Add a subtle, tasteful scar or mark to this creature that tells a story of survival:
- Add ONE small, visible but not disfiguring mark
- The scar should look healed/faded, not fresh
- It should add character and depth, not ugliness
- Possible scar types: a small notch in an ear, a faded mark on the cheek, a subtle discoloration patch, a small healed scratch
- The scar should be placed naturally on the creature's body
- It should look like a badge of survival, not damage
- The overall creature should still look healthy and beautiful
- The scar should be subtle enough to miss at first glance but noticeable on close inspection
- Context: "${scarContext || 'A reminder of a time the bond was tested'}"
- Preserve all other features of the creature exactly as they are
- This scar is scar number ${scarCount + 1} - if previous scars are visible, add a new one in a different location`;

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
              { type: "image_url", image_url: { url: baseImage } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Scar Image] API error:", errorText);
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
    
    const fileName = `scarred/${companionId}-scar${scarCount + 1}-${Date.now()}.png`;
    
    const { error: uploadError } = await supabase.storage
      .from("companion-images")
      .upload(fileName, imageBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("[Scar Image] Upload error:", uploadError);
      throw uploadError;
    }

    const { data: publicUrl } = supabase.storage
      .from("companion-images")
      .getPublicUrl(fileName);

    // Update companion with scarred image (this becomes the new base for future scars)
    await supabase
      .from("user_companion")
      .update({ 
        scarred_image_url: publicUrl.publicUrl,
        // Also update current image so the scar persists
        current_image_url: publicUrl.publicUrl,
      })
      .eq("id", companionId);

    console.log(`[Scar Image] Generated scar #${scarCount + 1} for companion ${companionId}`);

    return new Response(
      JSON.stringify({ success: true, imageUrl: publicUrl.publicUrl, scarNumber: scarCount + 1 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Scar Image] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
