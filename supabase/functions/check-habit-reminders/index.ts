import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const currentTimeStr = now.toTimeString().slice(0, 5); // "HH:MM" format
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const todayDate = now.toISOString().split("T")[0];

    console.log(`[check-habit-reminders] Running at ${currentTimeStr} on day ${currentDayOfWeek}`);

    // Fetch habits that:
    // 1. Have reminder_enabled = true
    // 2. Have a preferred_time set
    // 3. Haven't had reminder sent today
    // 4. Are active
    const { data: habits, error: habitsError } = await supabase
      .from("habits")
      .select(`
        id,
        user_id,
        title,
        preferred_time,
        reminder_minutes_before,
        frequency,
        custom_days
      `)
      .eq("reminder_enabled", true)
      .eq("is_active", true)
      .eq("reminder_sent_today", false)
      .not("preferred_time", "is", null);

    if (habitsError) {
      console.error("[check-habit-reminders] Failed to fetch habits:", habitsError);
      throw habitsError;
    }

    if (!habits || habits.length === 0) {
      console.log("[check-habit-reminders] No habits pending reminders");
      return new Response(
        JSON.stringify({ success: true, remindersChecked: 0, remindersSent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[check-habit-reminders] Found ${habits.length} habits with reminders enabled`);

    let remindersSent = 0;

    for (const habit of habits) {
      // Check if habit is due today
      const isDueToday = habit.frequency === "daily" ||
        (habit.frequency === "custom" && habit.custom_days?.includes(currentDayOfWeek));

      if (!isDueToday) {
        continue;
      }

      // Check if already completed today
      const { data: completions } = await supabase
        .from("habit_completions")
        .select("id")
        .eq("habit_id", habit.id)
        .eq("date", todayDate)
        .limit(1);

      if (completions && completions.length > 0) {
        // Already completed, skip
        continue;
      }

      // Calculate reminder time
      const [hours, minutes] = habit.preferred_time.split(":").map(Number);
      const habitTime = new Date(now);
      habitTime.setHours(hours, minutes, 0, 0);

      const reminderTime = new Date(habitTime.getTime() - (habit.reminder_minutes_before || 15) * 60 * 1000);
      const reminderTimeStr = reminderTime.toTimeString().slice(0, 5);

      // Check if current time is within 1 minute of reminder time
      const [currentHours, currentMinutes] = currentTimeStr.split(":").map(Number);
      const [reminderHours, reminderMinutes] = reminderTimeStr.split(":").map(Number);
      
      const currentTotalMinutes = currentHours * 60 + currentMinutes;
      const reminderTotalMinutes = reminderHours * 60 + reminderMinutes;
      const timeDiff = Math.abs(currentTotalMinutes - reminderTotalMinutes);

      if (timeDiff > 1) {
        // Not time for reminder yet
        continue;
      }

      console.log(`[check-habit-reminders] Sending reminder for habit: ${habit.title} (user: ${habit.user_id})`);

      // Get user's push tokens
      const { data: tokens } = await supabase
        .from("push_subscriptions")
        .select("device_token, platform")
        .eq("user_id", habit.user_id)
        .eq("platform", "ios");

      if (!tokens || tokens.length === 0) {
        console.log(`[check-habit-reminders] No iOS tokens for user ${habit.user_id}`);
        continue;
      }

      // Get user's companion for personalized notification
      const { data: companion } = await supabase
        .from("user_companion")
        .select("spirit_animal")
        .eq("user_id", habit.user_id)
        .maybeSingle();

      const companionEmoji = getCompanionEmoji(companion?.spirit_animal);

      // Send notification to each device
      for (const token of tokens) {
        try {
          const response = await supabase.functions.invoke("send-apns-notification", {
            body: {
              deviceToken: token.device_token,
              title: `Time for ${habit.title}! ${companionEmoji}`,
              body: `Your companion is cheering you on! Let's build that habit.`,
              data: {
                type: "habit_reminder",
                habitId: habit.id,
              },
            },
            headers: internalSecret ? {
              "x-internal-key": internalSecret,
            } : undefined,
          });

          if (response.error) {
            console.error(`[check-habit-reminders] Failed to send notification:`, response.error);
          } else {
            remindersSent++;
          }
        } catch (err) {
          console.error(`[check-habit-reminders] Error sending notification:`, err);
        }
      }

      // Mark reminder as sent for today
      await supabase
        .from("habits")
        .update({ reminder_sent_today: true })
        .eq("id", habit.id);
    }

    console.log(`[check-habit-reminders] Completed. Sent ${remindersSent} reminders.`);

    return new Response(
      JSON.stringify({
        success: true,
        remindersChecked: habits.length,
        remindersSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[check-habit-reminders] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getCompanionEmoji(spiritAnimal?: string): string {
  const emojiMap: Record<string, string> = {
    wolf: "🐺",
    fox: "🦊",
    owl: "🦉",
    bear: "🐻",
    lion: "🦁",
    eagle: "🦅",
    deer: "🦌",
    rabbit: "🐰",
    tiger: "🐯",
    dragon: "🐉",
    phoenix: "🔥",
    dolphin: "🐬",
    whale: "🐋",
    cat: "🐱",
    dog: "🐕",
  };
  return emojiMap[spiritAnimal?.toLowerCase() || ""] || "✨";
}
