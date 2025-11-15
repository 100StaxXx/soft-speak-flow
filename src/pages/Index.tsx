import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { HeroSlider } from "@/components/HeroSlider";
import { IntroScreen } from "@/components/IntroScreen";
import { PowerModeToggle } from "@/components/PowerModeToggle";
import { AudioPlayer } from "@/components/AudioPlayer";
import { BottomNav } from "@/components/BottomNav";
import { PepTalkCard } from "@/components/PepTalkCard";
import { QuoteCard } from "@/components/QuoteCard";
import { VideoCard } from "@/components/VideoCard";
import { PlaylistCard } from "@/components/PlaylistCard";
import { AskMentorChat } from "@/components/AskMentorChat";
import { DailyLesson } from "@/components/DailyLesson";
import { MentorMessage } from "@/components/MentorMessage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Compass, Heart, MessageCircle, Trophy, Target, BookOpen, Flame, Music, Zap, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

const Index = () => {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { isTransitioning } = useTheme();
  const navigate = useNavigate();
  const [mentor, setMentor] = useState<any>(null);
  const [featuredPepTalk, setFeaturedPepTalk] = useState<any>(null);
  const [recommendedVideos, setRecommendedVideos] = useState<any[]>([]);
  const [dailyQuotes, setDailyQuotes] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [powerMode, setPowerMode] = useState(false);

  // Reset scroll to top when component mounts and when intro completes
  useEffect(() => {
    window.scrollTo(0, 0);
    const container = document.getElementById('main-scroll-container');
    if (container) {
      container.scrollTop = 0;
    }
  }, []);

  useEffect(() => {
    if (!showIntro) {
      const container = document.getElementById('main-scroll-container');
      if (container) {
        container.scrollTop = 0;
      }
    }
  }, [showIntro]);

  useEffect(() => {
    // Check if user needs onboarding
    if (user && !profileLoading && profile && !profile.selected_mentor_id) {
      navigate("/onboarding");
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
    <div className="snap-y snap-mandatory overflow-y-scroll h-screen" id="main-scroll-container">
      {showIntro && <IntroScreen onComplete={() => setShowIntro(false)} />}
      
      <div className="fixed top-6 right-6 z-50">
        <PowerModeToggle onToggle={setPowerMode} />
      </div>

      {!showIntro && (
        <section className="snap-start snap-always h-screen">
          <HeroSlider mentorId={profile?.selected_mentor_id || undefined} />
        </section>
      )}

      <section className={`snap-start snap-always min-h-screen transition-opacity duration-300 ${isTransitioning ? 'opacity-50' : 'opacity-100'} bg-background`}>
        <div className="max-w-6xl mx-auto px-6 py-16 pb-32">
        {mentor && user && (
          <div className="mb-12">
            <MentorMessage 
              mentorId={profile?.selected_mentor_id || undefined} 
              type="welcome" 
            />
          </div>
        )}
        
        {mentor && user && (
          <div className="mb-8 flex items-center gap-4 justify-center">
            <div className={`w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xl font-black flex-shrink-0 ${powerMode ? 'shadow-glow' : ''}`}>
              {mentor.name.charAt(0)}
            </div>
            <div>
              <p className="text-xs text-primary font-bold uppercase tracking-widest">
                {powerMode ? "YOUR MOTIVATOR" : `From ${mentor.name}`}
              </p>
              <p className="text-sm text-muted-foreground">"{mentor.description}"</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/profile")} className="text-xs ml-auto">
              Change
            </Button>
          </div>
        )}

        {!user && (
          <div className="text-center mb-12">
            <p className="text-steel text-sm">
              <Button variant="link" onClick={() => navigate("/auth")} className="text-royal-purple p-0 font-bold">
                Sign in
              </Button>
              {" "}to unlock personalized motivation
            </p>
          </div>
        )}

        {/* Quick Feature Navigation */}
        {user && (
          <div className="mb-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card
                className="p-6 hover:border-primary/40 transition-all cursor-pointer group"
                onClick={() => navigate("/mentor-chat")}
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <MessageCircle className="w-6 h-6 text-primary" />
                  </div>
                  <span className="font-heading text-foreground">Ask Motivator</span>
                </div>
              </Card>
              
              <Card
                className="p-6 hover:border-primary/40 transition-all cursor-pointer group"
                onClick={() => navigate("/habits")}
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Flame className="w-6 h-6 text-primary" />
                  </div>
                  <span className="font-heading text-foreground">Habits</span>
                </div>
              </Card>
              
              <Card
                className="p-6 hover:border-primary/40 transition-all cursor-pointer group"
                onClick={() => navigate("/challenges")}
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Target className="w-6 h-6 text-primary" />
                  </div>
                  <span className="font-heading text-foreground">Challenges</span>
                </div>
              </Card>
              
              <Card
                className="p-6 hover:border-primary/40 transition-all cursor-pointer group"
                onClick={() => navigate("/focus")}
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <span className="font-heading text-foreground">Focus</span>
                </div>
              </Card>
              
              <Card
                className="p-6 hover:border-primary/40 transition-all cursor-pointer group"
                onClick={() => navigate("/audio")}
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Music className="w-6 h-6 text-primary" />
                  </div>
                  <span className="font-heading text-foreground">Audio</span>
                </div>
              </Card>
              
              <Card
                className="p-6 hover:border-primary/40 transition-all cursor-pointer group"
                onClick={() => navigate("/review")}
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                  <span className="font-heading text-foreground">Review</span>
                </div>
              </Card>
              
              <Card
                className="p-6 hover:border-primary/40 transition-all cursor-pointer group"
                onClick={() => navigate("/lessons")}
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <BookOpen className="w-6 h-6 text-primary" />
                  </div>
                  <span className="font-heading text-foreground">Lessons</span>
                </div>
              </Card>
              
              <Card
                className="p-6 hover:border-primary/40 transition-all cursor-pointer group"
                onClick={() => navigate("/profile")}
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Compass className="w-6 h-6 text-primary" />
                  </div>
                  <span className="font-heading text-foreground">Profile</span>
                </div>
              </Card>
            </div>
          </div>
        )}


        {featuredPepTalk && (
          <div className="mb-16">
            <div className="flex items-center gap-2 text-sm font-black text-royal-gold uppercase tracking-widest mb-6">
              <Heart className="h-5 w-5" fill="currentColor" />
              {powerMode ? "YOUR MISSION TODAY" : "Your Push Today"}
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

        {/* Daily Lesson Section */}
        {mentor && user && (
          <div className="mb-16">
            <div className="flex items-center gap-2 text-sm font-black text-royal-gold uppercase tracking-widest mb-6">
              <BookOpen className="h-5 w-5" />
              Daily Lesson
            </div>
            <DailyLesson
              title="The Power of Consistency"
              content="Success isn't about massive action. It's about small, consistent steps taken every single day. Don't wait for motivation—create discipline. Show up even when you don't feel like it. That's what separates the dreamers from the doers."
              category="Discipline"
            />
          </div>
        )}


        {recommendedVideos.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-pure-white uppercase tracking-tight">
                {powerMode ? "Recommended for You" : "Recommended"}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/videos")} className="text-royal-gold hover:bg-graphite">
                See All
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendedVideos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </div>
        )}

        {dailyQuotes.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-pure-white uppercase tracking-tight">
                {powerMode ? "Quotes to Carry" : "Daily Wisdom"}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/quotes")} className="text-royal-gold hover:bg-graphite">
                More
              </Button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
              {dailyQuotes.map((quote) => (
                <div key={quote.id} className="flex-shrink-0 w-80 snap-center">
                  <QuoteCard quote={quote} />
                </div>
              ))}
            </div>
          </div>
        )}

        {playlists.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-pure-white uppercase tracking-tight">
                {powerMode ? "Power Playlists" : "Playlists"}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/playlists")} className="text-royal-gold hover:bg-graphite">
                Browse All
              </Button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
              {playlists.map((playlist) => (
                <div key={playlist.id} className="flex-shrink-0 w-80 snap-center">
                  <PlaylistCard playlist={playlist} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ask Your Mentor Chat Section */}
        {mentor && user && (
          <div className="mb-16">
            <div className="flex items-center gap-2 text-sm font-black text-royal-gold uppercase tracking-widest mb-6">
              <MessageCircle className="h-5 w-5" />
              Ask Your Motivator Anything
            </div>
            <AskMentorChat 
              mentorName={mentor.name} 
              mentorTone={mentor.tone_description || "supportive and motivational"} 
            />
          </div>
        )}


        {/* Explore Categories */}
        <div className="mb-16">
          <div className="flex items-center gap-2 text-sm font-black text-royal-gold uppercase tracking-widest mb-6">
            <Target className="h-5 w-5" />
            Explore Categories
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {["Discipline", "Confidence", "Physique", "Focus", "Mindset", "Business"].map((category) => (
              <Card 
                key={category}
                className="bg-graphite border-steel/20 p-6 cursor-pointer hover:border-royal-gold/50 transition-all hover:scale-105"
                onClick={() => navigate(`/library?category=${category.toLowerCase()}`)}
              >
                <h4 className="text-pure-white font-heading font-bold text-center">
                  {category}
                </h4>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-12">
          <Button onClick={() => navigate("/library")} variant="outline" className="w-full rounded-lg py-6 border-2 border-royal-purple bg-obsidian text-pure-white hover:bg-royal-purple hover:text-obsidian font-bold uppercase tracking-wide">
            <Compass className="mr-2 h-5 w-5" />
            Explore Library
          </Button>
        </div>
        </div>
      </section>

      {mentor && user && (
        <AskMentorChat mentorName={mentor.name} mentorTone={mentor.tone_description} />
      )}
      <BottomNav />
    </div>
  );
};

export default Index;
