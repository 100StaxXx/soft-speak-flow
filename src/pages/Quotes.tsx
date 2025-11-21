import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { FloatingBubbles } from "@/components/FloatingBubbles";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Download, Home } from "lucide-react";
import { toast } from "sonner";

const Quotes = () => {
  const [selectedBubble, setSelectedBubble] = useState<string | null>(null);
  const [bubbleType, setBubbleType] = useState<"trigger" | "category" | null>(null);
  const [showQuote, setShowQuote] = useState(false);
  const [showAuthor, setShowAuthor] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [quoteData, setQuoteData] = useState<{ text: string; author: string | null; category: string | null; imageUrl?: string } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [refetchCounter, setRefetchCounter] = useState(0);

  const { data: quote, isLoading, refetch } = useQuery({
    queryKey: ["single-quote", selectedBubble, bubbleType, refetchCounter],
    enabled: !!selectedBubble && !!bubbleType,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-single-quote', {
        body: { type: bubbleType, value: selectedBubble, includeImage: true }
      });

      if (error) throw error;
      
      // Show quote immediately
      const quoteResult = data?.quote;
      if (quoteResult) {
        // If no image URL, generate a gradient background
        if (!quoteResult.imageUrl) {
          
          
          const gradients = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
          ];
          const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];
          
          // Create a canvas with gradient and text
          const canvas = document.createElement('canvas');
          canvas.width = 1080;
          canvas.height = 1920;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            // Create gradient
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            const colors = randomGradient.match(/#[a-fA-F0-9]{6}/g) || ['#667eea', '#764ba2'];
            gradient.addColorStop(0, colors[0]);
            gradient.addColorStop(1, colors[1]);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Add quote text
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.font = 'bold 72px Arial';
            
            // Wrap text
            const words = quoteResult.text.split(' ');
            const lines: string[] = [];
            let currentLine = '';
            
            words.forEach(word => {
              const testLine = currentLine + word + ' ';
              const metrics = ctx.measureText(testLine);
              if (metrics.width > 900 && currentLine !== '') {
                lines.push(currentLine);
                currentLine = word + ' ';
              } else {
                currentLine = testLine;
              }
            });
            lines.push(currentLine);
            
            // Draw lines
            const lineHeight = 90;
            const startY = (canvas.height - lines.length * lineHeight) / 2;
            lines.forEach((line, i) => {
              ctx.fillText(line, canvas.width / 2, startY + i * lineHeight);
            });
            
            // Add author
            if (quoteResult.author) {
              ctx.font = 'italic 48px Arial';
              ctx.fillText(`— ${quoteResult.author}`, canvas.width / 2, startY + lines.length * lineHeight + 80);
            }
            
            quoteResult.imageUrl = canvas.toDataURL('image/png');
          }
        }
        
        setQuoteData(quoteResult);
        setImageLoaded(false);
      }
      
      return quoteResult;
    },
  });

  const handleBubbleClick = async (value: string, type: "trigger" | "category") => {
    setSelectedBubble(value);
    setBubbleType(type);
    setQuoteData(null);
    setShowQuote(false);
    setShowAuthor(false);
    setShowBack(false);
    setImageLoaded(false);
    setRefetchCounter(0);
    
    // Show UI elements quickly
    setTimeout(() => setShowQuote(true), 100);
    setTimeout(() => setShowAuthor(true), 200);
    setTimeout(() => setShowBack(true), 300);
  };

  const handleNextQuote = () => {
    setQuoteData(null);
    setImageLoaded(false);
    
    // Trigger a new fetch by incrementing the counter
    setRefetchCounter(prev => prev + 1);
  };

  const handleDownload = async () => {
    if (!quoteData?.imageUrl) {
      toast.error("No image to download");
      return;
    }
    
    try {
      // Check if it's a base64 image
      if (quoteData.imageUrl.startsWith('data:image')) {
        // Convert base64 to blob
        const base64Data = quoteData.imageUrl.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `quote-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast.success("Quote saved!");
      } else {
        // Handle regular URL
        const link = document.createElement('a');
        link.href = quoteData.imageUrl;
        link.download = `quote-${Date.now()}.png`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success("Quote saved!");
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error("Failed to save quote");
    }
  };

  const handleBack = () => {
    setShowQuote(false);
    setShowAuthor(false);
    setShowBack(false);
    setTimeout(() => {
      setSelectedBubble(null);
      setBubbleType(null);
    }, 300);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 pb-24">
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h2 className="font-display text-3xl text-warm-charcoal mb-4">
              Sign in to explore quotes
            </h2>
            <p className="text-warm-charcoal/70 mb-8">
              Create an account to save your favorite quotes and affirmations
            </p>
            <Button
              onClick={() => navigate("/auth")}
              className="bg-gradient-to-r from-blush-rose to-soft-mauve hover:opacity-90 text-white font-medium px-8 py-6 rounded-3xl shadow-soft"
            >
              Sign In
            </Button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 pb-20 relative overflow-hidden">
      <div className="max-w-md mx-auto px-4 py-6 relative z-10">
        {!selectedBubble ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="text-warm-charcoal hover:bg-warm-charcoal/10 rounded-full"
              >
                <Home className="h-5 w-5" />
              </Button>
              <h1 className="font-display text-2xl text-warm-charcoal flex-1 text-center">
                Quotes & Affirmations
              </h1>
              <div className="w-10" /> {/* Spacer for balance */}
            </div>
            <p className="text-warm-charcoal/70 text-center mb-6 text-sm">
              Daily wisdom for your journey
            </p>

            <FloatingBubbles 
              onBubbleClick={handleBubbleClick}
              selectedValue={selectedBubble}
            />
          </>
        ) : (
          <div className="fixed inset-0">
            {isLoading && !quoteData ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-warm-charcoal via-blush-rose/20 to-lavender-mist/30">
                <div className="text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-white border-r-transparent"></div>
                  <p className="text-white/80 text-sm mt-4 font-medium">Finding your quote...</p>
                </div>
              </div>
            ) : quoteData?.imageUrl ? (
              <>
                {/* Full Screen Quote Image */}
                <div className={`absolute inset-0 transition-all duration-1000 ${
                  imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}>
                  <img
                    src={quoteData.imageUrl}
                    alt="Quote"
                    className="w-full h-full object-cover"
                    onLoad={() => setImageLoaded(true)}
                    loading="lazy"
                    decoding="async"
                  />
                  
                  {/* Cinematic Gradient Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40 pointer-events-none" />
                </div>
                
                {/* Floating Action Buttons - Transparent Overlay */}
                {imageLoaded && (
                  <>
                    {/* Top Bar - Back Button */}
                    <div className="fixed top-6 left-0 right-0 flex items-center justify-between px-6 z-50 animate-fade-in">
                      <Button
                        onClick={handleBack}
                        size="sm"
                        variant="ghost"
                        className="bg-black/30 hover:bg-black/50 text-white backdrop-blur-md border border-white/10 shadow-lg rounded-full"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Bottom Action Buttons */}
                    <div className="fixed bottom-24 left-0 right-0 flex items-center justify-center gap-3 px-6 z-50 animate-fade-in">
                      <Button
                        onClick={handleDownload}
                        size="lg"
                        className="bg-white/10 hover:bg-white/20 text-white backdrop-blur-xl border border-white/20 shadow-2xl rounded-full px-8 transition-all duration-300 hover:scale-105"
                      >
                        <Download className="h-5 w-5 mr-2" />
                        Save
                      </Button>
                      <Button
                        onClick={handleNextQuote}
                        size="lg"
                        className="bg-white/10 hover:bg-white/20 text-white backdrop-blur-xl border border-white/20 shadow-2xl rounded-full px-8 transition-all duration-300 hover:scale-105"
                      >
                        <RefreshCw className="h-5 w-5 mr-2" />
                        Next
                      </Button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-warm-charcoal via-blush-rose/20 to-lavender-mist/30">
                <div className="text-center px-4">
                  <p className="text-white/60 text-sm">No quote found</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Quotes;
