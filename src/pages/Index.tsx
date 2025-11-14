import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AudioPlayer } from "@/components/AudioPlayer";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

interface PepTalk {
  id: string;
  title: string;
  category: string;
  quote: string;
  description: string;
  audio_url: string;
  is_featured: boolean;
  created_at: string;
}

const Index = () => {
  const [featuredPepTalk, setFeaturedPepTalk] = useState<PepTalk | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFeaturedPepTalk();
  }, []);

  const fetchFeaturedPepTalk = async () => {
    try {
      const { data, error } = await supabase
        .from("pep_talks")
        .select("*")
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setFeaturedPepTalk(data);
    } catch (error) {
      console.error("Error fetching featured pep talk:", error);
      toast.error("Failed to load today's pep talk");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <Sparkles className="h-12 w-12 text-blush-rose mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your daily dose of motivation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-cream-glow to-petal-pink/30">
      <div className="max-w-lg mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-heading text-4xl font-bold text-foreground mb-2">
            A Lil Push
          </h1>
          <p className="text-muted-foreground text-sm">
            Your pocket-sized dose of comfort
          </p>
        </div>

        {featuredPepTalk ? (
          <div className="space-y-6">
            {/* Featured Badge */}
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 text-gold-accent" />
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Today's Lil Push
              </span>
              <Sparkles className="h-4 w-4 text-gold-accent" />
            </div>

            {/* Category */}
            <div className="text-center">
              <span className="inline-block px-4 py-1.5 rounded-full bg-lavender-mist/30 text-sm font-medium text-foreground">
                {featuredPepTalk.category}
              </span>
            </div>

            {/* Title */}
            <h2 className="font-heading text-3xl font-bold text-center text-foreground leading-tight">
              {featuredPepTalk.title}
            </h2>

            {/* Quote */}
            <div className="bg-card rounded-3xl p-6 shadow-soft">
              <div className="text-5xl text-blush-rose mb-2">"</div>
              <p className="font-heading text-xl text-foreground italic leading-relaxed">
                {featuredPepTalk.quote}
              </p>
              <div className="text-5xl text-blush-rose text-right">"</div>
            </div>

            {/* Audio Player */}
            <AudioPlayer audioUrl={featuredPepTalk.audio_url} title={featuredPepTalk.title} />

            {/* CTA */}
            <Button
              onClick={() => navigate("/library")}
              className="w-full rounded-full py-6 text-base font-medium bg-gradient-to-r from-blush-rose to-lavender-mist hover:shadow-glow transition-all"
            >
              See All Pep Talks
            </Button>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="bg-card rounded-3xl p-8 shadow-soft">
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-heading text-2xl font-semibold text-foreground mb-2">
                No Featured Pep Talk Yet
              </h3>
              <p className="text-muted-foreground mb-6">
                Check back soon for your daily dose of motivation!
              </p>
              <Button
                onClick={() => navigate("/library")}
                className="rounded-full px-8 py-3 bg-gradient-to-r from-blush-rose to-lavender-mist hover:shadow-glow transition-all"
              >
                Browse All Pep Talks
              </Button>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Index;
