import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AudioPlayer } from "@/components/AudioPlayer";
import { TimedCaptions } from "@/components/TimedCaptions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface CaptionWord {
  word: string;
  start: number;
  end: number;
}

interface PepTalk {
  id: string;
  title: string;
  category: string;
  quote: string;
  description: string;
  audio_url: string;
  is_featured: boolean;
  created_at: string;
  transcript: CaptionWord[];
}

const PepTalkDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pepTalk, setPepTalk] = useState<PepTalk | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (id) {
      fetchPepTalk(id);
    }
  }, [id]);

  const fetchPepTalk = async (pepTalkId: string) => {
    try {
      const { data, error } = await supabase
        .from("pep_talks")
        .select("*")
        .eq("id", pepTalkId)
        .single();

      if (error) throw error;
      
      // Parse transcript from JSON to proper type
      const transcript = Array.isArray(data.transcript) 
        ? (data.transcript as unknown as CaptionWord[]) 
        : [];
      
      const parsedData = {
        ...data,
        transcript
      };
      
      setPepTalk(parsedData as PepTalk);
    } catch (error) {
      console.error("Error fetching pep talk:", error);
      toast.error("Failed to load pep talk");
      navigate("/library");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-cream-glow to-petal-pink/30">
        <div className="animate-pulse text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!pepTalk) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-lavender-mist/20 via-petal-pink/20 to-cream-glow">
      <div className="max-w-lg mx-auto px-6 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 rounded-full hover:bg-secondary"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="space-y-6">
          {/* Category */}
          <div className="text-center">
            <span className="inline-block px-4 py-1.5 rounded-full bg-lavender-mist/30 text-sm font-medium text-foreground">
              {pepTalk.category}
            </span>
          </div>

          {/* Title */}
          <h1 className="font-heading text-4xl font-bold text-center text-foreground leading-tight">
            {pepTalk.title}
          </h1>

          {/* Quote */}
          <div className="bg-card rounded-3xl p-6 shadow-soft">
            <div className="text-5xl text-blush-rose mb-2">"</div>
            <p className="font-heading text-xl text-foreground italic leading-relaxed">
              {pepTalk.quote}
            </p>
            <div className="text-5xl text-blush-rose text-right">"</div>
          </div>

          {/* Audio Player */}
          <AudioPlayer 
            audioUrl={pepTalk.audio_url} 
            title={pepTalk.title}
            onTimeUpdate={setCurrentTime}
          />

          {/* Timed Captions */}
          <TimedCaptions 
            transcript={pepTalk.transcript || []} 
            currentTime={currentTime}
          />
        </div>
      </div>
    </div>
  );
};

export default PepTalkDetail;
