import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const zodiacPrompts = [
  { sign: "aries", prompt: "A majestic white ram with elegant curved horns in a mystical cosmic style, white line art on dark purple background, ethereal and glowing" },
  { sign: "taurus", prompt: "A powerful white bull with strong horns in a mystical cosmic style, white line art on dark purple background, ethereal and glowing" },
  { sign: "gemini", prompt: "Two ethereal white figures representing twins in a mystical cosmic style, white line art on dark purple background, graceful and flowing" },
  { sign: "cancer", prompt: "An elegant white crab with delicate claws in a mystical cosmic style, white line art on dark purple background, ethereal and glowing" },
  { sign: "leo", prompt: "A regal white lion with a magnificent mane in a mystical cosmic style, white line art on dark purple background, powerful and glowing" },
  { sign: "virgo", prompt: "A graceful white maiden figure in a mystical cosmic style, white line art on dark purple background, elegant and ethereal" },
  { sign: "libra", prompt: "Balanced white scales in a mystical cosmic style, white line art on dark purple background, harmonious and glowing" },
  { sign: "scorpio", prompt: "A striking white scorpion with curved tail in a mystical cosmic style, white line art on dark purple background, mysterious and glowing" },
  { sign: "sagittarius", prompt: "A white centaur archer figure in a mystical cosmic style, white line art on dark purple background, dynamic and ethereal" },
  { sign: "capricorn", prompt: "A mystical white sea-goat with horns in a mystical cosmic style, white line art on dark purple background, wise and glowing" },
  { sign: "aquarius", prompt: "A white water bearer figure pouring celestial water in a mystical cosmic style, white line art on dark purple background, flowing and ethereal" },
  { sign: "pisces", prompt: "Two white fish swimming in opposite directions in a mystical cosmic style, white line art on dark purple background, graceful and glowing" }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const { zodiacSign } = await req.json();
    
    const zodiacData = zodiacPrompts.find(z => z.sign === zodiacSign);
    if (!zodiacData) {
      throw new Error(`Invalid zodiac sign: ${zodiacSign}`);
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error("Failed to generate image");
    }

    return new Response(
      JSON.stringify({ imageUrl, sign: zodiacSign }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error generating zodiac image:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});