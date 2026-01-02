import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, MessageSquare } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { GlobalSearch } from "@/components/GlobalSearch";
import { SearchHero } from "@/components/search/SearchHero";
import { SuggestedSearches } from "@/components/library/SuggestedSearches";
import { FeaturedQuoteCard } from "@/components/library/FeaturedQuoteCard";
import { FeaturedPepTalkCard } from "@/components/library/FeaturedPepTalkCard";
import { SearchTutorialModal } from "@/components/SearchTutorialModal";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";

const Search = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const trimmedQuery = searchQuery.trim();
  const isSearchActive = trimmedQuery.length >= 2;
  const { showModal: showTutorial, dismissModal: dismissTutorial } = useFirstTimeModal('search');

  const { data: featuredQuotes, isLoading: quotesLoading } = useQuery({
    queryKey: ["featured-quotes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("quotes")
        .select("id, text, author")
        .order("created_at", { ascending: false })
        .limit(4);
      return data || [];
    },
  });

  const { data: featuredPepTalks, isLoading: pepTalksLoading } = useQuery({
    queryKey: ["featured-pep-talks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pep_talks")
        .select("id, title, category, description")
        .order("created_at", { ascending: false })
        .limit(3);
      return data || [];
    },
  });

  return (
    <PageTransition>
      <StarfieldBackground />

      <div className="relative min-h-screen pb-nav-safe pt-safe">
        <div className="relative z-10 max-w-6xl mx-auto px-4 py-10 space-y-12">
          <SearchHero
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          <AnimatePresence mode="wait">
            {isSearchActive ? (
              <motion.div
                key="search-results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
              >
                <GlobalSearch searchQuery={trimmedQuery} hideSearchBar />
              </motion.div>
            ) : (
              <motion.div
                key="search-discover"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
                className="space-y-12"
              >
                <SuggestedSearches onSearch={setSearchQuery} />

                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <motion.h2
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-xl font-semibold flex items-center gap-2"
                    >
                      <BookOpen className="h-5 w-5 text-royal-purple" />
                      Featured Quotes
                    </motion.h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate("/library")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      View all
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {quotesLoading ? (
                      <>
                        <Skeleton className="h-32 rounded-2xl" />
                        <Skeleton className="h-32 rounded-2xl" />
                      </>
                    ) : (
                      featuredQuotes?.map((quote, index) => (
                        <FeaturedQuoteCard key={quote.id} quote={quote} index={index} />
                      ))
                    )}
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <motion.h2
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-xl font-semibold flex items-center gap-2"
                    >
                      <MessageSquare className="h-5 w-5 text-nebula-pink" />
                      Featured Pep Talks
                    </motion.h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate("/pep-talks")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      View all
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {pepTalksLoading ? (
                      <>
                        <Skeleton className="h-40 rounded-2xl" />
                        <Skeleton className="h-40 rounded-2xl" />
                        <Skeleton className="h-40 rounded-2xl" />
                      </>
                    ) : (
                      featuredPepTalks?.map((pepTalk, index) => (
                        <FeaturedPepTalkCard key={pepTalk.id} pepTalk={pepTalk} index={index} />
                      ))
                    )}
                  </div>
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <BottomNav />
        
        <SearchTutorialModal open={showTutorial} onClose={dismissTutorial} />
      </div>
    </PageTransition>
  );
};

export default Search;
