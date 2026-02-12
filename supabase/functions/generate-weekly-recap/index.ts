import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mentorNarrativeProfiles, getMentorNarrativeProfile } from "../_shared/mentorNarrativeProfiles.ts";

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

    // Helper for timezone-safe date formatting
    const formatLocalDate = (date: Date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    // Calculate week boundaries (previous Mon-Sun, matching frontend)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, etc.
    
    // Get Monday of current week
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - daysToMonday);
    
    // Get Monday of previous week
    const weekStart = new Date(currentMonday);
    weekStart.setDate(currentMonday.getDate() - 7);
    
    // Get Sunday of previous week (Mon + 6 days)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekStartStr = formatLocalDate(weekStart);
    const weekEndStr = formatLocalDate(weekEnd);

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

    // Fetch morning check-ins with intentions
    const { data: checkIns } = await supabase
      .from("daily_check_ins")
      .select("check_in_date, mood, intention")
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

    // Don't create a recap if user has no activity this week
    const totalActivity = stats.checkIns + stats.reflections + stats.quests + stats.habits;
    if (totalActivity === 0) {
      console.log(`Skipping recap for ${userId}: no activity this week`);
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true,
        message: "No activity to recap" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate mentor story
    let mentorInsight = null;
    let mentorStory = null;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (OPENAI_API_KEY && (stats.checkIns > 0 || stats.reflections > 0)) {
      // Fetch user's mentor
      const { data: profile } = await supabase
        .from("profiles")
        .select("selected_mentor_id")
        .eq("id", userId)
        .single();

      let mentorSlug = "eli"; // default
      let mentorName = "Your Mentor";
      let narrativeProfile = getMentorNarrativeProfile("eli");
      
      if (profile?.selected_mentor_id) {
        const { data: mentor } = await supabase
          .from("mentors")
          .select("name, slug, tone_description")
          .eq("id", profile.selected_mentor_id)
          .single();

        if (mentor) {
          mentorSlug = mentor.slug;
          mentorName = mentor.name;
          narrativeProfile = getMentorNarrativeProfile(mentor.slug) || narrativeProfile;
        }
      }

      // Build detailed mood journey
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const moodJourneyEntries: string[] = [];
      
      // Group moods by date
      const moodsByDate = new Map<string, { morning?: string; evening?: string }>();
      morningMoods.forEach(m => {
        if (!moodsByDate.has(m.date)) moodsByDate.set(m.date, {});
        moodsByDate.get(m.date)!.morning = m.mood;
      });
      eveningMoods.forEach(m => {
        if (!moodsByDate.has(m.date)) moodsByDate.set(m.date, {});
        moodsByDate.get(m.date)!.evening = m.mood;
      });
      
      // Sort by date and format
      const sortedDates = Array.from(moodsByDate.keys()).sort();
      sortedDates.forEach(date => {
        const dayName = dayNames[new Date(date).getDay()];
        const moods = moodsByDate.get(date)!;
        const parts: string[] = [];
        if (moods.morning) parts.push(`morning: ${moods.morning}`);
        if (moods.evening) parts.push(`evening: ${moods.evening}`);
        if (parts.length > 0) {
          moodJourneyEntries.push(`${dayName}: ${parts.join(" → ")}`);
        }
      });
      
      const moodJourneyText = moodJourneyEntries.length > 0 
        ? moodJourneyEntries.join("\n") 
        : "No mood entries this week";
      
      // Extract intentions
      const intentions = (checkIns || [])
        .filter(c => c.intention)
        .map(c => c.intention as string);
      const intentionsText = intentions.length > 0 
        ? intentions.join("; ") 
        : null;
      
      // Get full gratitude entries
      const fullGratitudeEntries = (reflections || [])
        .filter(r => r.gratitude)
        .map(r => r.gratitude as string);
      const gratitudeTextFull = fullGratitudeEntries.length > 0 
        ? fullGratitudeEntries.join("; ") 
        : null;
      
      // Get all wins
      const allWins = wins.length > 0 ? wins.join("; ") : null;

      // Build the storytelling prompt using mentor narrative profile
      const storyPrompt = `You are ${mentorName}, reflecting on a week shared with someone you deeply care about guiding.

YOUR VOICE & STYLE:
${narrativeProfile?.narrativeVoice || "Warm and supportive"}

YOUR SPEECH PATTERNS:
${narrativeProfile?.speechPatterns?.map(p => `- ${p}`).join("\n") || "- Speaks with warmth and encouragement"}

YOUR WISDOM STYLE:
${narrativeProfile?.wisdomStyle || "Supportive guidance"}

EXAMPLE OF HOW YOU SPEAK:
${narrativeProfile?.exampleDialogue?.slice(0, 2).join("\n") || '"I see you. I believe in you."'}

---

THE WEEK'S JOURNEY:

## Day-by-Day Mood Flow
${moodJourneyText}
Overall arc: ${trend === "improving" ? "Rising energy and spirits" : trend === "declining" ? "Some challenges along the way" : "Steady and grounded"}

## Morning Intentions Set
${intentionsText || "They moved through the week with quiet purpose"}

## Victories Celebrated
${allWins || "Small wins, even if unspoken"}

## Gratitude Expressed
${gratitudeTextFull || "Moments of appreciation, felt if not named"}

## The Numbers Tell a Story
- ${stats.checkIns} mornings began with intention
- ${stats.reflections} evenings ended with reflection  
- ${stats.quests} quests completed
- ${stats.habits} habits honored

---

WRITE A PERSONAL WEEKLY REFLECTION (300-400 words):

Tell the story of their week as if you were sitting with them on Sunday evening, looking back together. This is NOT a list or summary—it's a narrative, a story told in your unique voice.

Structure your reflection as:
1. Opening: Set the scene of beginning the week together
2. The Journey: Weave through specific moments—reference actual moods, intentions, wins, gratitude they shared
3. Patterns & Growth: What did you notice about their week? What patterns emerged?
4. Forward Gaze: End with encouragement for the week ahead, in your signature style

IMPORTANT:
- Write in second person ("you") speaking directly to them
- Reference SPECIFIC things from their data (not generic advice)
- Use your unique speech patterns and voice throughout
- This should feel like a personal letter, not a report
- End with something memorable in your style (a question, challenge, or blessing)`;

      try {
        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: `You are ${mentorName}, a wellness mentor who tells stories and reflects on journeys. You speak in first person as the mentor, addressing the user as "you". Your responses are warm, personal narratives—never lists or bullet points.` },
              { role: "user", content: storyPrompt },
            ],
            max_tokens: 800,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          mentorStory = aiData.choices?.[0]?.message?.content?.trim();
          
          // Also generate a shorter insight for backward compatibility
          mentorInsight = mentorStory ? mentorStory.split('\n\n')[0].slice(0, 400) : null;
        } else {
          console.error("AI response not ok:", await aiResponse.text());
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
        mentor_story: mentorStory,
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
