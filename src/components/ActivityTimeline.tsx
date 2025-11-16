import { useActivityFeed } from "@/hooks/useActivityFeed";
import { Card } from "@/components/ui/card";
import { CheckCircle, MessageSquare, Heart, Target, Calendar, Volume2, Sparkles, Reply } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "./ui/button";
import { useState } from "react";
import { useWelcomeMessage } from "@/hooks/useWelcomeMessage";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { Textarea } from "./ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const activityIcons: Record<string, any> = {
  welcome: Sparkles,
  habit_completed: CheckCircle,
  mood_logged: Heart,
  pep_talk_listened: Volume2,
  chat_message: MessageSquare,
  reflection_completed: Calendar,
  goal_set: Target,
};

const activityLabels: Record<string, string> = {
  welcome: "joined the journey",
  habit_completed: "completed a habit",
  mood_logged: "logged your mood",
  pep_talk_listened: "listened to pep talk",
  chat_message: "chatted with mentor",
  reflection_completed: "completed reflection",
  goal_set: "set a goal",
};

export const ActivityTimeline = () => {
  const { user } = useAuth();
  const { activities, isLoading, markAsRead } = useActivityFeed();
  const personality = useMentorPersonality();
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Add welcome message for new users
  useWelcomeMessage();

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const handleReply = async (activityId: string) => {
    if (!replyText.trim() || !user) return;
    
    setIsSubmitting(true);
    try {
      // Generate AI response to the user's reply
      const { data, error } = await supabase.functions.invoke('generate-activity-comment', {
        body: { 
          activityId,
          userReply: replyText.trim()
        }
      });

      if (error) throw error;

      toast.success("Reply sent!");
      setReplyText("");
      setReplyingTo(null);
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error("Failed to send reply");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activities.length) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">
          {personality?.emptyState("Your journey") || "Your journey starts now. Take your first step."}
        </p>
      </Card>
    );
  }

  const handlePlayVoice = (url: string, activityId: string) => {
    if (playingAudio === activityId) {
      setPlayingAudio(null);
      return;
    }
    
    const audio = new Audio(url);
    audio.play();
    setPlayingAudio(activityId);
    audio.onended = () => setPlayingAudio(null);
    markAsRead(activityId);
  };

  return (
    <div className="space-y-3">
      {activities.map((activity) => {
        const Icon = activityIcons[activity.activity_type] || MessageSquare;
        const label = activityLabels[activity.activity_type] || activity.activity_type;
        
        return (
          <Card 
            key={activity.id} 
            className={`p-4 transition-all ${!activity.is_read ? 'border-primary shadow-glow' : ''}`}
          >
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    You {label}
                    {activity.activity_data?.habit_title && (
                      <span className="font-semibold text-foreground"> • {activity.activity_data.habit_title}</span>
                    )}
                  </p>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </span>
                </div>
                
                {activity.mentor_comment && (
                  <div className="bg-secondary/30 rounded-lg p-3 border-l-2 border-primary">
                    <p className="text-sm italic text-foreground">{activity.mentor_comment}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  {activity.mentor_voice_url && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => handlePlayVoice(activity.mentor_voice_url!, activity.id)}
                    >
                      <Volume2 className={`h-3 w-3 mr-1 ${playingAudio === activity.id ? 'animate-pulse' : ''}`} />
                      <span className="text-xs">
                        {playingAudio === activity.id ? 'Playing...' : 'Listen'}
                      </span>
                    </Button>
                  )}
                  
                  {activity.mentor_comment && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => setReplyingTo(replyingTo === activity.id ? null : activity.id)}
                    >
                      <Reply className="h-3 w-3 mr-1" />
                      <span className="text-xs">Reply</span>
                    </Button>
                  )}
                </div>

                {/* Reply input */}
                {replyingTo === activity.id && (
                  <div className="space-y-2 pt-2">
                    <Textarea
                      placeholder="Share your thoughts..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="min-h-[80px] text-sm"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleReply(activity.id)}
                        disabled={!replyText.trim() || isSubmitting}
                      >
                        {isSubmitting ? "Sending..." : "Send"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
