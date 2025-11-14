import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PepTalkCard } from "@/components/PepTalkCard";
import { BottomNav } from "@/components/BottomNav";
import { Library as LibraryIcon } from "lucide-react";
import { toast } from "sonner";

interface PepTalk {
  id: string;
  title: string;
  category: string;
  quote: string;
  description: string;
  audio_url: string;
  is_featured: boolean;
  created_at: string;
}

const Library = () => {
  const [pepTalks, setPepTalks] = useState<PepTalk[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPepTalks();
  }, []);

  const fetchPepTalks = async () => {
    try {
      const { data, error } = await supabase
        .from("pep_talks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPepTalks(data || []);
    } catch (error) {
      console.error("Error fetching pep talks:", error);
      toast.error("Failed to load pep talks");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <LibraryIcon className="h-12 w-12 text-blush-rose mx-auto mb-4" />
          <p className="text-muted-foreground">Loading library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-cream-glow to-petal-pink/30">
      <div className="max-w-lg mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-4xl font-bold text-foreground mb-2">
            Pep Talk Library
          </h1>
          <p className="text-muted-foreground">
            {pepTalks.length} {pepTalks.length === 1 ? 'pep talk' : 'pep talks'} to lift you up
          </p>
        </div>

        {/* Pep Talks List */}
        {pepTalks.length > 0 ? (
          <div className="space-y-4">
            {pepTalks.map((pepTalk) => (
              <PepTalkCard
                key={pepTalk.id}
                id={pepTalk.id}
                title={pepTalk.title}
                category={pepTalk.category}
                description={pepTalk.description}
                onClick={() => navigate(`/pep-talk/${pepTalk.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="bg-card rounded-3xl p-8 shadow-soft">
              <LibraryIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-heading text-2xl font-semibold text-foreground mb-2">
                No Pep Talks Yet
              </h3>
              <p className="text-muted-foreground">
                Check back soon for motivational content!
              </p>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Library;
