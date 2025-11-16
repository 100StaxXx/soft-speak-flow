import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { SearchBar } from "@/components/SearchBar";
import { PageTransition, SlideUp } from "@/components/PageTransition";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { QuoteCard } from "@/components/QuoteCard";
import { PepTalkCard } from "@/components/PepTalkCard";
import { Button } from "@/components/ui/button";
import { Search as SearchIcon, Sparkles, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Search() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "quotes" | "pep-talks" | "challenges">("all");
  const navigate = useNavigate();

  // Search quotes
  const { data: quotes = [] } = useQuery({
    queryKey: ["search-quotes", query],
    enabled: query.length > 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .or(`text.ilike.%${query}%,author.ilike.%${query}%,category.ilike.%${query}%`)
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Search pep talks
  const { data: pepTalks = [] } = useQuery({
    queryKey: ["search-pep-talks", query],
    enabled: query.length > 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pep_talks")
        .select("*")
        .or(`title.ilike.%${query}%,description.ilike.%${query}%,quote.ilike.%${query}%,category.ilike.%${query}%`)
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Search challenges
  const { data: challenges = [] } = useQuery({
    queryKey: ["search-challenges", query],
    enabled: query.length > 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .or(`title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const totalResults = quotes.length + pepTalks.length + challenges.length;

  const popularSearches = [
    { term: "motivation", icon: Sparkles },
    { term: "confidence", icon: TrendingUp },
    { term: "mindfulness", icon: Sparkles },
    { term: "resilience", icon: TrendingUp },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-20">
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Search
            </h1>
            <SearchBar
              onSearch={setQuery}
              placeholder="Search quotes, pep talks, challenges..."
              className="w-full"
            />
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {query.length === 0 ? (
            <SlideUp delay={0.1}>
              <Card className="p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <SearchIcon className="h-5 w-5" />
                  Popular Searches
                </h2>
                <div className="flex flex-wrap gap-2">
                  {popularSearches.map(({ term, icon: Icon }) => (
                    <Button
                      key={term}
                      variant="outline"
                      size="sm"
                      onClick={() => setQuery(term)}
                      className="gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      {term}
                    </Button>
                  ))}
                </div>
              </Card>
            </SlideUp>
          ) : query.length < 3 ? (
            <SlideUp delay={0.1}>
              <Card className="p-12 text-center">
                <SearchIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">Type at least 3 characters to search</p>
              </Card>
            </SlideUp>
          ) : totalResults === 0 ? (
            <SlideUp delay={0.1}>
              <Card className="p-12 text-center">
                <SearchIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-xl font-semibold mb-2">No results found</h3>
                <p className="text-muted-foreground">Try a different search term</p>
              </Card>
            </SlideUp>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Found {totalResults} result{totalResults !== 1 ? 's' : ''}
                </p>
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all">All ({totalResults})</TabsTrigger>
                  <TabsTrigger value="quotes">Quotes ({quotes.length})</TabsTrigger>
                  <TabsTrigger value="pep-talks">Pep Talks ({pepTalks.length})</TabsTrigger>
                  <TabsTrigger value="challenges">Challenges ({challenges.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="space-y-4 mt-6">
                  {quotes.slice(0, 3).map((quote, index) => (
                    <SlideUp key={`quote-${quote.id}`} delay={0.1 * (index + 1)}>
                      <QuoteCard quote={quote} />
                    </SlideUp>
                  ))}
                  {pepTalks.slice(0, 3).map((talk, index) => (
                    <SlideUp key={`talk-${talk.id}`} delay={0.1 * (index + quotes.slice(0, 3).length + 1)}>
                      <PepTalkCard 
                        id={talk.id}
                        title={talk.title}
                        category={talk.category}
                        description={talk.description}
                        quote={talk.quote}
                        isPremium={talk.is_premium}
                      />
                    </SlideUp>
                  ))}
                  {challenges.slice(0, 3).map((challenge, index) => (
                    <SlideUp key={`challenge-${challenge.id}`} delay={0.1 * (index + quotes.slice(0, 3).length + pepTalks.slice(0, 3).length + 1)}>
                      <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/challenges')}>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold">{challenge.title}</h3>
                          <Badge>{challenge.duration_days} days</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{challenge.description}</p>
                      </Card>
                    </SlideUp>
                  ))}
                </TabsContent>

                <TabsContent value="quotes" className="space-y-4 mt-6">
                  {quotes.map((quote, index) => (
                    <SlideUp key={quote.id} delay={0.1 * (index + 1)}>
                      <QuoteCard quote={quote} />
                    </SlideUp>
                  ))}
                </TabsContent>

                <TabsContent value="pep-talks" className="space-y-4 mt-6">
                  {pepTalks.map((talk, index) => (
                    <SlideUp key={talk.id} delay={0.1 * (index + 1)}>
                      <PepTalkCard 
                        id={talk.id}
                        title={talk.title}
                        category={talk.category}
                        description={talk.description}
                        quote={talk.quote}
                        isPremium={talk.is_premium}
                      />
                    </SlideUp>
                  ))}
                </TabsContent>

                <TabsContent value="challenges" className="space-y-4 mt-6">
                  {challenges.map((challenge, index) => (
                    <SlideUp key={challenge.id} delay={0.1 * (index + 1)}>
                      <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/challenges')}>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold">{challenge.title}</h3>
                          <Badge>{challenge.duration_days} days</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{challenge.description}</p>
                        {challenge.category && (
                          <Badge variant="outline" className="mt-2">{challenge.category}</Badge>
                        )}
                      </Card>
                    </SlideUp>
                  ))}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>

        <BottomNav />
      </div>
    </PageTransition>
  );
}
