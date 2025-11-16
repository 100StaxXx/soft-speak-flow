import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Moon, Smile, Meh, Frown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MoodSelector } from "@/components/MoodSelector";

type Mood = 'good' | 'neutral' | 'tough';

export default function Reflection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [todayReflection, setTodayReflection] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMoodSelection, setCurrentMoodSelection] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadTodayReflection();
    }
  }, [user]);

  const loadTodayReflection = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('user_reflections')
        .select('*')
        .eq('user_id', user!.id)
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

  const handleSubmit = async () => {
    if (!selectedMood || !user) return;

    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
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
        .single();

      if (error) throw error;

      // Trigger AI reply generation in background
      supabase.functions.invoke('generate-reflection-reply', {
        body: {
          reflectionId: reflection.id,
          mood: selectedMood,
          note: note
        }
      });

      toast({
        title: "Nice work",
        description: "You checked in for today.",
      });

      setTodayReflection(reflection);
    } catch (error: any) {
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

  const moodOptions = [
    { value: 'good' as Mood, label: 'Good', icon: Smile, color: 'bg-green-500/20 hover:bg-green-500/30 border-green-500' },
    { value: 'neutral' as Mood, label: 'Neutral', icon: Meh, color: 'bg-muted hover:bg-muted/80 border-border' },
    { value: 'tough' as Mood, label: 'Tough', icon: Frown, color: 'bg-red-500/20 hover:bg-red-500/30 border-red-500' }
  ];

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
      <div className="min-h-screen bg-background pb-20">
        <div className="container max-w-2xl mx-auto p-4 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-heading font-black flex-1 text-center">Daily Reflection</h1>
            <Button variant="outline" size="sm" onClick={() => navigate('/mood-history')}>
              View History
            </Button>
          </div>

          <Card className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <Moon className="w-8 h-8 text-primary" />
              <div>
                <h2 className="text-xl font-heading font-black">Reflection Complete</h2>
                <p className="text-sm text-muted-foreground">You checked in today</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">How was your day?</p>
                <div className="flex gap-2">
                  {moodOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = todayReflection.mood === option.value;
                    return (
                      <button
                        key={option.value}
                        disabled
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 flex-1 ${
                          isSelected ? option.color : 'opacity-30'
                        }`}
                      >
                        <Icon className="w-8 h-8" />
                        <span className="text-sm font-medium">{option.label}</span>
                      </button>
                    );
                  })}
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
    );
  }

  // Show reflection form
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-heading font-black flex-1 text-center">Daily Reflection</h1>
          <Button variant="outline" size="sm" onClick={() => navigate('/mood-history')}>
            View History
          </Button>
        </div>

        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Moon className="w-8 h-8 text-primary" />
            <div>
              <h2 className="text-xl font-heading font-black">Daily Reflection</h2>
              <p className="text-sm text-muted-foreground">Take a moment to reflect</p>
            </div>
          </div>

          <div className="space-y-6">
            <MoodSelector 
              selected={currentMoodSelection}
              onSelect={setCurrentMoodSelection}
            />

            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Any thoughts? (Optional)
              </p>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's on your mind..."
                className="min-h-[120px] resize-none"
              />
            </div>

            <Button 
              onClick={handleSubmit} 
              disabled={!selectedMood || isSubmitting}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? "Saving..." : "Complete Reflection"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
