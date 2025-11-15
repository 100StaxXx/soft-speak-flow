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

  const { data: quote, isLoading } = useQuery({
    queryKey: ["single-quote", selectedBubble, bubbleType],
    enabled: !!selectedBubble && !!bubbleType,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-single-quote', {
        body: { type: bubbleType, value: selectedBubble }
      });

      if (error) throw error;
      return data?.quote;
    },
  });

  const handleBubbleClick = async (value: string, type: "trigger" | "category") => {
    setSelectedBubble(value);
    setBubbleType(type);
    setShowQuote(false);
    setShowAuthor(false);
    setShowBack(false);
    
    // Trigger animations in sequence (slower)
    setTimeout(() => setShowQuote(true), 500);
    setTimeout(() => setShowAuthor(true), 2500);
    setTimeout(() => setShowBack(true), 3500);
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
          <div className="min-h-[80vh] flex items-center justify-center relative">
            {isLoading ? (
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blush-rose border-r-transparent"></div>
              </div>
            ) : quote ? (
              <div className="max-w-5xl mx-auto text-center space-y-10 px-8 py-12">
                {quote.imageUrl && (
                  <div className="relative">\
                    <img 
                      src={quote.imageUrl} 
                      alt="Quote visualization"
                      className={`w-full max-w-3xl mx-auto rounded-3xl shadow-2xl transition-all duration-1500 ${
                        showQuote ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                      }`}
                    />
                    {/* Cinematic overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-3xl pointer-events-none" />
                  </div>
                )}
                <p 
                  className={`font-${quote.fontFamily || 'quote'} text-5xl md:text-6xl lg:text-7xl text-warm-charcoal leading-tight tracking-wide transition-all duration-1500 drop-shadow-2xl ${
                    showQuote ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                  }`}
                  style={{ 
                    textShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    letterSpacing: '0.02em'
                  }}
                >
                  "{quote.text}"
                </p>
                <p 
                  className={`text-3xl md:text-4xl text-blush-rose font-semibold transition-all duration-1500 tracking-wider ${
                    showAuthor ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{ textShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
                >
                  — {quote.author}
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-warm-charcoal/60 text-lg">No quote found</p>
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
