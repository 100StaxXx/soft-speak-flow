import { useActivityFeed } from "@/hooks/useActivityFeed";
import { Card } from "@/components/ui/card";
import { CheckCircle, MessageSquare, Heart, Target, Calendar, Volume2, Sparkles, Reply, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "./ui/button";
import { useState, useRef, useCallback } from "react";
import { useWelcomeMessage } from "@/hooks/useWelcomeMessage";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { Textarea } from "./ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { globalAudio } from "@/utils/globalAudio";

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
  companion_evolved: "companion evolved",
  mission_completed: "completed a mission",
  streak_milestone: "reached a streak milestone"
};

export const ActivityTimeline = () => {
  const { user } = useAuth();
  const { activities, markAsRead } = useActivityFeed();
  const queryClient = useQueryClient();
  const personality = useMentorPersonality();
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [swipedItems, setSwipedItems] = useState<Record<string, number>>({});
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  
  // Add welcome message for new users
  useWelcomeMessage();

  const handleReply = async (activityId: string) => {
    if (!replyText.trim() || !user) return;
    
    setIsSubmitting(true);
    try {
      // Generate AI response to the user's reply
      const { error } = await supabase.functions.invoke('generate-activity-comment', {
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

  const handleTouchStart = useCallback((e: React.TouchEvent, _activityId: string) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent, activityId: string) => {
    if (!touchStart.current) return;
    
    const deltaX = e.touches[0].clientX - touchStart.current.x;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(e.touches[0].clientY - touchStart.current.y);
    
    // Only swipe if clearly horizontal (2:1 ratio) and minimum threshold met
    // This prevents accidental swipes when scrolling vertically
    if (absDeltaX > absDeltaY * 2 && absDeltaX > 15 && deltaX < 0) {
      setSwipedItems(prev => ({ ...prev, [activityId]: Math.max(deltaX, -100) }));
    }
  }, []);

  const handleTouchEnd = useCallback(async (activityId: string) => {
    if (!touchStart.current) return;
    
    const swipeDistance = swipedItems[activityId] || 0;
    
    // If swiped more than 60px, delete
    if (swipeDistance < -60) {
      try {
        await supabase
          .from('activity_feed')
          .delete()
          .eq('id', activityId);
        
        toast.success("Activity removed");
        queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
      } catch (error) {
        console.error('Error deleting activity:', error);
        toast.error("Failed to delete");
      }
    }
    
    // Reset swipe
    setSwipedItems(prev => {
      const newState = { ...prev };
      delete newState[activityId];
      return newState;
    });
    touchStart.current = null;
  }, [swipedItems, queryClient]);

  const handlePlayVoice = (url: string, activityId: string) => {
    if (playingAudio === activityId) {
      setPlayingAudio(null);
      return;
    }
    
    // Don't play if globally muted
    if (globalAudio.getMuted()) {
      return;
    }
    
    const audio = new Audio(url);
    audio.play().catch(err => console.error('Audio play failed:', err));
    setPlayingAudio(activityId);
    audio.onended = () => setPlayingAudio(null);
    markAsRead(activityId);
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

  return (
    <div className="space-y-3">
      {activities.map((activity) => {
        const Icon = activityIcons[activity.activity_type] || MessageSquare;
        const label = activityLabels[activity.activity_type] || activity.activity_type;
        
        return (
          <div 
            key={activity.id} 
            className="relative overflow-hidden"
            style={{ touchAction: 'pan-y pinch-zoom' }}
            onTouchStart={(e) => handleTouchStart(e, activity.id)}
            onTouchMove={(e) => handleTouchMove(e, activity.id)}
            onTouchEnd={() => handleTouchEnd(activity.id)}
          >
            {/* Delete background */}
            <div className="absolute inset-0 bg-destructive flex items-center justify-end pr-6">
              <Trash2 className="h-5 w-5 text-destructive-foreground" />
            </div>
            
            <Card 
              className={cn(
                "p-4 transition-all relative bg-card",
                !activity.is_read ? 'border-primary shadow-glow' : ''
              )}
              style={{
                transform: `translateX(${swipedItems[activity.id] || 0}px)`,
                transition: swipedItems[activity.id] ? 'none' : 'transform 0.3s ease'
              }}
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
                    {'habit_title' in activity.activity_data && typeof activity.activity_data.habit_title === 'string' && (
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
                      style={{ 
                        touchAction: 'pan-y',
                        WebkitTapHighlightColor: 'transparent'
                      }}
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
        </div>
        );
      })}
    </div>
  );
};
