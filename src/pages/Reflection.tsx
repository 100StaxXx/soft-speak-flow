import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Moon, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MoodSelector } from "@/components/MoodSelector";
import { BottomNav } from "@/components/BottomNav";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";

type Mood = 'good' | 'neutral' | 'tough';


export default function Reflection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logActivity } = useActivityFeed();
  
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [todayReflection, setTodayReflection] = useState<{ mood: string; note: string | null; ai_reply: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMoodSelection, setCurrentMoodSelection] = useState<string | null>(null);

  const loadTodayReflection = async () => {
    if (!user?.id) return;
    
    try {
      const today = new Date().toLocaleDateString('en-CA');
      const { data, error } = await supabase
        .from('user_reflections')
        .select('*')
        .eq('user_id', user.id)
        .eq('reflection_date', today)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setTodayReflection(data);
        setSelectedMood(data.mood as Mood);
        setNote(data.note || "");
      }
    } catch (error) {
      console.error('Error loading reflection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadTodayReflection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // loadTodayReflection depends on user.id

  const handleSubmit = async () => {
    if (!selectedMood || !user) return;

    setIsSubmitting(true);
    try {
      const today = new Date().toLocaleDateString('en-CA');
      
      const { data: reflection, error } = await supabase
        .from('user_reflections')
        .upsert({
          user_id: user.id,
          reflection_date: today,
          mood: selectedMood,
          note: note || null
        }, {
          onConflict: 'user_id,reflection_date'
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!reflection) throw new Error("Failed to save reflection");

      // Trigger AI reply generation in background
      supabase.functions.invoke('generate-reflection-reply', {
        body: {
          reflectionId: reflection.id,
          mood: selectedMood,
          note: note
        }
      });

      // Log to activity feed
      logActivity({
        type: 'reflection_completed',
        data: {
          mood: selectedMood,
          has_note: !!note
        }
      });

      toast({
        title: "Nice work",
        description: "You checked in for today.",
      });

      setTodayReflection(reflection);
    } catch (error) {
      console.error('Error saving reflection:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (todayReflection && todayReflection.mood) {
    // Show completed reflection
    return (
      <PageTransition>
        <StarfieldBackground />
        <div className="min-h-screen pb-nav-safe pt-safe relative z-10">
          <div className="container max-w-2xl mx-auto p-4 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-heading font-black flex-1 text-center">Gratitude Journal</h1>
              <Button variant="outline" size="sm" onClick={() => navigate('/mood-history')}>
                View History
              </Button>
            </div>

            <Card className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <Heart className="w-8 h-8 text-primary" />
                <div>
                  <h2 className="text-xl font-heading font-black">Gratitude Complete</h2>
                  <p className="text-sm text-muted-foreground">You logged gratitude today</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">What brought you joy?</p>
                  <div className="p-4 rounded-xl bg-muted/50">
                    <p className="text-lg font-medium capitalize">{todayReflection.mood.replace('_', ' ')}</p>
                  </div>
                </div>

                {todayReflection.note && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Your note:</p>
                    <p className="text-foreground p-4 bg-muted rounded-xl">{todayReflection.note}</p>
                  </div>
                )}

                {todayReflection.ai_reply && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Reflection:</p>
                    <p className="text-foreground p-4 bg-primary/5 rounded-xl border border-primary/20">
                      {todayReflection.ai_reply}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Mood Selector Section */}
            <Card className="p-6">
              <MoodSelector 
                selected={currentMoodSelection}
                onSelect={setCurrentMoodSelection}
              />
            </Card>
          </div>
        </div>
        <BottomNav />
      </PageTransition>
    );
  }

  // Show reflection form
  return (
    <PageTransition>
      <StarfieldBackground />
      <div className="min-h-screen pb-nav-safe pt-safe relative z-10">
        <div className="container max-w-2xl mx-auto p-4 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-heading font-black flex-1 text-center">Gratitude Journal</h1>
            <Button variant="outline" size="sm" onClick={() => navigate('/mood-history')}>
              View History
            </Button>
          </div>

          <Card className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-primary" />
              <div>
                <h2 className="text-xl font-heading font-black">Daily Gratitude</h2>
                <p className="text-sm text-muted-foreground">What are you grateful for?</p>
              </div>
            </div>

            <div className="space-y-6">
              <MoodSelector 
                selected={currentMoodSelection}
                onSelect={setCurrentMoodSelection}
              />

              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Share your gratitude (Optional)
                </p>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What are you grateful for today? What brought you joy?"
                  className="min-h-[120px] resize-none"
                />
              </div>

              <Button 
                onClick={handleSubmit} 
                disabled={!selectedMood || isSubmitting}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? "Saving..." : "Log Gratitude"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
      <BottomNav />
    </PageTransition>
  );
}
