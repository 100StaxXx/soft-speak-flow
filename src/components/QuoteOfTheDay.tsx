import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Quote } from "lucide-react";

export const QuoteOfTheDay = () => {
  const { profile } = useProfile();
  const [todaysQuote, setTodaysQuote] = useState<any>(null);

  useEffect(() => {
    const fetchTodaysQuote = async () => {
      if (!profile?.selected_mentor_id) return;

      const today = new Date().toISOString().split("T")[0];

      // Get mentor details
      const { data: mentor } = await supabase
        .from("mentors")
        .select("slug")
        .eq("id", profile.selected_mentor_id)
        .single();

      if (!mentor) return;

      // Check if there's a daily quote for today
      const { data: dailyQuote } = await supabase
        .from("daily_quotes")
        .select(`
          *,
          quotes:quote_id (*)
        `)
        .eq("for_date", today)
        .eq("mentor_slug", mentor.slug)
        .single();

      if (dailyQuote) {
        setTodaysQuote(dailyQuote.quotes);
      }
    };

    fetchTodaysQuote();
  }, [profile?.selected_mentor_id]);

  if (!todaysQuote) return null;

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-primary/20 rounded-full">
          <Quote className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground">Quote of the Day</h3>
          <blockquote className="text-lg font-medium italic leading-relaxed">
            "{todaysQuote.text}"
          </blockquote>
          {todaysQuote.author && (
            <p className="text-sm text-muted-foreground">— {todaysQuote.author}</p>
          )}
        </div>
      </div>
    </Card>
  );
};
