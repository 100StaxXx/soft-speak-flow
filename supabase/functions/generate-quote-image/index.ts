import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { quoteText, author, category, intensity, emotionalTrigger } = await req.json();

    if (!quoteText) {
      throw new Error("Quote text is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Build visual style based on context
    const intensityStyles = {
      gentle: "soft gradients, warm pastel colors, gentle lighting, calm atmosphere",
      moderate: "balanced colors, clear composition, motivational energy",
      intense: "bold colors, dramatic lighting, powerful imagery, high contrast",
    };

    const categoryStyles = {
      discipline: "structured geometric patterns, strong lines, military-inspired, determination",
      confidence: "uplifting imagery, bright colors, empowering symbols, self-assured",
      physique: "athletic imagery, dynamic movement, strength symbols, energetic",
      focus: "minimal distractions, centered composition, clarity, zen-like",
      mindset: "abstract thought imagery, neural patterns, enlightenment symbols",
      business: "professional, success symbols, growth charts, leadership imagery",
    };

    const style = intensityStyles[intensity as keyof typeof intensityStyles] || intensityStyles.moderate;
    const themeStyle = categoryStyles[category as keyof typeof categoryStyles] || "";

    // Create a prompt for a complete quote image with text embedded
    const imagePrompt = `Create a beautiful inspirational quote image with the following text prominently displayed:

"${quoteText}"
${author ? `— ${author}` : ''}

Style: ${style}
Theme: ${themeStyle}
${emotionalTrigger ? `Emotional tone: ${emotionalTrigger}` : ""}

Visual requirements:
- High quality, professional motivational poster design
- The quote text must be CLEARLY READABLE and PERFECTLY SPELLED
- Use elegant, professional typography
- Aspect ratio: 1080x1920 (9:16 portrait, mobile-friendly)
- ${intensity} intensity level in colors and composition
- Color palette should evoke ${category} energy
- Modern, inspirational aesthetic
- Text should be the main focal point, centered and prominent
- Beautiful background that complements but doesn't overpower the text
- Ensure proper text contrast against the background
- Professional social media story/reel format

CRITICAL: The text must be spelled EXACTLY as written above with perfect accuracy.`;

    console.log("Generating image with prompt:", imagePrompt);

    // Call Lovable AI image generation endpoint
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: imagePrompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (response.status === 402) {
        throw new Error("AI credits required. Please add credits to continue.");
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received");

    // Extract the image from the response
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error("No image generated in response");
    }

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl,
        quote: quoteText,
        author,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating quote image:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate quote image";
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
