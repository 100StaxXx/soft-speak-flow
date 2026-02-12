import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Headphones, Brain, Target, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PepTalkCard } from "@/components/PepTalkCard";
import { EMOTIONAL_TRIGGERS, TOPIC_CATEGORIES } from "@/config/categories";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { Mic } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { GlassCard } from "@/components/ui/glass-card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PepTalks() {
  const prefersReducedMotion = useReducedMotion();
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
    staleTime: 5 * 60 * 1000,
  });

  const clearFilters = useCallback(() => {
    setSelectedCategory(null);
    setSelectedTrigger(null);
  }, []);

  const hasFilters = selectedCategory || selectedTrigger;

  return (
    <PageTransition>
      <StarfieldBackground />
      <div className="min-h-screen pb-nav-safe relative z-10">
        {/* Sticky Header */}
        <div className="sticky top-0 z-50 cosmiq-glass-header border-b border-cosmiq-glow/10 safe-area-top">
          <div className="max-w-4xl mx-auto px-4 py-3 pt-safe">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/mentor")}
                  className="rounded-full h-9 w-9 bg-muted/30 hover:bg-muted/50"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-stardust-gold flex items-center justify-center">
                    <Headphones className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <h1 className="text-lg font-semibold tracking-tight">Pep Talks</h1>
                </div>
              </div>
              <PageInfoButton onClick={() => setShowPageInfo(true)} />
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Hero Section */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.24 }}
            className="mb-6"
          >
            <GlassCard variant="hero" glow="accent" className="p-6 relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-stardust-gold/20 to-transparent rounded-full blur-2xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-primary/20 to-transparent rounded-full blur-xl" />
              
              <div className="relative z-10 space-y-4">
                {/* Emotional Triggers */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-stardust-gold" />
                      <p className="text-xs font-medium text-muted-foreground">
                        How are you feeling?
                      </p>
                    </div>
                    {hasFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={!selectedTrigger ? "default" : "outline"}
                      className={`cursor-pointer transition-all duration-200 ${
                        !selectedTrigger 
                          ? "bg-primary text-primary-foreground shadow-[0_8px_18px_hsl(var(--primary)/0.3)]" 
                          : "hover:border-primary/50 hover:bg-primary/8"
                      }`}
                      onClick={() => setSelectedTrigger(null)}
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      All
                    </Badge>
                    {EMOTIONAL_TRIGGERS.map((trigger) => (
                      <Badge
                        key={trigger}
                        variant={selectedTrigger === trigger ? "default" : "outline"}
                        className={`cursor-pointer transition-all duration-200 ${
                          selectedTrigger === trigger
                            ? "bg-primary text-primary-foreground shadow-[0_8px_18px_hsl(var(--primary)/0.3)]"
                            : "hover:border-primary/50 hover:bg-primary/8"
                        }`}
                        onClick={() => setSelectedTrigger(trigger)}
                      >
                        {trigger}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-cosmiq-glow/30 to-transparent" />

                {/* Topic Categories */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-4 w-4 text-primary" />
                      <p className="text-xs font-medium text-muted-foreground">
                        What do you need?
                      </p>
                    </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={!selectedCategory ? "default" : "outline"}
                      className={`cursor-pointer transition-all duration-200 ${
                        !selectedCategory
                          ? "bg-stardust-gold text-background shadow-[0_8px_18px_hsl(var(--stardust-gold)/0.35)]"
                          : "hover:border-stardust-gold/50 hover:bg-stardust-gold/10"
                      }`}
                      onClick={() => setSelectedCategory(null)}
                    >
                      All Topics
                    </Badge>
                    {TOPIC_CATEGORIES.map((cat) => (
                      <Badge
                        key={cat.value}
                        variant={selectedCategory === cat.value ? "default" : "outline"}
                        className={`cursor-pointer transition-all duration-200 ${
                          selectedCategory === cat.value
                            ? "bg-stardust-gold text-background shadow-[0_8px_18px_hsl(var(--stardust-gold)/0.35)]"
                            : "hover:border-stardust-gold/50 hover:bg-stardust-gold/10"
                        }`}
                        onClick={() => setSelectedCategory(cat.value)}
                      >
                        {cat.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Results */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <GlassCard key={i} variant="default" className="p-5">
                    <div className="flex gap-4">
                      <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                      <div className="flex-1 space-y-3">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <div className="flex gap-2">
                          <Skeleton className="h-5 w-16 rounded-full" />
                          <Skeleton className="h-5 w-20 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            ) : pepTalks && pepTalks.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">
                    {pepTalks.length} pep talk{pepTalks.length !== 1 ? 's' : ''} found
                  </p>
                </div>
                {pepTalks.map((pepTalk, index) => (
                  <motion.div
                    key={pepTalk.id}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.2, delay: prefersReducedMotion ? 0 : index * 0.04 }}
                  >
                    <PepTalkCard
                      id={pepTalk.id}
                      title={pepTalk.title}
                      category={pepTalk.category}
                      topicCategories={pepTalk.topic_category || []}
                      description={pepTalk.description}
                      quote={pepTalk.quote}
                      isPremium={pepTalk.is_premium || false}
                      emotionalTriggers={pepTalk.emotional_triggers || []}
                      highlightedTriggers={selectedTrigger ? [selectedTrigger] : undefined}
                    />
                  </motion.div>
                ))}
              </>
            ) : (
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
              >
                <GlassCard variant="elevated" glow="soft" className="p-12 text-center">
                  <div className="h-16 w-16 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-stardust-gold/20 flex items-center justify-center mb-4">
                    <Headphones className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No pep talks found</h3>
                  <p className="text-muted-foreground mb-6">
                    Try adjusting your filters to discover more content
                  </p>
                  {hasFilters && (
                    <Button onClick={clearFilters} variant="outline" className="border-primary/50">
                      <X className="h-4 w-4 mr-2" />
                      Clear Filters
                    </Button>
                  )}
                </GlassCard>
              </motion.div>
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
