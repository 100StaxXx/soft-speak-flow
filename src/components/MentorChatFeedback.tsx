import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, MessageSquare, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useResilience } from "@/contexts/ResilienceContext";
import { isQueueableWriteError } from "@/utils/networkErrors";

interface MentorChatFeedbackProps {
  messageContent: string;
  onFeedbackSubmitted?: () => void;
}

type FeedbackType = 'positive' | 'negative' | 'too_long' | 'too_short' | 'too_formal' | 'too_casual';

export const MentorChatFeedback = ({ messageContent, onFeedbackSubmitted }: MentorChatFeedbackProps) => {
  const { user } = useAuth();
  const { queueAction, shouldQueueWrites, reportApiFailure } = useResilience();
  const [expanded, setExpanded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedType, setSubmittedType] = useState<FeedbackType | null>(null);

  const submitFeedback = async (feedbackType: FeedbackType) => {
    if (!user || submitted) return;

    const payload = {
      message_content: messageContent.slice(0, 500),
      feedback_type: feedbackType,
    };

    if (shouldQueueWrites) {
      await queueAction({
        actionKind: "MENTOR_FEEDBACK",
        entityType: "mentor_feedback",
        payload,
      });
      setSubmitted(true);
      setSubmittedType(feedbackType);
      onFeedbackSubmitted?.();
      setTimeout(() => setExpanded(false), 1500);
      return;
    }

    try {
      const { error } = await supabase
        .from('mentor_chat_feedback')
        .insert({ user_id: user.id, ...payload });

      if (error) {
        if (isQueueableWriteError(error)) {
          await queueAction({
            actionKind: "MENTOR_FEEDBACK",
            entityType: "mentor_feedback",
            payload,
          });
        } else {
          console.error('Failed to submit feedback:', error);
          reportApiFailure(error, { source: "mentor_feedback_submit" });
          return;
        }
      }

      setSubmitted(true);
      setSubmittedType(feedbackType);
      onFeedbackSubmitted?.();
      
      // Auto-collapse after submission
      setTimeout(() => setExpanded(false), 1500);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      reportApiFailure(error, { source: "mentor_feedback_submit_catch" });
      if (isQueueableWriteError(error)) {
        await queueAction({
          actionKind: "MENTOR_FEEDBACK",
          entityType: "mentor_feedback",
          payload,
        });
        setSubmitted(true);
        setSubmittedType(feedbackType);
        onFeedbackSubmitted?.();
      }
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
        <span>Thanks for the feedback!</span>
        {submittedType === 'positive' && <ThumbsUp className="h-3 w-3 text-green-500" />}
        {submittedType === 'negative' && <ThumbsDown className="h-3 w-3 text-red-500" />}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1">
        {/* Quick feedback buttons */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-green-500/10"
          onClick={() => submitFeedback('positive')}
          aria-label="Good response"
        >
          <ThumbsUp className="h-3 w-3 text-muted-foreground hover:text-green-500" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-red-500/10"
          onClick={() => submitFeedback('negative')}
          aria-label="Bad response"
        >
          <ThumbsDown className="h-3 w-3 text-muted-foreground hover:text-red-500" />
        </Button>
        
        {/* Expand for more options */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          <MessageSquare className="h-3 w-3 mr-1" />
          More
          {expanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
        </Button>
      </div>

      {/* Expanded feedback options */}
      {expanded && (
        <div className="flex flex-wrap gap-1 mt-2 animate-in slide-in-from-top-2 duration-200">
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => submitFeedback('too_long')}
          >
            Too long
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => submitFeedback('too_short')}
          >
            Too short
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => submitFeedback('too_formal')}
          >
            Too formal
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => submitFeedback('too_casual')}
          >
            Too casual
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setExpanded(false)}
            aria-label="Close feedback options"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};
