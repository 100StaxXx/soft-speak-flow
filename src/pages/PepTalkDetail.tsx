import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { AudioPlayer } from "@/components/AudioPlayer";
import { TimedCaptions } from "@/components/TimedCaptions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Quote, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { GlassCard } from "@/components/ui/glass-card";
import { BottomNav } from "@/components/BottomNav";
import { Skeleton } from "@/components/ui/skeleton";

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
      const { data, error } = await supabase
        .from("pep_talks")
        .select("*")
        .eq("id", pepTalkId)
        .maybeSingle();

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
      navigate("/pep-talks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchPepTalk(id);
    }
     
  }, [id]);

  const handleTranscribe = async () => {
    if (!pepTalk || !id) return;
    
    setIsTranscribing(true);
    toast.info("Transcribing audio... This may take a minute.");
    
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audioUrl: pepTalk.audio_url, pepTalkId: id }
      });

      if (error) throw error;

      if (data?.transcript && Array.isArray(data.transcript)) {
        toast.success("Transcript is ready!");
        await fetchPepTalk(id);
      } else {
        throw new Error('No transcript data returned');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error("Failed to prepare transcript");
    } finally {
      setIsTranscribing(false);
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <StarfieldBackground />
        <div className="min-h-screen pb-nav-safe relative z-10">
          {/* Skeleton Header */}
          <div className="sticky top-0 z-50 cosmiq-glass-header border-b border-cosmiq-glow/10">
            <div className="max-w-lg mx-auto px-4 py-3 pt-safe">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
          </div>
          
          <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
            <div className="text-center space-y-4">
              <Skeleton className="h-6 w-24 mx-auto rounded-full" />
              <Skeleton className="h-10 w-3/4 mx-auto" />
            </div>
            <GlassCard variant="elevated" className="p-6">
              <Skeleton className="h-24 w-full" />
            </GlassCard>
            <GlassCard variant="default" className="p-6">
              <div className="flex justify-center gap-4 mb-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-16 w-16 rounded-full" />
                <Skeleton className="h-10 w-10 rounded-full" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </GlassCard>
          </div>
          <BottomNav />
        </div>
      </PageTransition>
    );
  }

  if (!pepTalk) {
    return null;
  }

  return (
    <PageTransition>
      <StarfieldBackground />
      <div className="min-h-screen pb-nav-safe relative z-10">
        {/* Sticky Header */}
        <div className="sticky top-0 z-50 cosmiq-glass-header border-b border-cosmiq-glow/10">
          <div className="max-w-lg mx-auto px-4 py-3 pt-safe">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/pep-talks")}
                className="rounded-full h-9 w-9 bg-muted/30 hover:bg-muted/50"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-muted-foreground truncate">
                {pepTalk.category}
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="space-y-6">
            {/* Category Badge */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary/20 to-stardust-gold/20 border border-cosmiq-glow/20 text-sm font-medium">
                <Sparkles className="h-3.5 w-3.5 text-stardust-gold" />
                {pepTalk.category}
              </span>
            </motion.div>

            {/* Title */}
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="font-heading text-3xl md:text-4xl font-bold text-center leading-tight"
            >
              {pepTalk.title}
            </motion.h1>

            {/* Quote Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <GlassCard variant="hero" glow="accent" className="p-6 relative overflow-hidden">
                {/* Decorative glow */}
                <div className="absolute -top-4 -left-4 w-24 h-24 bg-stardust-gold/20 rounded-full blur-2xl" />
                <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-primary/20 rounded-full blur-xl" />
                
                <div className="relative z-10">
                  <Quote className="h-8 w-8 text-stardust-gold mb-3 opacity-60" />
                  <p className="font-heading text-xl md:text-2xl italic leading-relaxed text-foreground/90">
                    {pepTalk.quote}
                  </p>
                  <div className="flex justify-end mt-3">
                    <Quote className="h-8 w-8 text-stardust-gold opacity-60 rotate-180" />
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            {/* Audio Player */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <AudioPlayer 
                audioUrl={pepTalk.audio_url} 
                title={pepTalk.title}
                onTimeUpdate={setCurrentTime}
              />
            </motion.div>

            {/* Transcription Status */}
            {(!pepTalk.transcript || pepTalk.transcript.length === 0) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
              >
                <GlassCard variant="elevated" glow="soft" className="p-6">
                  <div className="text-center space-y-4">
                    <div className="h-14 w-14 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-stardust-gold/20 flex items-center justify-center">
                      <FileText className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">No Transcript Available</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Prepare a word-by-word transcript with timestamps
                      </p>
                      <Button 
                        onClick={handleTranscribe}
                        disabled={isTranscribing}
                        className="w-full bg-gradient-to-r from-primary to-primary/80 hover:shadow-glow transition-all"
                      >
                        {isTranscribing ? (
                          <>
                            <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                            Transcribing...
                          </>
                        ) : (
                          <>
                            <FileText className="mr-2 h-4 w-4" />
                            Prepare Transcript
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )}

            {/* Timed Captions */}
            {pepTalk.transcript && pepTalk.transcript.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
              >
                <TimedCaptions 
                  transcript={pepTalk.transcript} 
                  currentTime={currentTime}
                />
              </motion.div>
            )}
          </div>
        </div>

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default PepTalkDetail;
