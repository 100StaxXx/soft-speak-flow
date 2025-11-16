import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Moon, Smile, Meh, Frown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";


type Mood = 'good' | 'neutral' | 'tough';

export default function NightReflection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [todayReflection, setTodayReflection] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

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
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-3xl font-heading text-foreground">Tonight's Reflection</h1>
          </div>

          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Moon className="w-6 h-6 text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">You checked in today</div>
                <div className="text-lg font-heading capitalize">{todayReflection.mood}</div>
              </div>
            </div>

            {todayReflection.note && (
              <div className="pt-4 border-t">
                <div className="text-sm text-muted-foreground mb-2">Your note:</div>
                <p className="text-foreground">{todayReflection.note}</p>
              </div>
            )}

            {todayReflection.ai_reply && (
              <div className="pt-4 border-t bg-accent/20 -mx-6 -mb-6 p-6 rounded-b-lg">
                <div className="text-sm text-muted-foreground mb-2">A thought for you:</div>
                <p className="text-foreground italic">{todayReflection.ai_reply}</p>
              </div>
            )}
          </Card>

          <Button variant="outline" onClick={() => navigate('/')} className="w-full">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-heading text-foreground">Night Reflection</h1>
        </div>

        <div className="space-y-6">
          <div className="text-center space-y-2">
            <Moon className="w-12 h-12 text-primary mx-auto" />
            <h2 className="text-2xl font-heading text-foreground">How did today feel?</h2>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {moodOptions.map((mood) => {
              const Icon = mood.icon;
              const isSelected = selectedMood === mood.value;
              
              return (
                <button
                  key={mood.value}
                  onClick={() => setSelectedMood(mood.value)}
                  className={`
                    p-6 rounded-xl border-2 transition-all active:scale-95
                    ${isSelected ? mood.color : 'bg-card border-border hover:border-primary/50'}
                  `}
                >
                  <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`} />
                  <div className={`font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {mood.label}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedMood && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Anything you want to get off your chest?
                </label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional — just for you..."
                  className="min-h-32"
                />
              </div>

              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? 'Saving...' : 'Finish Check-In'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}