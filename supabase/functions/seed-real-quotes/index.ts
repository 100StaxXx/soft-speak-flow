import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Curated real motivational quotes organized by category and intensity
const REAL_QUOTES = [
  // DISCIPLINE - Intense
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn", category: "discipline", intensity: "intense", triggers: ["Needing Discipline", "Avoiding Action"] },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle", category: "discipline", intensity: "intense", triggers: ["Needing Discipline"] },
  { text: "The difference between who you are and who you want to be is what you do.", author: "Unknown", category: "discipline", intensity: "moderate", triggers: ["Needing Discipline", "Feeling Stuck"] },
  
  // CONFIDENCE - Various intensities
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt", category: "confidence", intensity: "moderate", triggers: ["Self-Doubt", "Anxious & Overthinking"] },
  { text: "You are braver than you believe, stronger than you seem, and smarter than you think.", author: "A.A. Milne", category: "confidence", intensity: "gentle", triggers: ["Self-Doubt", "Heavy or Low"] },
  { text: "Act as if what you do makes a difference. It does.", author: "William James", category: "confidence", intensity: "moderate", triggers: ["Self-Doubt", "Unmotivated"] },
  { text: "No one can make you feel inferior without your consent.", author: "Eleanor Roosevelt", category: "confidence", intensity: "intense", triggers: ["Self-Doubt", "Emotionally Hurt"] },
  
  // FOCUS - Various intensities
  { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee", category: "focus", intensity: "intense", triggers: ["Anxious & Overthinking", "Avoiding Action"] },
  { text: "Concentrate all your thoughts upon the work in hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell", category: "focus", intensity: "moderate", triggers: ["Anxious & Overthinking"] },
  { text: "It's not always that we need to do more but rather that we need to focus on less.", author: "Nathan W. Morris", category: "focus", intensity: "gentle", triggers: ["Exhausted", "Anxious & Overthinking"] },
  
  // MINDSET - Various intensities
  { text: "The mind is everything. What you think you become.", author: "Buddha", category: "mindset", intensity: "moderate", triggers: ["Self-Doubt", "Feeling Stuck"] },
  { text: "Whether you think you can, or you think you can't – you're right.", author: "Henry Ford", category: "mindset", intensity: "intense", triggers: ["Self-Doubt", "Avoiding Action"] },
  { text: "Your limitation—it's only your imagination.", author: "Unknown", category: "mindset", intensity: "intense", triggers: ["Feeling Stuck", "Self-Doubt"] },
  { text: "Change your thoughts and you change your world.", author: "Norman Vincent Peale", category: "mindset", intensity: "gentle", triggers: ["Heavy or Low", "In Transition"] },
  
  // BUSINESS - Various intensities
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney", category: "business", intensity: "intense", triggers: ["Avoiding Action", "Needing Discipline"] },
  { text: "Opportunities don't happen. You create them.", author: "Chris Grosser", category: "business", intensity: "intense", triggers: ["Motivated & Ready", "Needing Discipline"] },
  { text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller", category: "business", intensity: "moderate", triggers: ["In Transition", "Feeling Stuck"] },
  { text: "Success is not final; failure is not fatal: It is the courage to continue that counts.", author: "Winston S. Churchill", category: "business", intensity: "moderate", triggers: ["Frustrated", "Emotionally Hurt"] },
  
  // PHYSIQUE - Various intensities
  { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn", category: "physique", intensity: "gentle", triggers: ["Exhausted", "Heavy or Low"] },
  { text: "The only bad workout is the one that didn't happen.", author: "Unknown", category: "physique", intensity: "moderate", triggers: ["Avoiding Action", "Unmotivated"] },
  { text: "Your body can stand almost anything. It's your mind that you have to convince.", author: "Unknown", category: "physique", intensity: "intense", triggers: ["Needing Discipline", "Self-Doubt"] },
  { text: "Strength doesn't come from what you can do. It comes from overcoming the things you once thought you couldn't.", author: "Rikki Rogers", category: "physique", intensity: "moderate", triggers: ["Self-Doubt", "Motivated & Ready"] },
  
  // GENERAL MOTIVATION - For all triggers
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson", category: "discipline", intensity: "moderate", triggers: ["Exhausted", "Avoiding Action"] },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar", category: "confidence", intensity: "gentle", triggers: ["Anxious & Overthinking", "Avoiding Action"] },
  { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins", category: "mindset", intensity: "moderate", triggers: ["Feeling Stuck", "In Transition"] },
  { text: "Everything you've ever wanted is on the other side of fear.", author: "George Addair", category: "confidence", intensity: "intense", triggers: ["Anxious & Overthinking", "Self-Doubt"] },
  { text: "Fall seven times and stand up eight.", author: "Japanese Proverb", category: "mindset", intensity: "moderate", triggers: ["Emotionally Hurt", "Frustrated", "Heavy or Low"] },
  { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson", category: "confidence", intensity: "gentle", triggers: ["Heavy or Low", "Self-Doubt"] },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb", category: "discipline", intensity: "gentle", triggers: ["In Transition", "Feeling Stuck"] },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius", category: "discipline", intensity: "gentle", triggers: ["Exhausted", "Unmotivated"] },
  { text: "Do not wait to strike till the iron is hot; but make it hot by striking.", author: "William Butler Yeats", category: "business", intensity: "intense", triggers: ["Avoiding Action", "Motivated & Ready"] },
  { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma", category: "discipline", intensity: "gentle", triggers: ["Exhausted", "Needing Discipline"] },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all mentors to assign quotes
    const { data: mentors } = await supabase
      .from("mentors")
      .select("id, slug, tags");

    if (!mentors || mentors.length === 0) {
      throw new Error("No mentors found");
    }

    // Prepare quotes with mentor assignments
    const quotesToInsert = REAL_QUOTES.map((quote) => {
      // Find mentors that match the quote's category
      const matchingMentors = mentors.filter((mentor) =>
        mentor.tags?.some((tag: string) => 
          tag.toLowerCase().includes(quote.category.toLowerCase())
        )
      );

      // Pick a random matching mentor or null
      const mentorId = matchingMentors.length > 0
        ? matchingMentors[Math.floor(Math.random() * matchingMentors.length)].id
        : null;

      return {
        text: quote.text,
        author: quote.author,
        category: quote.category,
        intensity: quote.intensity,
        emotional_triggers: quote.triggers,
        mentor_id: mentorId,
        is_premium: false,
      };
    });

    // Insert quotes (upsert to avoid duplicates based on text)
    const { data, error } = await supabase
      .from("quotes")
      .upsert(quotesToInsert, {
        onConflict: "text",
        ignoreDuplicates: true,
      })
      .select();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully seeded ${data?.length || 0} real quotes`,
        quotes: data,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error seeding quotes:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
