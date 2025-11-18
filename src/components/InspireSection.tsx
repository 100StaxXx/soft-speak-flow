import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PepTalkCard } from "@/components/PepTalkCard";
import { QuoteCard } from "@/components/QuoteCard";
import { Sparkles, Quote, Headphones } from "lucide-react";
import { EMOTIONAL_TRIGGERS, TOPIC_CATEGORIES } from "@/config/categories";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";

export const InspireSection = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);

  // Fetch pep talks
  const { data: pepTalks = [] } = useQuery({
    queryKey: ["inspire-pep-talks", selectedCategory, selectedTrigger],
    queryFn: async () => {
      let query = supabase
        .from("pep_talks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);

      if (selectedCategory) {
        query = query.contains("topic_category", [selectedCategory]);
      }
      if (selectedTrigger) {
        query = query.contains("emotional_triggers", [selectedTrigger]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch quotes
  const { data: quotes = [] } = useQuery({
    queryKey: ["inspire-quotes", selectedCategory, selectedTrigger],
    queryFn: async () => {
      let query = supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);

      if (selectedCategory) {
        query = query.eq("category", selectedCategory);
      }
      if (selectedTrigger) {
        query = query.contains("emotional_triggers", [selectedTrigger]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading font-black text-xl">Inspire</h3>
            <p className="text-sm text-muted-foreground">
              Browse motivational content by topic or emotion
            </p>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="space-y-3">
          {/* Emotional Triggers */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              How are you feeling?
            </p>
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2">
                <Badge
                  variant={!selectedTrigger ? "default" : "outline"}
                  className="cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setSelectedTrigger(null)}
                >
                  All
                </Badge>
                {EMOTIONAL_TRIGGERS.map((trigger) => (
                  <Badge
                    key={trigger}
                    variant={selectedTrigger === trigger ? "default" : "outline"}
                    className="cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => setSelectedTrigger(trigger)}
                  >
                    {trigger}
                  </Badge>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          {/* Topic Categories */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              What do you need?
            </p>
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2">
                <Badge
                  variant={!selectedCategory ? "default" : "outline"}
                  className="cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setSelectedCategory(null)}
                >
                  All Topics
                </Badge>
                {TOPIC_CATEGORIES.map((cat) => (
                  <Badge
                    key={cat.value}
                    variant={selectedCategory === cat.value ? "default" : "outline"}
                    className="cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => setSelectedCategory(cat.value)}
                  >
                    {cat.label}
                  </Badge>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="pep-talks" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pep-talks" className="gap-2">
              <Headphones className="h-4 w-4" />
              Pep Talks
            </TabsTrigger>
            <TabsTrigger value="quotes" className="gap-2">
              <Quote className="h-4 w-4" />
              Quotes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pep-talks" className="mt-4 space-y-3">
            {pepTalks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No pep talks found for this selection
              </p>
            ) : (
              pepTalks.map((talk) => (
                <PepTalkCard
                  key={talk.id}
                  id={talk.id}
                  title={talk.title}
                  category={talk.category}
                  topicCategories={talk.topic_category || []}
                  description={talk.description}
                  quote={talk.quote}
                  isPremium={talk.is_premium || false}
                  emotionalTriggers={talk.emotional_triggers || []}
                  highlightedTriggers={selectedTrigger ? [selectedTrigger] : []}
                  onClick={() => navigate(`/pep-talk/${talk.id}`)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="quotes" className="mt-4 space-y-3">
            {quotes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No quotes found for this selection
              </p>
            ) : (
              quotes.map((quoteData) => (
                <QuoteCard
                  key={quoteData.id}
                  quote={{
                    id: quoteData.id,
                    text: quoteData.text,
                    author: quoteData.author || "Unknown",
                    is_premium: quoteData.is_premium || false,
                  }}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
};
