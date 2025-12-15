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
    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate week boundaries (previous Mon-Sun)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToLastSunday = dayOfWeek === 0 ? 0 : dayOfWeek;
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - daysToLastSunday);
    
    const weekEnd = new Date(lastSunday);
    weekEnd.setDate(lastSunday.getDate() - 1); // Saturday
    
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6); // Previous Monday

    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    console.log(`Generating recap for ${userId}: ${weekStartStr} to ${weekEndStr}`);

    // Check if recap already exists
    const { data: existingRecap } = await supabase
      .from("weekly_recaps")
      .select("id")
      .eq("user_id", userId)
      .eq("week_start_date", weekStartStr)
      .single();

    if (existingRecap) {
      return new Response(JSON.stringify({ success: true, message: "Recap already exists" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch morning check-ins
    const { data: checkIns } = await supabase
      .from("daily_check_ins")
      .select("check_in_date, mood")
      .eq("user_id", userId)
      .eq("check_in_type", "morning")
      .gte("check_in_date", weekStartStr)
      .lte("check_in_date", weekEndStr);

    // Fetch evening reflections
    const { data: reflections } = await supabase
      .from("evening_reflections")
      .select("reflection_date, mood, wins, gratitude")
      .eq("user_id", userId)
      .gte("reflection_date", weekStartStr)
      .lte("reflection_date", weekEndStr);

    // Fetch completed quests
    const { data: quests } = await supabase
      .from("daily_tasks")
      .select("id")
      .eq("user_id", userId)
      .eq("completed", true)
      .gte("task_date", weekStartStr)
      .lte("task_date", weekEndStr);

    // Fetch completed habits
    const { data: habits } = await supabase
      .from("habit_completions")
      .select("id")
      .eq("user_id", userId)
      .gte("date", weekStartStr)
      .lte("date", weekEndStr);

    // Build mood data
    const morningMoods = (checkIns || []).map((c) => ({
      date: c.check_in_date,
      mood: c.mood || "okay",
    }));

    const eveningMoods = (reflections || []).map((r) => ({
      date: r.reflection_date,
      mood: r.mood,
    }));

    // Calculate trend
    const allMoods = [...morningMoods, ...eveningMoods].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const moodScore: Record<string, number> = {
      great: 5, good: 4, okay: 3, low: 2, rough: 1,
      energized: 5, calm: 4, anxious: 2, grateful: 5, motivated: 5,
    };
    
    let trend: "improving" | "stable" | "declining" = "stable";
    if (allMoods.length >= 4) {
      const firstHalf = allMoods.slice(0, Math.floor(allMoods.length / 2));
      const secondHalf = allMoods.slice(Math.floor(allMoods.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, m) => sum + (moodScore[m.mood] || 3), 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, m) => sum + (moodScore[m.mood] || 3), 0) / secondHalf.length;
      
      if (secondAvg - firstAvg > 0.5) trend = "improving";
      else if (firstAvg - secondAvg > 0.5) trend = "declining";
    }

    // Extract wins
    const wins = (reflections || [])
      .filter((r) => r.wins)
      .map((r) => r.wins as string);

    // Extract gratitude themes (simple keyword extraction)
    const gratitudeText = (reflections || [])
      .filter((r) => r.gratitude)
      .map((r) => r.gratitude as string)
      .join(" ");

    const commonThemes = ["family", "friends", "health", "work", "nature", "rest", "progress", "support", "love", "peace"];
    const gratitudeThemes = commonThemes.filter((theme) =>
      gratitudeText.toLowerCase().includes(theme)
    );

    // Stats
    const stats = {
      checkIns: checkIns?.length || 0,
      reflections: reflections?.length || 0,
      quests: quests?.length || 0,
      habits: habits?.length || 0,
    };

    // Generate mentor insight
    let mentorInsight = null;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (LOVABLE_API_KEY && (stats.checkIns > 0 || stats.reflections > 0)) {
      // Fetch user's mentor
      const { data: profile } = await supabase
        .from("profiles")
        .select("selected_mentor_id")
        .eq("id", userId)
        .single();

      let mentorTone = "warm and supportive";
      let mentorName = "Your Mentor";
      
      if (profile?.selected_mentor_id) {
        const { data: mentor } = await supabase
          .from("mentors")
          .select("name, tone_description")
          .eq("id", profile.selected_mentor_id)
          .single();

        if (mentor) {
          mentorTone = mentor.tone_description || mentorTone;
          mentorName = mentor.name;
        }
      }

      const prompt = `You are ${mentorName}, a wellness mentor with the following tone: ${mentorTone}

Review this user's week:
- Mood trend: ${trend}
- Morning check-ins: ${stats.checkIns}
- Evening reflections: ${stats.reflections}
- Quests completed: ${stats.quests}
- Habits completed: ${stats.habits}
${wins.length > 0 ? `- Key wins: ${wins.slice(0, 3).join("; ")}` : ""}
${gratitudeThemes.length > 0 ? `- Gratitude themes: ${gratitudeThemes.join(", ")}` : ""}

Write a brief, personalized weekly insight (3-4 sentences). Acknowledge their progress, validate their experience, and offer gentle encouragement for the week ahead. Be specific to what they shared.`;

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a supportive wellness mentor writing weekly recaps. Be warm, specific, and encouraging." },
              { role: "user", content: prompt },
            ],
            max_tokens: 300,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          mentorInsight = aiData.choices?.[0]?.message?.content?.trim();
        }
      } catch (e) {
        console.error("AI generation failed:", e);
      }
    }

    // Insert recap
    const { data: recap, error: insertError } = await supabase
      .from("weekly_recaps")
      .insert({
        user_id: userId,
        week_start_date: weekStartStr,
        week_end_date: weekEndStr,
        mood_data: {
          morning: morningMoods,
          evening: eveningMoods,
          trend,
        },
        gratitude_themes: gratitudeThemes,
        win_highlights: wins.slice(0, 5),
        stats,
        mentor_insight: mentorInsight,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert recap:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create recap" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, recap }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-weekly-recap:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});