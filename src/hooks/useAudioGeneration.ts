import { useState } from "react";
import { toast } from "sonner";
import { generateMentorScript, generateMentorAudio, generateFullMentorAudio } from "@/lib/firebase/functions";

interface GenerateAudioOptions {
  mentorSlug: string;
  category?: string;
  intensity?: string;
  emotionalTriggers?: string[];
}

interface GenerateScriptOptions {
  mentorSlug: string;
  category?: string;
  intensity?: string;
  emotionalTriggers?: string[];
}

export const useAudioGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateScript = async (options: GenerateScriptOptions): Promise<string | null> => {
    try {
      const data = await generateMentorScript({
        mentorSlug: options.mentorSlug,
        topic: options.category || 'motivation',
        tone: options.intensity,
      });
      
      return data?.script || null;
    } catch (error) {
      console.error("Error generating script:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate script";
      toast.error(errorMessage);
      return null;
    }
  };

  const generateAudio = async (
    mentorSlug: string,
    script: string
  ): Promise<string | null> => {
    try {
      const data = await generateMentorAudio({
        mentorSlug,
        script,
      });
      
      return data?.audioUrl || null;
    } catch (error) {
      console.error("Error generating audio:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate audio";
      toast.error(errorMessage);
      return null;
    }
  };

  const generateFullAudio = async (
    options: GenerateAudioOptions
  ): Promise<{ script: string; audioUrl: string } | null> => {
    setIsGenerating(true);
    try {
      const data = await generateFullMentorAudio({
        mentorSlug: options.mentorSlug,
        topicCategory: options.category,
        intensity: options.intensity,
        emotionalTriggers: options.emotionalTriggers,
      });
      
      if (data?.script && data?.audioUrl) {
        return {
          script: data.script,
          audioUrl: data.audioUrl,
        };
      }
      
      return null;
    } catch (error) {
      console.error("Error generating full audio:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate audio";
      toast.error(errorMessage);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    generateScript,
    generateAudio,
    generateFullAudio,
  };
};
