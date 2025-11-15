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
  onAudioGenerated?: (script: string, audioUrl: string) => void;
}

export const AudioGenerator = ({ onAudioGenerated }: AudioGeneratorProps) => {
  const [selectedMentor, setSelectedMentor] = useState<string>("");
  const [category, setCategory] = useState<string>("motivation");
  const [intensity, setIntensity] = useState<string>("medium");
  const [emotionalTriggers, setEmotionalTriggers] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string>("");
  const [audioUrl, setAudioUrl] = useState<string>("");

  const mentors = [
    { slug: "atlas", name: "Atlas" },
    { slug: "darius", name: "Darius" },
    { slug: "eli", name: "Eli" },
    { slug: "nova", name: "Nova" },
    { slug: "sienna", name: "Sienna" },
    { slug: "lumi", name: "Lumi" },
    { slug: "kai", name: "Kai" },
    { slug: "stryker", name: "Stryker" },
    { slug: "solace", name: "Solace" },
  ];

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
    "overwhelmed",
    "procrastinating",
    "anxious",
    "stuck",
    "doubtful",
    "tired",
    "frustrated",
    "inspired",
  ];

  const handleGenerate = async () => {
    if (!selectedMentor) {
      toast.error("Please select a mentor");
      return;
    }

    setIsGenerating(true);
    setGeneratedScript("");
    setAudioUrl("");

    try {
      const { data, error } = await supabase.functions.invoke("generate-full-mentor-audio", {
        body: {
          mentorSlug: selectedMentor,
          category,
          intensity,
          emotionalTriggers,
        },
      });

      if (error) throw error;

      if (data?.script && data?.audioUrl) {
        setGeneratedScript(data.script);
        setAudioUrl(data.audioUrl);
        toast.success("Audio generated successfully!");
        
        if (onAudioGenerated) {
          onAudioGenerated(data.script, data.audioUrl);
        }
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error: any) {
      console.error("Error generating audio:", error);
      toast.error(error.message || "Failed to generate audio");
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
          Generate Audio with AI
        </CardTitle>
        <CardDescription>
          Generate a custom motivational audio message with ElevenLabs Text-to-Speech
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
              Generating...
            </>
          ) : (
            "Generate Audio"
          )}
        </Button>

        {generatedScript && (
          <div className="space-y-2">
            <Label>Generated Script</Label>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">{generatedScript}</p>
            </div>
          </div>
        )}

        {audioUrl && (
          <div className="space-y-2">
            <Label>Generated Audio</Label>
            <audio controls className="w-full" src={audioUrl}>
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
