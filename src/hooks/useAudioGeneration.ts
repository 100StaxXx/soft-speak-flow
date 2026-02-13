import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      const { data, error } = await supabase.functions.invoke("generate-mentor-script", {
        body: options,
      });

      if (error) throw error;
      return data?.script || null;
    } catch (error) {
      console.error("Error generating script:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to prepare script";
      toast.error(errorMessage);
      return null;
    }
  };

  const generateAudio = async (
    mentorSlug: string,
    script: string
  ): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-mentor-audio", {
        body: { mentorSlug, script },
      });

      if (error) throw error;
      return data?.audioUrl || null;
    } catch (error) {
      console.error("Error generating audio:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to prepare audio";
      toast.error(errorMessage);
      return null;
    }
  };

  const generateFullAudio = async (
    options: GenerateAudioOptions
  ): Promise<{ script: string; audioUrl: string } | null> => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-full-mentor-audio", {
        body: options,
      });

      if (error) throw error;

      if (data?.script && data?.audioUrl) {
        return {
          script: data.script,
          audioUrl: data.audioUrl,
        };
      }

      throw new Error("Invalid response from server");
    } catch (error) {
      console.error("Error generating full audio:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to prepare audio";
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
