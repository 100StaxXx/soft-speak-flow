import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const zodiacPrompts = [
  { sign: "aries", prompt: "A white ram with curved horns in a dynamic leaping pose, white line art illustration on dark purple starry background, simple elegant silhouette style" },
  { sign: "taurus", prompt: "A white bull in a strong walking pose with prominent horns, white line art illustration on dark purple starry background, simple elegant silhouette style" },
  { sign: "gemini", prompt: "Two white figures representing twins standing side by side holding wheat stalks, white line art illustration on dark purple starry background, simple elegant silhouette style" },
  { sign: "cancer", prompt: "A white crab with detailed claws in natural pose, white line art illustration on dark purple starry background, simple elegant silhouette style" },
  { sign: "leo", prompt: "A white lion with flowing mane in regal walking pose, white line art illustration on dark purple starry background, simple elegant silhouette style" },
  { sign: "virgo", prompt: "A white maiden figure in flowing robes holding wheat stalks with wings, white line art illustration on dark purple starry background, simple elegant silhouette style" },
  { sign: "libra", prompt: "A white figure kneeling while holding balanced scales, white line art illustration on dark purple starry background, simple elegant silhouette style" },
  { sign: "scorpio", prompt: "A white scorpion with detailed segmented tail curved upward, white line art illustration on dark purple starry background, simple elegant silhouette style" },
  { sign: "sagittarius", prompt: "A white centaur archer drawing a bow, half-human half-horse, white line art illustration on dark purple starry background, simple elegant silhouette style" },
  { sign: "capricorn", prompt: "A white sea-goat with horns and fish tail, mystical hybrid creature, white line art illustration on dark purple starry background, simple elegant silhouette style" },
  { sign: "aquarius", prompt: "A white water bearer figure pouring water from a vessel, kneeling pose, white line art illustration on dark purple starry background, simple elegant silhouette style" },
  { sign: "pisces", prompt: "Two white fish swimming in opposite circular directions forming yin-yang, white line art illustration on dark purple starry background, simple elegant silhouette style" }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { zodiacSign } = await req.json();
    
    const zodiacData = zodiacPrompts.find(z => z.sign === zodiacSign);
    if (!zodiacData) {
      throw new Error(`Invalid zodiac sign: ${zodiacSign}`);
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: zodiacData.prompt
          }
        ],
        modalities: ["image", "text"]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI generation failed:", response.status, errorText);
      
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (response.status === 402) {
        throw new Error("Insufficient AI credits.");
      }
      
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error("Failed to generate image");
    }

    return new Response(
      JSON.stringify({ imageUrl, sign: zodiacSign }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating zodiac image:', error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
