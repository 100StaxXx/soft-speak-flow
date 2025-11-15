import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { FloatingBubbles } from "@/components/FloatingBubbles";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

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

  const { data: quote, isLoading } = useQuery({
    queryKey: ["single-quote", selectedBubble, bubbleType],
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
    
    // Show quote and author immediately after data loads
    setTimeout(() => setShowQuote(true), 300);
    setTimeout(() => setShowAuthor(true), 800);
    setTimeout(() => setShowBack(true), 1200);
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
    <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 pb-24 relative overflow-hidden">
      {/* Cinematic background effects */}
      {selectedBubble && quote?.bgEffect === 'dark' && (
        <div className="fixed inset-0 bg-gradient-to-b from-black/40 via-black/20 to-transparent pointer-events-none z-0" />
      )}
      
      {/* Back Button */}
      {selectedBubble && (
        <button
          onClick={handleBack}
          className={`fixed top-8 left-8 z-50 p-3 rounded-full bg-white/90 backdrop-blur-sm border border-petal-pink/20 hover:bg-white transition-all duration-300 ${
            showBack ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
          }`}
        >
          <ArrowLeft className="h-5 w-5 text-warm-charcoal" />
        </button>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 relative z-10">
        {!selectedBubble ? (
          <>
            <div className="mb-2">
              <h1 className="font-display text-4xl text-warm-charcoal text-center">
                Quotes & Affirmations
              </h1>
            </div>
            <p className="text-warm-charcoal/70 text-center mb-8">
              Daily wisdom for your journey
            </p>

            <FloatingBubbles 
              onBubbleClick={handleBubbleClick}
              selectedValue={selectedBubble}
            />
          </>
        ) : (
          <div className="fixed inset-0 flex items-center justify-center z-20">
            {isLoading && !quoteData ? (
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-white border-r-transparent"></div>
              </div>
            ) : quoteData?.imageUrl ? (
              <div className={`absolute inset-0 transition-opacity duration-1000 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}>
                <img 
                  src={quoteData.imageUrl} 
                  alt="Quote"
                  className="w-full h-full object-cover"
                  onLoad={() => setImageLoaded(true)}
                />
              </div>
            ) : (
              <div className="text-center">
                <p className="text-white/60 text-lg">No quote found</p>
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
