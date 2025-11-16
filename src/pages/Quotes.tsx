import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { FloatingBubbles } from "@/components/FloatingBubbles";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";

const Quotes = () => {
  const [selectedBubble, setSelectedBubble] = useState<string | null>(null);
  const [bubbleType, setBubbleType] = useState<"trigger" | "category" | null>(null);
  const [showQuote, setShowQuote] = useState(false);
  const [showAuthor, setShowAuthor] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [quoteData, setQuoteData] = useState<any>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [refetchCounter, setRefetchCounter] = useState(0);

  const { data: quote, isLoading, refetch } = useQuery({
    queryKey: ["single-quote", selectedBubble, bubbleType, refetchCounter],
    enabled: !!selectedBubble && !!bubbleType,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-single-quote', {
        body: { type: bubbleType, value: selectedBubble }
      });

      if (error) throw error;
      
      // Show quote immediately
      const quoteResult = data?.quote;
      if (quoteResult) {
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
    if (!quoteData?.imageUrl) return;
    
    try {
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
            <div className="mb-2">
              <h1 className="font-display text-2xl text-warm-charcoal text-center">
                Quotes & Affirmations
              </h1>
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
