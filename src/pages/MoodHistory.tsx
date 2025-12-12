import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getDocuments } from "@/lib/firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Heart, Calendar } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { format, parseISO } from "date-fns";

interface Reflection {
  id: string;
  reflection_date: string;
  mood: string;
  note: string | null;
  ai_reply: string | null;
}

export default function MoodHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadReflections = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await getDocuments<Reflection>(
          "user_reflections",
          [["user_id", "==", user.uid]],
          "reflection_date",
          "desc",
          50 // Limit to last 50 reflections
        );

        setReflections(data || []);
      } catch (error) {
        console.error("Error loading reflection history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadReflections();
  }, [user?.uid]);

  const getMoodEmoji = (mood: string) => {
    const moodMap: Record<string, string> = {
      good: "😊",
      neutral: "😐",
      tough: "😔",
    };
    return moodMap[mood.toLowerCase()] || "😐";
  };

  const formatDate = (dateString: string) => {
    try {
      // Handle both ISO format and YYYY-MM-DD format
      const date = dateString.includes("T") ? parseISO(dateString) : new Date(dateString + "T00:00:00");
      return format(date, "MMM d, yyyy");
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground">Loading your history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/reflection")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-heading font-black">Gratitude History</h1>
            <p className="text-sm text-muted-foreground">Your journey of gratitude</p>
          </div>
        </div>

        {reflections.length === 0 ? (
          <Card className="p-8 text-center space-y-4">
            <Heart className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <div>
              <h3 className="text-lg font-semibold mb-2">No reflections yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start your gratitude journey by logging your first reflection
              </p>
              <Button onClick={() => navigate("/reflection")}>Log Gratitude</Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {reflections.map((reflection) => (
              <Card key={reflection.id} className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-3xl">{getMoodEmoji(reflection.mood)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          {formatDate(reflection.reflection_date)}
                        </span>
                      </div>
                      <p className="text-lg font-semibold capitalize">
                        {reflection.mood.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                </div>

                {reflection.note && (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-sm text-muted-foreground mb-1">Your note:</p>
                    <p className="text-foreground">{reflection.note}</p>
                  </div>
                )}

                {reflection.ai_reply && (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-sm text-muted-foreground mb-1">Reflection:</p>
                    <p className="text-foreground p-3 bg-primary/5 rounded-lg border border-primary/20">
                      {reflection.ai_reply}
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

