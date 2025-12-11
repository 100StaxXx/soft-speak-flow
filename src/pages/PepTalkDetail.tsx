import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDocument, updateDocument } from "@/lib/firebase/firestore";
import { AudioPlayer } from "@/components/AudioPlayer";
import { TimedCaptions } from "@/components/TimedCaptions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import { toast } from "sonner";
import { transcribeAudio } from "@/lib/firebase/functions";

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
  const [isTranscribing, setIsTranscribing] = useState(false);

  const fetchPepTalk = async (pepTalkId: string) => {
    try {
      const data = await getDocument<PepTalk>("pep_talks", pepTalkId);

      if (!data) {
        throw new Error("Pep talk not found");
      }
      
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

  useEffect(() => {
    if (id) {
      fetchPepTalk(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // fetchPepTalk is stable and depends on id

  const handleTranscribe = async () => {
    if (!pepTalk || !id) return;
    
    setIsTranscribing(true);
    toast.info("Transcribing audio... This may take a minute.");
    
    try {
      const data = await transcribeAudio({
        audioUrl: pepTalk.audio_url,
      });

      if (data?.transcript && Array.isArray(data.transcript)) {
        // Update the database with the new transcript
        await updateDocument('pep_talks', id!, { transcript: data.transcript });
        toast.success("Transcript generated successfully!");
        // Refresh the pep talk to show the new transcript
        await fetchPepTalk(id!);
      } else {
        throw new Error('No transcript data returned');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error("Failed to generate transcript");
    } finally {
      setIsTranscribing(false);
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
          onClick={() => navigate("/inspire")}
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

          {/* Transcription Status */}
          {(!pepTalk.transcript || pepTalk.transcript.length === 0) && (
            <div className="bg-card rounded-3xl p-6 shadow-soft border border-primary/20">
              <div className="text-center space-y-4">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="font-semibold mb-2">No Transcript Available</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate a word-by-word transcript with timestamps for this pep talk
                  </p>
                  <Button 
                    onClick={handleTranscribe}
                    disabled={isTranscribing}
                    className="w-full"
                  >
                    {isTranscribing ? (
                      <>
                        <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                        Transcribing...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Generate Transcript
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Timed Captions */}
          {pepTalk.transcript && pepTalk.transcript.length > 0 && (
            <TimedCaptions 
              transcript={pepTalk.transcript} 
              currentTime={currentTime}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PepTalkDetail;
