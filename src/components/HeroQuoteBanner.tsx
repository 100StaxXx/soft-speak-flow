import { useEffect, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import dariusImage from "@/assets/darius-sage.png";
import novaImage from "@/assets/nova-sage.png";
import lumiImage from "@/assets/lumi-sage.png";
import kaiImage from "@/assets/kai-sage.png";
import atlasImage from "@/assets/atlas-sage.png";
import siennaImage from "@/assets/sienna-sage.png";
import eliImage from "@/assets/eli-sage.png";
import strykerImage from "@/assets/stryker-sage.png";
import solaceImage from "@/assets/solace-sage.png";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";

interface QuoteData {
  id: string;
  text: string;
  author: string | null;
  category: string | null;
}

interface Mentor {
  name: string;
  avatar_url: string | null;
  slug: string;
}

export const HeroQuoteBanner = () => {
  const { profile } = useProfile();
  const [todaysQuote, setTodaysQuote] = useState<QuoteData | null>(null);
  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [loading, setLoading] = useState(true);

  // Map mentor slugs to local images
  const mentorImages: Record<string, string> = {
    'darius': dariusImage,
    'nova': novaImage,
    'lumi': lumiImage,
    'kai': kaiImage,
    'atlas': atlasImage,
    'sienna': siennaImage,
    'eli': eliImage,
    'stryker': strykerImage,
    'solace': solaceImage,
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.selected_mentor_id) return;

      const today = new Date().toISOString().split("T")[0];

      // Get mentor details
      const { data: mentorData } = await supabase
        .from("mentors")
        .select("name, avatar_url, slug")
        .eq("id", profile.selected_mentor_id)
        .maybeSingle();

      if (!mentorData) {
        setLoading(false);
        return;
      }

      setMentor(mentorData);

      // Get today's pep talk to find related quote
      const { data: dailyPepTalk } = await supabase
        .from("daily_pep_talks")
        .select("emotional_triggers, topic_category")
        .eq("for_date", today)
        .eq("mentor_slug", mentorData.slug)
        .maybeSingle();

      if (dailyPepTalk) {
        // Fetch a quote that matches the pep talk's themes
        const { data: quote } = await supabase
          .from("quotes")
          .select("*")
          .or(`emotional_triggers.ov.{${dailyPepTalk.emotional_triggers?.join(',') || ''}},category.eq.${dailyPepTalk.topic_category}`)
          .limit(1)
          .maybeSingle();

        if (quote) {
          setTodaysQuote(quote);
        }
      }
      
      setLoading(false);
    };

    fetchData();
  }, [profile?.selected_mentor_id]);

  if (loading || !todaysQuote || !mentor) return null;

  const mentorImageUrl = mentor.avatar_url || mentorImages[mentor.slug] || mentorImages['darius'];

  return (
    <div className="relative w-full h-[75vh] min-h-[500px] overflow-hidden mb-6">
      {/* Mentor Background Image - Dimmed */}
      <div className="absolute inset-0">
        <img 
          src={mentorImageUrl} 
          alt={mentor.name}
          className="w-full h-full object-cover object-top scale-110"
        />
        <div className="absolute inset-0 bg-background/60" />
      </div>

      {/* Quote Content */}
      <div className="relative h-full flex items-end justify-end p-8 md:p-12">
        <blockquote className="max-w-2xl text-right">
          <p className="font-serif italic text-xl md:text-2xl lg:text-3xl text-foreground/70 leading-relaxed">
            "{todaysQuote.text}"
          </p>
          {todaysQuote.author && (
            <footer className="mt-4 font-serif italic text-base md:text-lg text-foreground/60">
              — {todaysQuote.author}
            </footer>
          )}
        </blockquote>
      </div>
    </div>
  );
};
