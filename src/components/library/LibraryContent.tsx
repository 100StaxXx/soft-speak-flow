import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getDocuments } from "@/lib/firebase/firestore";
import { getQuotes } from "@/lib/firebase/quotes";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, MessageSquare, ArrowRight } from "lucide-react";
import { LibraryHero } from "./LibraryHero";
import { FeaturedQuoteCard } from "./FeaturedQuoteCard";
import { FeaturedPepTalkCard } from "./FeaturedPepTalkCard";
import { SuggestedSearches } from "./SuggestedSearches";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const LibraryContent = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const { data: quotesCount = 0 } = useQuery({
    queryKey: ["quotes-count"],
    queryFn: async () => {
      // Get all quotes to count (Firestore doesn't have count queries)
      // Limit to reasonable number for performance
      const quotes = await getDocuments("quotes", undefined, undefined, undefined, 1000);
      return quotes.length;
    },
  });

  const { data: pepTalksCount = 0 } = useQuery({
    queryKey: ["pep-talks-count"],
    queryFn: async () => {
      const pepTalks = await getDocuments("pep_talks", undefined, undefined, undefined, 1000);
      return pepTalks.length;
    },
  });

  const { data: challengesCount = 0 } = useQuery({
    queryKey: ["challenges-count"],
    queryFn: async () => {
      const challenges = await getDocuments("challenges", undefined, undefined, undefined, 1000);
      return challenges.length;
    },
  });

  const { data: featuredQuotes, isLoading: quotesLoading } = useQuery({
    queryKey: ["featured-quotes"],
    queryFn: async () => {
      const quotes = await getDocuments<{ id: string; text?: string; author?: string; created_at?: any }>(
        "quotes",
        undefined,
        "created_at",
        "desc",
        4
      );
      return quotes.map(q => ({
        id: q.id,
        text: q.text || "",
        author: q.author || ""
      }));
    },
  });

  const { data: featuredPepTalks, isLoading: pepTalksLoading } = useQuery({
    queryKey: ["featured-pep-talks"],
    queryFn: async () => {
      const pepTalks = await getDocuments<{ id: string; title?: string; category?: string; description?: string }>("pep_talks", undefined, "created_at", "desc", 3);
      return pepTalks;
    },
  });

  const isSearchActive = searchQuery.length >= 2;

  return (
    <div className="space-y-6">
      <LibraryHero
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalQuotes={quotesCount}
        totalPepTalks={pepTalksCount}
        totalChallenges={challengesCount}
      />

      <AnimatePresence mode="wait">
        {isSearchActive ? (
          <motion.div
            key="search-results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <GlobalSearch initialQuery={searchQuery} />
          </motion.div>
        ) : (
          <motion.div
            key="discover-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SuggestedSearches onSearch={setSearchQuery} />

            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <motion.h2
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-xl font-bold flex items-center gap-2"
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
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <motion.h2
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-xl font-bold flex items-center gap-2"
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
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pepTalksLoading ? (
                  <>
                    <Skeleton className="h-40 rounded-2xl" />
                    <Skeleton className="h-40 rounded-2xl" />
                    <Skeleton className="h-40 rounded-2xl" />
                  </>
                ) : (
                  featuredPepTalks?.map((pepTalk, index) => (
                    <FeaturedPepTalkCard 
                      key={pepTalk.id} 
                      pepTalk={{
                        id: pepTalk.id,
                        title: pepTalk.title || 'Untitled',
                        category: pepTalk.category || 'General',
                        description: pepTalk.description,
                      }} 
                      index={index} 
                    />
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};