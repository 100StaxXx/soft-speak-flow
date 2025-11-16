import { DailyContentWidget } from "@/components/DailyContentWidget";
import { BottomNav } from "@/components/BottomNav";
import { useEffect, useState } from "react";
import { HeroSlider } from "@/components/HeroSlider";
import { MoodSelector } from "@/components/MoodSelector";
import { YourLilPush } from "@/components/YourLilPush";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Smile, Meh, Frown } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodPush, setMoodPush] = useState<any>(null);
  const [isLoadingPush, setIsLoadingPush] = useState(false);

  const { data: todaysReflection } = useQuery({
    queryKey: ['todaysReflection', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('user_reflections')
        .select('*')
        .eq('user_id', user.id)
        .eq('reflection_date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    const container = document.getElementById('main-scroll-container');
    if (!container) return;

    container.scrollTo({ top: 0, behavior: 'instant' });

    const enableSnap = () => {
      setSnapEnabled(true);
      container.removeEventListener('wheel', enableSnap);
      container.removeEventListener('touchstart', enableSnap);
    };

    container.addEventListener('wheel', enableSnap);
    container.addEventListener('touchstart', enableSnap);

    return () => {
      container.removeEventListener('wheel', enableSnap);
      container.removeEventListener('touchstart', enableSnap);
    };
  }, []);

  const handleMoodSelect = async (mood: string) => {
    setSelectedMood(mood);
    setIsLoadingPush(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-mood-push', {
        body: { mood }
      });

      if (error) throw error;
      setMoodPush(data);
    } catch (error) {
      console.error('Error generating mood push:', error);
      setMoodPush({
        quote: "You've got this. Keep moving.",
        mini_pep_talk: "Every challenge is a chance to grow stronger. Take it one step at a time."
      });
    } finally {
      setIsLoadingPush(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <div id="main-scroll-container" className={`h-full overflow-y-auto ${snapEnabled ? 'snap-y' : 'snap-none'}`}>
        <HeroSlider />
        
        <div className="min-h-screen snap-start p-4 space-y-6">
          {/* Night Reflection Card */}
          {!todaysReflection ? (
            <Card className="p-6">
              <h3 className="text-lg font-heading mb-2">Tonight: reflect on your day</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Take a moment to check in with yourself
              </p>
              <Button onClick={() => navigate('/night-reflection')} variant="outline" className="w-full">
                Open Night Reflection
              </Button>
            </Card>
          ) : (
            <Card 
              className="p-6 cursor-pointer hover:border-primary/40 transition-all"
              onClick={() => navigate('/night-reflection')}
            >
              <h3 className="text-lg font-heading mb-3">You checked in today</h3>
              <div className="flex items-center gap-3">
                {todaysReflection.mood === 'good' && (
                  <>
                    <Smile className="w-6 h-6 text-green-400" />
                    <span className="text-green-400 font-medium">Feeling Good</span>
                  </>
                )}
                {todaysReflection.mood === 'neutral' && (
                  <>
                    <Meh className="w-6 h-6" />
                    <span className="font-medium">Neutral Day</span>
                  </>
                )}
                {todaysReflection.mood === 'tough' && (
                  <>
                    <Frown className="w-6 h-6 text-red-400" />
                    <span className="text-red-400 font-medium">Tough Day</span>
                  </>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2">Tap to view</p>
            </Card>
          )}

          {/* Mood Selector */}
          <MoodSelector selectedMood={selectedMood} onSelectMood={handleMoodSelect} />

          {/* Your Lil Push */}
          <YourLilPush mood={selectedMood} push={moodPush} isLoading={isLoadingPush} />

          {/* Daily Content */}
          <DailyContentWidget />
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
