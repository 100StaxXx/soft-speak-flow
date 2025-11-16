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

    // Create a prompt for BACKGROUND ONLY (no text in the AI-generated image)
    const imagePrompt = `Create a beautiful, abstract background image for an inspirational quote poster:

Style: ${style}
Theme: ${themeStyle}
${emotionalTrigger ? `Emotional tone: ${emotionalTrigger}` : ""}

Visual requirements:
- High quality, professional abstract background
- NO TEXT OR LETTERS in the image
- Create only a decorative background suitable for overlaying text
- Aspect ratio: 9:16 portrait orientation (vertical, mobile-friendly)
- Color palette should evoke ${category} energy
- ${intensity} intensity level in colors and composition
- Modern, clean aesthetic
- Ensure the center area has good contrast for text overlay
- Optimized for social media story/reel format
- Abstract patterns, gradients, or subtle imagery
- Leave plenty of visual space in center for text

Create a striking background that will complement motivational text overlay.`;

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

    // Extract the background image from the response
    const backgroundUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!backgroundUrl) {
      throw new Error("No image generated in response");
    }

    // Create HTML canvas to overlay text on the background
    const htmlCanvas = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      width: 1080px; 
      height: 1920px; 
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .container {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: url('${backgroundUrl}') center/cover;
    }
    .overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%);
    }
    .content {
      position: relative;
      z-index: 1;
      padding: 120px 80px;
      text-align: center;
      color: white;
      text-shadow: 2px 2px 20px rgba(0,0,0,0.8);
      max-width: 920px;
    }
    .quote {
      font-size: ${intensity === 'gentle' ? '52px' : intensity === 'intense' ? '64px' : '56px'};
      line-height: 1.4;
      font-weight: ${intensity === 'intense' ? '800' : '600'};
      margin-bottom: 40px;
      word-wrap: break-word;
    }
    .author {
      font-size: 32px;
      font-weight: 400;
      opacity: 0.9;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="overlay"></div>
    <div class="content">
      <div class="quote">"${quoteText.replace(/"/g, '&quot;')}"</div>
      <div class="author">— ${(author || 'Unknown').replace(/"/g, '&quot;')}</div>
    </div>
  </div>
</body>
</html>`;

    // Convert HTML to base64 data URI
    const htmlBase64 = btoa(unescape(encodeURIComponent(htmlCanvas)));
    const compositeImageUrl = `data:text/html;base64,${htmlBase64}`;

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: compositeImageUrl,
        backgroundUrl,
        quote: quoteText,
        author,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error generating quote image:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to generate quote image",
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
