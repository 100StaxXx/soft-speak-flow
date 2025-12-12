import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { Sparkles, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { getStageName } from "@/config/companionStages";
import { getDocument, getDocuments, timestampToISO } from "@/lib/firebase/firestore";

interface CompanionEvolutionHistoryProps {
  companionId: string;
}

export const CompanionEvolutionHistory = ({ companionId }: CompanionEvolutionHistoryProps) => {
  const { data: evolutions, isLoading } = useQuery({
    queryKey: ["companion-evolutions", companionId],
    queryFn: async () => {
      // Get companion creation info for Stage 0
      const companion = await getDocument<{ created_at: any; initial_image_url?: string }>(
        "user_companion",
        companionId
      );

      if (!companion) return [];

      // Get evolution history
      const evolutionData = await getDocuments<{
        id: string;
        companion_id: string;
        stage: number;
        image_url?: string;
        evolved_at: any;
        xp_at_evolution: number;
      }>("companion_evolutions", [["companion_id", "==", companionId]], "evolved_at", "desc");

      const normalizedEvolutions = evolutionData.map((evo) => ({
        ...evo,
        evolved_at: timestampToISO(evo.evolved_at as any) || evo.evolved_at,
      }));

      // Check if Stage 0 already exists in evolution data
      const hasStage0 = normalizedEvolutions?.some(evo => evo.stage === 0);

      // Only create Stage 0 entry if it doesn't exist in the database
      if (!hasStage0) {
        const stage0Entry = {
          id: `${companionId}-stage-0`,
          companion_id: companionId,
          stage: 0,
          image_url: companion.initial_image_url,
          evolved_at: timestampToISO(companion.created_at as any) || companion.created_at,
          xp_at_evolution: 0,
        };

        // Combine Stage 0 with evolutions
        return [stage0Entry, ...(normalizedEvolutions || [])];
      }

      // Stage 0 already exists in database, just return the data
      return normalizedEvolutions || [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Evolution History
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!evolutions || evolutions.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Sparkles className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">No evolutions yet. Keep earning XP!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        Evolution History
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {evolutions.map((evolution, index) => (
          <motion.div
            key={evolution.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="overflow-hidden group hover:shadow-glow transition-all duration-300 hover:scale-105">
              <div className="aspect-square relative bg-gradient-to-br from-primary/10 via-accent/5 to-background overflow-hidden">
                {evolution.image_url && (
                  <img
                    src={evolution.image_url}
                    alt={`${getStageName(evolution.stage)}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-bold">
                  {getStageName(evolution.stage)}
                </div>
              </div>
              
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(evolution.evolved_at), "MMM d, yyyy")}
                </div>
                <div className="text-xs font-medium">
                  {evolution.xp_at_evolution.toLocaleString()} XP
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
