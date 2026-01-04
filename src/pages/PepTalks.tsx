import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Headphones } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PepTalkCard } from "@/components/PepTalkCard";
import { EMOTIONAL_TRIGGERS, TOPIC_CATEGORIES } from "@/config/categories";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { Mic } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";

export default function PepTalks() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [showPageInfo, setShowPageInfo] = useState(false);

  // Fetch pep talks with filters
  const { data: pepTalks, isLoading } = useQuery({
    queryKey: ["pep-talks", selectedCategory, selectedTrigger],
    queryFn: async () => {
      let query = supabase
        .from("pep_talks")
        .select("*")
        .order("created_at", { ascending: false });

      // Apply category filter
      if (selectedCategory) {
        query = query.contains("topic_category", [selectedCategory]);
      }

      // Apply emotional trigger filter
      if (selectedTrigger) {
        query = query.contains("emotional_triggers", [selectedTrigger]);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedTrigger(null);
  };

  const hasFilters = selectedCategory || selectedTrigger;

  return (
    <PageTransition>
      <StarfieldBackground />
      <div className="min-h-screen pb-nav-safe pt-safe relative z-10">
        <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/mentor")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Mentor
          </Button>
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Headphones className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-heading font-black">Pep Talks</h1>
                <p className="text-muted-foreground">
                  Browse motivational audio content
                </p>
              </div>
            </div>
            <PageInfoButton onClick={() => setShowPageInfo(true)} />
          </div>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-6 bg-gradient-to-br from-primary/5 to-accent/5">
          <div className="space-y-4">
            {/* Emotional Triggers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  How are you feeling?
                </p>
                {hasFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-auto py-1 text-xs"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
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
            </div>

            {/* Topic Categories */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                What do you need?
              </p>
              <div className="flex flex-wrap gap-2">
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
            </div>
          </div>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
              <p className="text-muted-foreground">Loading pep talks...</p>
            </div>
          ) : pepTalks && pepTalks.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {pepTalks.length} pep talk{pepTalks.length !== 1 ? 's' : ''} found
                </p>
              </div>
              {pepTalks.map((pepTalk) => (
                <PepTalkCard
                  key={pepTalk.id}
                  id={pepTalk.id}
                  title={pepTalk.title}
                  category={pepTalk.category}
                  topicCategories={pepTalk.topic_category || []}
                  description={pepTalk.description}
                  quote={pepTalk.quote}
                  isPremium={pepTalk.is_premium || false}
                  emotionalTriggers={pepTalk.emotional_triggers || []}
                />
              ))}
            </>
          ) : (
            <Card className="p-12 text-center">
              <Headphones className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-bold mb-2">No pep talks found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your filters to see more content
              </p>
              {hasFilters && (
                <Button onClick={clearFilters} variant="outline">
                  Clear Filters
                </Button>
              )}
            </Card>
          )}
        </div>
      </div>
      
      <PageInfoModal
        open={showPageInfo}
        onClose={() => setShowPageInfo(false)}
        title="About Pep Talks"
        icon={Mic}
        description="Motivational audio content to inspire and uplift you throughout your day."
        features={[
          "Browse pep talks by emotional state or topic",
          "Listen for XP when you complete 80% of an audio",
          "Filter by what you're feeling or what you need",
          "Get personalized content based on your zodiac",
          "Save favorites to revisit when you need them"
        ]}
        tip="Listen to a pep talk each morning to start your day with the right energy!"
        />
        
        <BottomNav />
      </div>
    </PageTransition>
  );
}
