import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getDocument, getDocuments, setDocument } from "@/lib/firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Moon, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MoodSelector } from "@/components/MoodSelector";
import { BottomNav } from "@/components/BottomNav";

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
    if (!user?.uid) return;
    
    try {
      const today = new Date().toLocaleDateString('en-CA');
      const reflections = await getDocuments(
        'user_reflections',
        [
          ['user_id', '==', user.uid],
          ['reflection_date', '==', today],
        ]
      );

      const data = reflections[0] || null;
      
      if (data) {
        setTodayReflection({ mood: data.mood, note: data.note || null, ai_reply: data.ai_reply || null });
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
  }, [user?.uid]); // loadTodayReflection depends on user.uid

  const handleSubmit = async () => {
    if (!selectedMood || !user) return;

    setIsSubmitting(true);
    try {
      const today = new Date().toLocaleDateString('en-CA');
      const reflectionId = `${user.uid}_${today}`;
      
      const reflectionData = {
        id: reflectionId,
        user_id: user.uid,
        reflection_date: today,
        mood: selectedMood,
        note: note || null,
      };

      await setDocument('user_reflections', reflectionId, reflectionData, true);

      // TODO: Migrate to Firebase Cloud Function
      // Trigger AI reply generation in background
      // await fetch('https://YOUR-FIREBASE-FUNCTION/generate-reflection-reply', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     reflectionId: reflectionId,
      //     mood: selectedMood,
      //     note: note
      //   })
      // });

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

      setTodayReflection({ mood: selectedMood, note: note || null, ai_reply: null });
    } catch (error) {
      console.error('Error saving reflection:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save reflection",
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
      <div className="min-h-screen bg-background pb-20">
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
        <BottomNav />
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
      <BottomNav />
    </div>
  );
}
