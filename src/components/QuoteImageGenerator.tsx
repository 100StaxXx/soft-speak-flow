import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Download } from "lucide-react";
import { Card } from "@/components/ui/card";

interface QuoteImageGeneratorProps {
  quoteText: string;
  author?: string | null;
  category?: string;
  intensity?: string;
  emotionalTrigger?: string;
  className?: string;
}

export const QuoteImageGenerator = ({
  quoteText,
  author,
  category = "motivation",
  intensity = "moderate",
  emotionalTrigger,
  className = "",
}: QuoteImageGeneratorProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const generateImage = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quote-image", {
        body: {
          quoteText,
          author: author || "Unknown",
          category,
          intensity,
          emotionalTrigger,
        },
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        toast.success("Quote image generated!");
      } else {
        throw new Error("No image URL returned");
      }
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error(error.message || "Failed to generate image");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;

    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `quote-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Image downloaded!");
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {!generatedImage ? (
        <Button
          onClick={generateImage}
          disabled={isGenerating}
          className="w-full"
          variant="outline"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Image...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Quote Image
            </>
          )}
        </Button>
      ) : (
        <Card className="p-4 space-y-4">
          <div className="relative rounded-lg overflow-hidden">
            <img
              src={generatedImage}
              alt={`Quote: ${quoteText}`}
              className="w-full h-auto"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={downloadImage}
              variant="outline"
              className="flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button
              onClick={generateImage}
              disabled={isGenerating}
              variant="outline"
              className="flex-1"
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Regenerate
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
