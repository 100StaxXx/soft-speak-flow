import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { AudioPlayer } from "@/components/AudioPlayer";
import { BottomNav } from "@/components/BottomNav";
import { PepTalkCard } from "@/components/PepTalkCard";
import { QuoteCard } from "@/components/QuoteCard";
import { VideoCard } from "@/components/VideoCard";
import { PlaylistCard } from "@/components/PlaylistCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Compass, User } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const [mentor, setMentor] = useState<any>(null);
  const [featuredPepTalk, setFeaturedPepTalk] = useState<any>(null);
  const [recommendedVideos, setRecommendedVideos] = useState<any[]>([]);
  const [dailyQuotes, setDailyQuotes] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user needs to select a mentor
    if (user && !profileLoading && profile && !profile.selected_mentor_id) {
      navigate("/mentor-selection");
    }
  }, [user, profileLoading, profile, navigate]);

  useEffect(() => {
    if (!user || profileLoading) {
      fetchGeneralContent();
      return;
    }
    if (profile?.selected_mentor_id) {
      fetchPersonalizedContent();
    } else {
      fetchGeneralContent();
    }
  }, [user, profile, profileLoading]);

  const fetchPersonalizedContent = async () => {
    try {
      setLoading(true);

      // Fetch user's selected mentor
      const { data: mentorData } = await supabase
        .from("mentors")
        .select("*")
        .eq("id", profile?.selected_mentor_id)
        .single();

      setMentor(mentorData);

      // Fetch pep talk from user's mentor
      const { data: pepTalkData } = await supabase
        .from("pep_talks")
        .select("*")
        .eq("mentor_id", profile?.selected_mentor_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!pepTalkData) {
        const { data: fallbackPepTalk } = await supabase
          .from("pep_talks")
          .select("*")
          .eq("is_featured", true)
          .limit(1)
          .maybeSingle();
        setFeaturedPepTalk(fallbackPepTalk);
      } else {
        setFeaturedPepTalk(pepTalkData);
      }

      const { data: videoData } = await supabase
        .from("videos")
        .select("*")
        .eq("mentor_id", profile?.selected_mentor_id)
        .order("created_at", { ascending: false })
        .limit(2);
      setRecommendedVideos(videoData || []);

      const { data: quoteData } = await supabase
        .from("quotes")
        .select("*")
        .eq("mentor_id", profile?.selected_mentor_id)
        .order("created_at", { ascending: false })
        .limit(3);
      setDailyQuotes(quoteData || []);

      const { data: playlistData } = await supabase
        .from("playlists")
        .select("*")
        .eq("mentor_id", profile?.selected_mentor_id)
        .order("created_at", { ascending: false })
        .limit(2);
      setPlaylists(playlistData || []);
    } catch (error) {
      console.error("Error fetching personalized content:", error);
      toast.error("Failed to load personalized content");
    } finally {
      setLoading(false);
    }
  };

  const fetchGeneralContent = async () => {
    try {
      setLoading(true);
      
      const { data: pepTalkData } = await supabase
        .from("pep_talks")
        .select("*")
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setFeaturedPepTalk(pepTalkData);

      const { data: videoData } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2);
      setRecommendedVideos(videoData || []);

      const { data: quoteData } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);
      setDailyQuotes(quoteData || []);

      const { data: playlistData } = await supabase
        .from("playlists")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2);
      setPlaylists(playlistData || []);
    } catch (error) {
      console.error("Error fetching content:", error);
      toast.error("Failed to load content");
    } finally {
      setLoading(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-secondary/30">
        <div className="animate-pulse text-center">
          <Sparkles className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Loading your personalized feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-obsidian">
      <div className="max-w-lg mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <h1 className="font-heading text-4xl font-black text-pure-white mb-2 tracking-tight uppercase">
            Your Push Today
          </h1>
          {mentor && user ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mt-3">
              <User className="h-4 w-4" />
              <span>Guided by <span className="font-medium text-foreground">{mentor.name}</span></span>
              <Button variant="ghost" size="sm" onClick={() => navigate("/profile")} className="text-xs">
                Change
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm mt-2">
              <Button variant="link" onClick={() => navigate("/auth")} className="text-primary p-0">
                Sign in
              </Button>
              {" "}to unlock personalized mentorship
            </p>
          )}
        </div>

        {mentor && user && (
          <Card className="mb-6 p-6 bg-graphite border-2 border-royal-gold">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-lg bg-royal-gold text-obsidian flex items-center justify-center text-xl font-black flex-shrink-0">
                {mentor.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-semibold text-pure-white mb-1 uppercase tracking-wide">{mentor.name}</h3>
                <p className="text-sm text-steel">"{mentor.description}"</p>
              </div>
            </div>
          </Card>
        )}

        {featuredPepTalk && (
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-2 text-sm font-bold text-royal-gold uppercase tracking-wider">
              <Sparkles className="h-4 w-4 text-royal-gold" />
              Featured Push
            </div>
            <PepTalkCard
              id={featuredPepTalk.id}
              title={featuredPepTalk.title}
              category={featuredPepTalk.category}
              quote={featuredPepTalk.quote}
              isPremium={featuredPepTalk.is_premium}
            />
          </div>
        )}

        {recommendedVideos.length > 0 && (
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-pure-white uppercase tracking-tight">Recommended</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/videos")} className="text-royal-gold hover:bg-graphite">
                See All
              </Button>
            </div>
            <div className="space-y-3">
              {recommendedVideos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </div>
        )}

        {dailyQuotes.length > 0 && (
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-pure-white uppercase tracking-tight">Daily Wisdom</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/quotes")} className="text-royal-gold hover:bg-graphite">
                More Quotes
              </Button>
            </div>
            <div className="space-y-3">
              {dailyQuotes.map((quote) => (
                <QuoteCard key={quote.id} quote={quote} />
              ))}
            </div>
          </div>
        )}

        {playlists.length > 0 && (
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-pure-white uppercase tracking-tight">Playlists</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/playlists")} className="text-royal-gold hover:bg-graphite">
                Browse All
              </Button>
            </div>
            <div className="space-y-3">
              {playlists.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <Button onClick={() => navigate("/library")} variant="outline" className="w-full rounded-lg py-6 border-2 border-royal-gold bg-obsidian text-pure-white hover:bg-royal-gold hover:text-obsidian font-bold uppercase tracking-wide">
            <Compass className="mr-2 h-5 w-5" />
            Explore Library
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Index;
