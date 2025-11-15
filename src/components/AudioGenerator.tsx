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
    category: string;
    audio_url: string;
  }) => void;
  mentors: any[];
}

export const AudioGenerator = ({ onFullPepTalkGenerated, mentors }: AudioGeneratorProps) => {
  const [selectedMentor, setSelectedMentor] = useState<string>("");
  const [category, setCategory] = useState<string>("motivation");
  const [intensity, setIntensity] = useState<string>("medium");
  const [emotionalTriggers, setEmotionalTriggers] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const categories = [
    "motivation",
    "discipline",
    "growth",
    "confidence",
    "focus",
    "resilience",
    "mindfulness",
    "action",
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
            category,
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

      toast.success("Complete pep talk generated successfully!");

      // Pass all data to parent component
      if (onFullPepTalkGenerated) {
        onFullPepTalkGenerated({
          title: contentData.title,
          quote: contentData.quote,
          description: contentData.description,
          category: contentData.category,
          audio_url: audioData.audioUrl,
        });
      }
    } catch (error: any) {
      console.error("Error generating complete pep talk:", error);
      toast.error(error.message || "Failed to generate pep talk");
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
          Fully AI-Generate Pep Talk
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
            <SelectContent>
              {mentors.map((mentor) => {
                const config = getMentorVoiceConfig(mentor.slug);
                return (
                  <SelectItem key={mentor.slug} value={mentor.slug}>
                    {mentor.name} ({config?.voiceName || "Unknown"})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              Fully AI-Generate Pep Talk
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
