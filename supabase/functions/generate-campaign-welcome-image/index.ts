import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    
    if (!userId) {
      throw new Error('userId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if user already has a cached welcome image
    const { data: existingImage } = await supabase
      .from('user_welcome_images')
      .select('image_url')
      .eq('user_id', userId)
      .single();
    
    if (existingImage?.image_url) {
      console.log('Returning cached welcome image for user:', userId);
      return new Response(
        JSON.stringify({ imageUrl: existingImage.image_url, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Generating new welcome image for user:', userId);
    
    // Generate the image using Lovable AI with next-gen model for higher quality
    const prompt = `9:16 portrait aspect ratio full-screen mobile wallpaper. Mystical cosmic adventure scene - a glowing ethereal portal gateway at center-bottom third, surrounded by swirling nebula clouds in deep purples, cosmic blues, and subtle pink hues. Starfield with sparkling stars, floating magical particles, mystical path leading to the portal. Fantasy adventure theme, atmospheric depth, cinematic lighting. No text, no characters, no UI elements. Ultra high resolution, 4K quality, sharp details, professional digital art. Dreamy ethereal fantasy art style.`;
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageData) {
      throw new Error('No image generated from AI');
    }
    
    // Extract base64 data and upload to storage
    const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid image data format');
    }
    
    const [, imageFormat, base64Data] = base64Match;
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const fileName = `welcome-${userId}-${Date.now()}.${imageFormat}`;
    const filePath = `campaign-welcome/${fileName}`;
    
    // Upload to journey-paths bucket (reusing existing bucket)
    const { error: uploadError } = await supabase.storage
      .from('journey-paths')
      .upload(filePath, imageBytes, {
        contentType: `image/${imageFormat}`,
        upsert: true,
      });
    
    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('journey-paths')
      .getPublicUrl(filePath);
    
    const imageUrl = urlData.publicUrl;
    
    // Cache the image URL in database
    const { error: insertError } = await supabase
      .from('user_welcome_images')
      .upsert({
        user_id: userId,
        image_url: imageUrl,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    
    if (insertError) {
      console.error('Database insert error:', insertError);
      // Don't throw - we still have the image URL
    }
    
    console.log('Successfully generated welcome image:', imageUrl);
    
    return new Response(
      JSON.stringify({ imageUrl, cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating welcome image:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});