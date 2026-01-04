import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getMentorVoiceConfig } from "@/config/mentorVoices";

interface AudioGeneratorProps {
  onFullPepTalkGenerated?: (pepTalkData: {
    title: string;
    quote: string;
    description: string;
    topic_category: string[];
    emotional_triggers: string[];
    audio_url: string;
    mentor_id: string;
    transcript: Array<{ word: string; start: number; end: number }>;
  }) => void;
  mentors: Array<{ id: string; slug: string; name: string }>;
}

export const AudioGenerator = ({ onFullPepTalkGenerated, mentors }: AudioGeneratorProps) => {
  const [selectedMentor, setSelectedMentor] = useState<string>("");
  const [topicCategories, setTopicCategories] = useState<string[]>([]);
  const [intensity, setIntensity] = useState<string>("medium");
  const [emotionalTriggers, setEmotionalTriggers] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const topicCategoryOptions = [
    { label: "Discipline", value: "discipline" },
    { label: "Confidence", value: "confidence" },
    { label: "Physique", value: "physique" },
    { label: "Focus", value: "focus" },
    { label: "Mindset", value: "mindset" },
    { label: "Business", value: "business" },
  ];

  const triggers = [
    "Exhausted",
    "Avoiding Action",
    "Anxious & Overthinking",
    "Self-Doubt",
    "Feeling Stuck",
    "Frustrated",
    "Heavy or Low",
    "Emotionally Hurt",
    "Unmotivated",
    "In Transition",
    "Needing Discipline",
    "Motivated & Ready",
  ];

  const handleGenerate = async () => {
    if (!selectedMentor) {
      toast.error("Please select a mentor");
      return;
    }

    const mentor = mentors.find(m => m.slug === selectedMentor);
    if (!mentor) {
      toast.error("Invalid mentor selected");
      return;
    }

    setIsGenerating(true);

    try {
      // Step 1: Generate complete pep talk content
      toast.info("Generating pep talk content...");
      const { data: contentData, error: contentError } = await supabase.functions.invoke(
        "generate-complete-pep-talk",
        {
        body: {
          mentorSlug: selectedMentor,
          topic_category: topicCategories,
          intensity,
          emotionalTriggers,
        },
        }
      );

      if (contentError) throw contentError;

      // Step 2: Generate audio from the script
      toast.info("Generating audio...");
      const { data: audioData, error: audioError } = await supabase.functions.invoke(
        "generate-mentor-audio",
        {
          body: {
            mentorSlug: selectedMentor,
            script: contentData.script,
          },
        }
      );

      if (audioError) throw audioError;

      // Step 3: Transcribe the audio
      toast.info("Transcribing audio...");
      let transcript: Array<{ word: string; start: number; end: number }> = [];
      
      try {
        const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke(
          "transcribe-audio",
          {
            body: {
              audioUrl: audioData.audioUrl,
            },
          }
        );

        if (transcriptError) {
          console.error("Transcription error:", transcriptError);
          toast.warning("Audio generated but transcription failed");
        } else if (transcriptData?.transcript) {
          transcript = transcriptData.transcript;
          toast.success("Complete pep talk with transcript generated!");
        }
      } catch (transcriptError) {
        console.error("Transcription error:", transcriptError);
        toast.warning("Audio generated but transcription failed");
      }

      // Pass all data to parent component including transcript
      if (onFullPepTalkGenerated) {
        onFullPepTalkGenerated({
          title: contentData.title,
          quote: contentData.quote,
          description: contentData.description,
          topic_category: topicCategories,
          emotional_triggers: emotionalTriggers,
          audio_url: audioData.audioUrl,
          mentor_id: mentor.id,
          transcript,
        });
      }
    } catch (error) {
      console.error("Error generating complete pep talk:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate pep talk");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleTrigger = (trigger: string) => {
    setEmotionalTriggers((prev) =>
      prev.includes(trigger) ? prev.filter((t) => t !== trigger) : [...prev, trigger]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          Generate Pep Talk
        </CardTitle>
        <CardDescription>
          Select options below, then generate a complete pep talk with title, description, script, and audio
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="mentor">Select Mentor</Label>
          <Select value={selectedMentor} onValueChange={setSelectedMentor}>
            <SelectTrigger id="mentor">
              <SelectValue placeholder="Choose a mentor..." />
            </SelectTrigger>
            <SelectContent className="bg-background z-50 max-h-[300px]">
              {mentors.map((mentor) => {
                const config = getMentorVoiceConfig(mentor.slug);
                const displayText = `${mentor.name} (${config?.voiceName || "Unknown"})`;
                return (
                  <SelectItem 
                    key={mentor.slug} 
                    value={mentor.slug} 
                    className="cursor-pointer"
                  >
                    {displayText}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="topic-category">Topic Categories (select multiple, up to 4)</Label>
          <div className="flex flex-wrap gap-2">
            {topicCategoryOptions.map((cat) => (
              <Button
                key={cat.value}
                type="button"
                variant={topicCategories.includes(cat.value) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (topicCategories.includes(cat.value)) {
                    setTopicCategories(topicCategories.filter(c => c !== cat.value));
                  } else if (topicCategories.length < 4) {
                    setTopicCategories([...topicCategories, cat.value]);
                  } else {
                    toast.error("Maximum 4 categories allowed");
                  }
                }}
              >
                {cat.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Click to select/deselect categories. Selected: {topicCategories.length}/4
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="intensity">Intensity</Label>
          <Select value={intensity} onValueChange={setIntensity}>
            <SelectTrigger id="intensity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gentle">Gentle</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Emotional Triggers (Optional)</Label>
          <div className="flex flex-wrap gap-2">
            {triggers.map((trigger) => (
              <Button
                key={trigger}
                variant={emotionalTriggers.includes(trigger) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleTrigger(trigger)}
                type="button"
              >
                {trigger}
              </Button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !selectedMentor}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Complete Pep Talk...
            </>
          ) : (
            <>
              <Music className="mr-2 h-4 w-4" />
              Generate Pep Talk
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
