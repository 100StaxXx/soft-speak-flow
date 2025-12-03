import { Heart } from "lucide-react";
import { useState, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ShareButton } from "@/components/ShareButton";

interface Quote {
  id: string;
  text: string;
  author?: string;
  is_premium?: boolean;
}

interface QuoteCardProps {
  quote: Quote;
  isFavorited?: boolean;
  onFavoriteChange?: () => void;
}

export const QuoteCard = memo(({ quote, isFavorited: initialFavorited, onFavoriteChange }: QuoteCardProps) => {
  const { id, text, author, is_premium } = quote;
  const [isFavorited, setIsFavorited] = useState(initialFavorited || false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const toggleFavorite = async () => {
    setLoading(true);
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
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", session.user.id)
          .eq("content_type", "quote")
          .eq("content_id", id);

        if (error) throw error;
        setIsFavorited(false);
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({
            user_id: session.user.id,
            content_type: "quote",
            content_id: id,
          });

        if (error) throw error;
        setIsFavorited(true);
      }

      onFavoriteChange?.();
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update favorite",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative bg-gradient-to-br from-petal-pink/30 to-lavender-mist/20 rounded-3xl p-6 shadow-soft border border-petal-pink/20">
      <button
        onClick={toggleFavorite}
        disabled={loading}
        className="absolute top-4 left-4 hover:scale-110 transition-transform disabled:opacity-50"
      >
        <Heart
          className={`h-5 w-5 ${isFavorited ? "fill-blush-rose text-blush-rose" : "text-warm-charcoal/40"}`}
        />
      </button>
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {is_premium && (
          <span className="bg-gradient-to-r from-gold-accent to-soft-mauve text-white text-xs font-medium px-3 py-1 rounded-full">
            Premium
          </span>
        )}
        <ShareButton
          title="Motivational Quote"
          text={`"${text}"${author ? ` - ${author}` : ''}`}
        />
      </div>
      <div className="mt-8 mb-4">
        <p className="text-warm-charcoal text-base md:text-lg font-medium leading-relaxed italic break-words">
          "{text}"
        </p>
      </div>
      {author && (
        <p className="text-warm-charcoal/60 text-sm break-words">
          — {author}
        </p>
      )}
    </div>
  );
});
