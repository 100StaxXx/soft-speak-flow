import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { FloatingBubbles } from "@/components/FloatingBubbles";
import { PepTalkCard } from "@/components/PepTalkCard";
import { SearchBar } from "@/components/SearchBar";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PepTalk {
  id: string;
  title: string;
  category: string;
  quote: string;
  description: string;
  audio_url: string;
  is_featured: boolean;
  created_at: string;
  emotional_triggers?: string[];
  topic_category?: string[];
  intensity?: string;
}

const Inspire = () => {
  const [activeTab, setActiveTab] = useState<"quotes" | "audio">("quotes");
  const [selectedBubble, setSelectedBubble] = useState<string | null>(null);
  const [bubbleType, setBubbleType] = useState<"trigger" | "category" | null>(null);
  const [showQuote, setShowQuote] = useState(false);
  const [showAuthor, setShowAuthor] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [refetchCounter, setRefetchCounter] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch quote (without AI image by default)
  const { data: quote, isLoading } = useQuery({
    queryKey: ["single-quote", selectedBubble, bubbleType, refetchCounter],
    enabled: !!selectedBubble && !!bubbleType && activeTab === "quotes",
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-single-quote', {
        body: { type: bubbleType, value: selectedBubble, includeImage: false }
      });

      if (error) throw error;
      
      const quoteResult = data?.quote;
      if (quoteResult) {
        setQuoteData(quoteResult);
        setImageLoaded(false);
      }
      
      return quoteResult;
    },
  });

  // Fetch pep talks
  const { data: pepTalks = [], isLoading: pepTalksLoading } = useQuery({
    queryKey: ["pep-talks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pep_talks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PepTalk[];
    },
  });

  // Extract unique categories and triggers
  const allCategories = Array.from(
    new Set(
      pepTalks.flatMap(p => {
        const cats = [
          p.category,
          ...(p.topic_category || [])
        ].filter(Boolean);
        
        // Split comma-separated categories
        return cats.flatMap(cat => 
          cat.split(',').map(c => c.trim().toLowerCase())
        );
      })
    )
  ).sort();

  const allTriggers = Array.from(
    new Set(
      pepTalks.flatMap(p => p.emotional_triggers || [])
    )
  ).sort();

  const filteredPepTalks = pepTalks.filter(p => {
    const matchesSearch = !searchQuery || 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.quote.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Split and normalize categories for matching
    const pepTalkCategories = [p.category, ...(p.topic_category || [])]
      .filter(Boolean)
      .flatMap(cat => cat.split(',').map(c => c.trim().toLowerCase()));
    
    const matchesCategory = selectedCategories.length === 0 || 
      selectedCategories.some(cat => pepTalkCategories.includes(cat));
    
    const pepTalkTriggers = p.emotional_triggers || [];
    const matchesTriggers = selectedTriggers.length === 0 || 
      selectedTriggers.some(trigger => pepTalkTriggers.includes(trigger));
    
    return matchesSearch && matchesCategory && matchesTriggers;
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
    
    setTimeout(() => setShowQuote(true), 100);
    setTimeout(() => setShowAuthor(true), 200);
    setTimeout(() => setShowBack(true), 300);
  };

  const handleNextQuote = () => {
    setQuoteData(null);
    setImageLoaded(false);
    setRefetchCounter(prev => prev + 1);
  };

  const handleGenerateImage = async () => {
    if (!selectedBubble || !bubbleType || !quoteData) return;
    
    setIsGeneratingImage(true);
    try {
      // Generate an image for the CURRENTLY DISPLAYED quote text
      const { data, error } = await supabase.functions.invoke('generate-quote-image', {
        body: {
          quoteText: quoteData.text,
          author: quoteData.author || 'Unknown',
          // Pass context if available to help styling
          category: bubbleType === 'category' ? selectedBubble : undefined,
          emotionalTrigger: bubbleType === 'trigger' ? selectedBubble : undefined,
          intensity: quoteData.intensity || 'moderate',
        },
      });

      if (error) throw error;

      const imageUrl = data?.imageUrl as string | undefined;
      if (imageUrl) {
        // Preserve current quote text/author; only attach the generated image
        setQuoteData({ ...quoteData, imageUrl });
        setImageLoaded(false);
        toast.success('Image generated!');
      } else {
        toast.error('Failed to generate image');
      }
    } catch (error) {
      console.error('Image generation error:', error);
      toast.error('Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDownload = async () => {
    if (!quoteData?.imageUrl) return;
    
    try {
      const imageUrl = quoteData.imageUrl as string;
      let blob: Blob;

      if (imageUrl.startsWith('data:image')) {
        // Handle base64 data URI
        const base64Data = imageUrl.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: 'image/png' });
      } else {
        // Handle remote URL
        const res = await fetch(imageUrl);
        blob = await res.blob();
      }
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quote-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Quote saved!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to save quote');
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-accent/10 pb-24">
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-heading font-bold text-foreground mb-4">Sign in to continue</h2>
            <Button onClick={() => navigate("/auth")} className="mt-4">
              Sign In
            </Button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-accent/10 pb-24">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Cinematic Header */}
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full mb-4">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <span className="text-sm font-semibold text-foreground">Inspiration Hub</span>
          </div>
          <h1 className="font-heading text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient">
            {activeTab === "quotes" ? "Daily Affirmations" : "Pep Talks"}
          </h1>
          <p className="text-muted-foreground text-lg">
            {activeTab === "quotes" ? "Find your perfect quote" : "A message for your moment"}
          </p>
        </div>

        {/* Cinematic Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "quotes" | "audio")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-card/50 backdrop-blur-xl border border-border/50 shadow-elegant">
            <TabsTrigger 
              value="quotes" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground transition-all duration-300"
            >
              Quotes
            </TabsTrigger>
            <TabsTrigger 
              value="audio"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground transition-all duration-300"
            >
              Pep Talks
            </TabsTrigger>
          </TabsList>

          {/* Quotes Tab */}
          <TabsContent value="quotes" className="space-y-6">
            {!selectedBubble ? (
              <FloatingBubbles onBubbleClick={handleBubbleClick} selectedValue={selectedBubble} />
            ) : (
              <div className="space-y-6">
                {showBack && (
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    className="mb-4 transition-all duration-300 hover:scale-105"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to categories
                  </Button>
                )}

                {isLoading && !quoteData && (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="mt-4 text-muted-foreground">Crafting your perfect quote...</p>
                  </div>
                )}

                {quoteData && (
                  <div className="space-y-6 animate-fade-in">
                    {/* Show AI image if available, otherwise beautiful gradient */}
                    <div className="relative rounded-3xl overflow-hidden shadow-glow border border-border/20">
                      {quoteData.imageUrl ? (
                        <>
                          <img
                            src={quoteData.imageUrl}
                            alt="Quote"
                            className="w-full h-auto"
                            onLoad={() => setImageLoaded(true)}
                          />
                          {!imageLoaded && (
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 animate-pulse" />
                          )}
                        </>
                      ) : (
                        <div className="relative aspect-[9/16] bg-gradient-to-br from-primary via-accent to-primary/50 p-12 flex items-center justify-center">
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
                          <div className="relative z-10 text-center space-y-6">
                            <p className="font-heading text-3xl md:text-4xl text-white leading-relaxed drop-shadow-2xl">
                              "{quoteData.text}"
                            </p>
                            {quoteData.author && (
                              <p className="text-xl text-white/90 italic drop-shadow-lg">
                                — {quoteData.author}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Only show text overlay if AI image was generated */}
                    {quoteData.imageUrl && showQuote && (
                      <div className="text-center space-y-4 p-8 bg-card/50 backdrop-blur-xl rounded-3xl border border-border/50 shadow-elegant">
                        <p className="font-heading text-2xl md:text-3xl text-foreground leading-relaxed">
                          "{quoteData.text}"
                        </p>
                        {showAuthor && quoteData.author && (
                          <p className="text-lg text-muted-foreground">
                            — {quoteData.author}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-3">
                      {!quoteData.imageUrl ? (
                        <Button
                          onClick={handleGenerateImage}
                          disabled={isGeneratingImage}
                          size="lg"
                          className="w-full h-14 bg-gradient-to-r from-royal-purple to-accent-purple hover:from-royal-purple/90 hover:to-accent-purple/90 text-pure-white font-black uppercase tracking-wider shadow-[0_0_30px_rgba(137,81,204,0.5)] hover:shadow-[0_0_50px_rgba(137,81,204,0.8)] transition-all duration-300 hover:scale-105 border-2 border-royal-purple/50"
                        >
                          {isGeneratingImage ? (
                            <>
                              <Sparkles className="mr-2 h-5 w-5 animate-spin" />
                              Generating Magic...
                            </>
                          ) : (
                            <>
                              <Sparkles className="mr-2 h-5 w-5" />
                              Generate Image
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          onClick={handleDownload}
                          variant="outline"
                          size="lg"
                          className="w-full hover:shadow-soft transition-all duration-300"
                        >
                          <Download className="mr-2 h-5 w-5" />
                          Download Image
                        </Button>
                      )}

                      <Button
                        onClick={handleNextQuote}
                        className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-glow transition-all duration-300"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Next Quote
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Audio Tab */}
          <TabsContent value="audio" className="space-y-6">
            <div className="space-y-4">
              <SearchBar
                onSearch={setSearchQuery}
                placeholder="Search pep talks..."
              />
              
              {allCategories.length > 0 && (
                <MultiSelectFilter
                  label="Categories"
                  options={allCategories}
                  selectedValues={selectedCategories}
                  onSelectionChange={setSelectedCategories}
                  mutuallyExclusiveGroups={[["business", "discipline"]]}
                />
              )}
              
              {allTriggers.length > 0 && (
                <MultiSelectFilter
                  label="Emotional Triggers"
                  options={allTriggers}
                  selectedValues={selectedTriggers}
                  onSelectionChange={setSelectedTriggers}
                />
              )}
            </div>

            {pepTalksLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="mt-4 text-muted-foreground">Loading pep talks...</p>
              </div>
            ) : filteredPepTalks.length > 0 ? (
              <div className="space-y-4">
                {filteredPepTalks.map((pepTalk) => (
                  <PepTalkCard
                    key={pepTalk.id}
                    id={pepTalk.id}
                    title={pepTalk.title}
                    category={pepTalk.category}
                    description={pepTalk.description}
                    quote={pepTalk.quote}
                    isPremium={false}
                    onClick={() => navigate(`/pep-talk/${pepTalk.id}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No pep talks found</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
};

export default Inspire;
