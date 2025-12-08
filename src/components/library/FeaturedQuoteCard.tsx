import { motion } from "framer-motion";
import { Quote, Heart } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FeaturedQuoteCardProps {
  quote: {
    id: string;
    text: string;
    author?: string | null;
  };
  index: number;
}

export const FeaturedQuoteCard = ({ quote, index }: FeaturedQuoteCardProps) => {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Sign in required",
          description: "Please sign in to save favorites",
          variant: "destructive",
        });
        return;
      }

      if (isFavorited) {
        await supabase.from("favorites").delete()
          .eq("user_id", session.user.id)
          .eq("content_type", "quote")
          .eq("content_id", quote.id);
        setIsFavorited(false);
      } else {
        await supabase.from("favorites").insert({
          user_id: session.user.id,
          content_type: "quote",
          content_id: quote.id,
        });
        setIsFavorited(true);
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ scale: 1.01 }}
      className="group relative"
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[hsl(var(--royal-purple)/0.3)] via-[hsl(var(--nebula-pink)/0.2)] to-[hsl(var(--celestial-blue)/0.3)] p-[1px]">
        <div className="absolute inset-[1px] rounded-2xl bg-card" />
      </div>

      <div className="relative p-5 rounded-2xl">
        <motion.div
          className="absolute -top-2 -left-2 w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(var(--royal-purple))] to-[hsl(var(--nebula-pink))] flex items-center justify-center shadow-glow"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
        >
          <Quote className="h-4 w-4 text-pure-white" />
        </motion.div>

        <p className="text-foreground text-base leading-relaxed italic pl-6 pr-2 mb-3">
          "{quote.text}"
        </p>

        <div className="flex items-center justify-between pl-6">
          <span className="text-sm text-muted-foreground">
            — {quote.author || "Unknown"}
          </span>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleFavorite}
              disabled={isLoading}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <Heart
                className={`h-4 w-4 ${isFavorited ? 'fill-nebula-pink text-nebula-pink' : 'text-muted-foreground'}`}
              />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};