import { useState, useEffect } from "react";
import { safeLocalStorage } from "@/utils/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Quote, Play, Sparkles, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { getResolvedMentorId } from "@/utils/mentor";

interface DailyContent {
  pepTalk?: { title: string; summary: string; audio_url?: string; id: string } | null;
  quote?: { text: string; author: string; category?: string } | null;
}

export const DailyContentWidget = () => {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [content, setContent] = useState<DailyContent>({});
  const [loading, setLoading] = useState(true);
  const resolvedMentorId = getResolvedMentorId(profile);

  useEffect(() => {
    let isCancelled = false;

    const fetchDailyContent = async () => {
      setLoading(true);

      try {
        if (!resolvedMentorId) {
          if (!isCancelled) {
            setContent({});
            setLoading(false);
          }
          return;
        }

        const today = format(new Date(), 'yyyy-MM-dd');

        // Get mentor details
        const { data: mentor, error: mentorError } = await supabase
          .from("mentors")
          .select("slug, name")
          .eq("id", resolvedMentorId)
          .maybeSingle();

        if (mentorError) {
          throw mentorError;
        }

        if (!mentor) {
          if (!isCancelled) {
            setContent({});
          }
          return;
        }

        // Fetch both pep talk and quote in parallel
        const [pepTalkResult, quoteResult] = await Promise.all([
          supabase
            .from("daily_pep_talks")
            .select("*")
            .eq("for_date", today)
            .eq("mentor_slug", mentor.slug)
            .maybeSingle(),
          supabase
            .from("daily_quotes")
            .select(`
              *,
              quotes:quote_id (*)
            `)
            .eq("for_date", today)
            .eq("mentor_slug", mentor.slug)
            .maybeSingle()
        ]);

        if (pepTalkResult.error) {
          throw pepTalkResult.error;
        }
        if (quoteResult.error) {
          throw quoteResult.error;
        }

        // Extract quote from the daily_quotes join result
        const quoteData = quoteResult.data?.quotes as unknown as { text: string; author: string | null; category: string | null } | null;
        
        if (!isCancelled) {
          setContent({
            pepTalk: pepTalkResult.data ? {
              id: pepTalkResult.data.id,
              title: pepTalkResult.data.title,
              summary: pepTalkResult.data.summary,
              audio_url: pepTalkResult.data.audio_url
            } : null,
            quote: quoteData ? {
              text: quoteData.text,
              author: quoteData.author || 'Unknown',
              category: quoteData.category || undefined
            } : null,
          });
        }
      } catch (error) {
        if (!isCancelled) {
          setContent({});
        }
        console.error('[DailyContentWidget] Failed to fetch daily content:', error);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void fetchDailyContent();
    return () => {
      isCancelled = true;
    };
  }, [resolvedMentorId]);

  if (loading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </Card>
    );
  }

  if (!content.pepTalk && !content.quote) return null;

  return (
    <Card className="relative overflow-hidden group animate-fade-in">
      {/* Cinematic Background with Dual Gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-background opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-accent/20 opacity-40" />
      
      {/* Soft static glows */}
      <div className="absolute -top-1/3 -right-1/3 w-2/3 h-2/3 bg-primary/20 blur-3xl rounded-full" />
      <div className="absolute -bottom-1/3 -left-1/3 w-2/3 h-2/3 bg-accent/20 blur-3xl rounded-full" />
      
      <div className="relative p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Your Daily Boost
            </h2>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate("/push-settings")}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Settings
          </Button>
        </div>

        {/* Pep Talk Section */}
        {content.pepTalk && (
          <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/20 rounded-full">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-primary uppercase tracking-wider">Pep Talk</p>
              </div>
            </div>
            
            <h3 className="font-semibold leading-tight text-foreground">
              {content.pepTalk.title}
            </h3>
            
            <Button 
              onClick={() => navigate("/library")}
              size="sm"
              disabled={Boolean(safeLocalStorage.getItem('appWalkthroughActive'))}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-3 w-3 mr-2" />
              Listen Now
            </Button>
          </div>
        )}

        {/* Quote Section */}
        {content.quote && (
          <div className="space-y-3 p-4 rounded-lg bg-gradient-to-bl from-accent/10 to-accent/5 border border-accent/20 hover:border-accent/30 transition-colors">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-accent/20 rounded-full">
                <Quote className="h-4 w-4 text-accent" />
              </div>
              <p className="text-xs font-medium text-accent uppercase tracking-wider">Daily Quote</p>
            </div>
            
            <blockquote className="text-sm italic text-foreground/90 leading-relaxed">
              "{content.quote.text}"
            </blockquote>
            
            {content.quote.author && (
              <p className="text-xs text-muted-foreground font-medium">
                — {content.quote.author}
              </p>
            )}
          </div>
        )}

        {/* View All Link */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/library")}
          className="w-full text-xs text-muted-foreground hover:text-foreground group/btn"
        >
          View All Content
          <ChevronRight className="h-3 w-3 ml-1 group-hover/btn:translate-x-1 transition-transform" />
        </Button>
      </div>
    </Card>
  );
};
