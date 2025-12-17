import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  X, ChevronLeft, ChevronRight, BookOpen, 
  MapPin, Star, Trophy, Sparkles, Quote 
} from "lucide-react";
import { useBookChapters } from "@/hooks/useCosmicLibrary";
import { ChapterCard } from "./ChapterCard";
import { cn } from "@/lib/utils";
import type { CompletedBook, NarrativePostcard } from "@/types/narrativeTypes";

interface BookReaderProps {
  epicId: string;
  book: CompletedBook;
  onClose: () => void;
}

export const BookReader = ({ epicId, book, onClose }: BookReaderProps) => {
  const { chapters, isLoading } = useBookChapters(epicId);
  const [currentChapter, setCurrentChapter] = useState(0);

  const sortedChapters = useMemo(() => {
    if (!chapters) return [];
    return [...chapters].sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
  }, [chapters]);

  const chapter = sortedChapters[currentChapter];
  const totalChapters = sortedChapters.length;

  const goToNext = () => {
    if (currentChapter < totalChapters - 1) {
      setCurrentChapter(prev => prev + 1);
    }
  };

  const goToPrev = () => {
    if (currentChapter > 0) {
      setCurrentChapter(prev => prev - 1);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm"
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-bold text-lg">{book.book_title}</h2>
              <p className="text-xs text-muted-foreground">
                {book.companion_name && `Starring ${book.companion_name}`}
                {book.mentor_name && ` • Guided by ${book.mentor_name}`}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto p-6">
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-8 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                <div className="h-64 bg-muted rounded animate-pulse" />
              </div>
            ) : totalChapters === 0 ? (
              <Card className="p-8 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No chapters found for this book.</p>
              </Card>
            ) : chapter ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentChapter}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChapterCard chapter={chapter} chapterNumber={currentChapter + 1} />
                </motion.div>
              </AnimatePresence>
            ) : null}

            {/* Final Wisdom (show on last chapter) */}
            {book.final_wisdom && currentChapter === totalChapters - 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8"
              >
                <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
                  <div className="flex items-start gap-3">
                    <Quote className="w-8 h-8 text-primary flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-primary mb-2">Final Wisdom</h4>
                      <p className="text-sm italic text-foreground/90">{book.final_wisdom}</p>
                      {book.mentor_name && (
                        <p className="text-xs text-muted-foreground mt-2">— {book.mentor_name}</p>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Boss Victory (show on last chapter) */}
            {book.boss_defeated_name && currentChapter === totalChapters - 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-6"
              >
                <Card className="p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/20">
                  <div className="flex items-center gap-3">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    <div>
                      <h4 className="font-semibold text-sm">Boss Defeated</h4>
                      <p className="text-xs text-muted-foreground">{book.boss_defeated_name}</p>
                    </div>
                    <Sparkles className="w-5 h-5 text-yellow-400 ml-auto" />
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {/* Navigation Footer */}
        <div className="p-4 border-t">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <Button
              variant="outline"
              onClick={goToPrev}
              disabled={currentChapter === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>

            <div className="flex items-center gap-2">
              {sortedChapters.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentChapter(index)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    index === currentChapter 
                      ? "bg-primary w-4" 
                      : "bg-muted hover:bg-muted-foreground/50"
                  )}
                />
              ))}
            </div>

            <Button
              variant="outline"
              onClick={goToNext}
              disabled={currentChapter === totalChapters - 1}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
