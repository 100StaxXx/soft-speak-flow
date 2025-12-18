import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Library, Star, Trophy, ChevronRight } from "lucide-react";
import { useCosmicLibrary, useNarrativeEpic, useBookChapters } from "@/hooks/useCosmicLibrary";
import { BookCover } from "./BookCover";
import { BookReader } from "./BookReader";
import { cn } from "@/lib/utils";
import type { CompletedBook, NarrativeEpic } from "@/types/narrativeTypes";

interface CosmicLibraryProps {
  userId?: string;
}

export const CosmicLibrary = ({ userId }: CosmicLibraryProps) => {
  const { books: completedBooks, isLoading } = useCosmicLibrary();
  const [selectedBook, setSelectedBook] = useState<CompletedBook | null>(null);
  const [readingEpicId, setReadingEpicId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <div className="animate-pulse space-y-4">
          <Library className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <div className="h-4 bg-muted rounded w-32 mx-auto" />
        </div>
      </Card>
    );
  }

  if (!completedBooks || completedBooks.length === 0) {
    return (
      <Card className="p-8 text-center space-y-4">
        <Library className="w-16 h-16 mx-auto text-muted-foreground/50" />
        <div>
          <h3 className="text-lg font-semibold mb-2">Your Cosmiq Library Awaits</h3>
          <p className="text-sm text-muted-foreground">
            Complete Star Path epics to add books to your collection.
            Each completed journey becomes a treasured volume.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Library className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Cosmiq Library</h3>
          <Badge variant="secondary" className="text-xs">
            {completedBooks.length} {completedBooks.length === 1 ? "Book" : "Books"}
          </Badge>
        </div>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {completedBooks.map((book, index) => (
            <motion.div
              key={book.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="flex-shrink-0"
            >
              <BookCover
                book={book}
                onClick={() => {
                  setSelectedBook(book);
                  setReadingEpicId(book.epic_id);
                }}
              />
            </motion.div>
          ))}
        </div>
      </ScrollArea>

      {/* Book Reader Modal */}
      <AnimatePresence>
        {readingEpicId && selectedBook && (
          <BookReader
            epicId={readingEpicId}
            book={selectedBook}
            onClose={() => {
              setReadingEpicId(null);
              setSelectedBook(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
