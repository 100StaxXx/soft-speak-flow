import { memo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Heart, Sparkles, Calendar, Clock, Star, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CompanionMemorial {
  id: string;
  companion_name: string;
  spirit_animal: string;
  core_element: string | null;
  days_together: number;
  death_date: string;
  death_cause: string;
  final_evolution_stage: number;
  final_image_url: string | null;
  memorial_image_url: string | null;
  legacy_traits_passed: Array<{ trait: string; description: string }> | null;
}

interface MemorialWallProps {
  onClose?: () => void;
}

export const MemorialWall = memo(({ onClose }: MemorialWallProps) => {
  const { user } = useAuth();
  const [selectedMemorial, setSelectedMemorial] = useState<CompanionMemorial | null>(null);

  const { data: memorials = [], isLoading } = useQuery({
    queryKey: ['memorial-wall', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('companion_memorials')
        .select('*')
        .eq('user_id', user.id)
        .order('death_date', { ascending: false });

      if (error) {
        console.error('Failed to fetch memorials:', error);
        return [];
      }

      return data as unknown as CompanionMemorial[];
    },
    enabled: !!user?.id,
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-pulse text-muted-foreground">Loading memories...</div>
      </div>
    );
  }

  if (memorials.length === 0) {
    return (
      <div className="text-center p-12 space-y-4">
        <Heart className="h-16 w-16 mx-auto text-muted-foreground/30" />
        <h3 className="text-xl font-heading font-bold text-foreground/60">No Memories Yet</h3>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          Your companions' memories will be preserved here when they pass on.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-heading font-bold flex items-center justify-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            Memorial Wall
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Forever remembered, always in your heart
          </p>
        </div>

        <div className="grid gap-4">
          {memorials.map((memorial, index) => (
            <motion.div
              key={memorial.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className="relative overflow-hidden cursor-pointer hover:border-primary/30 transition-colors group"
                onClick={() => setSelectedMemorial(memorial)}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-muted/20 via-transparent to-muted/20 opacity-50" />
                
                <div className="relative flex items-center gap-4 p-4">
                  {/* Memorial Image */}
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <img
                      src={memorial.memorial_image_url || memorial.final_image_url || '/placeholder.svg'}
                      alt={memorial.companion_name}
                      className="w-full h-full object-cover rounded-full grayscale opacity-70 ring-2 ring-muted/30"
                    />
                    <div className="absolute -bottom-1 -right-1">
                      <Star className="w-4 h-4 text-primary/60 fill-primary/30" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-bold truncate">
                      {memorial.companion_name || `The ${memorial.spirit_animal}`}
                    </h3>
                    <p className="text-xs text-muted-foreground capitalize">
                      {memorial.core_element} {memorial.spirit_animal}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground/70">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {memorial.days_together}d
                      </span>
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Stage {memorial.final_evolution_stage}
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Memorial Detail Dialog */}
      <Dialog open={!!selectedMemorial} onOpenChange={() => setSelectedMemorial(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">In Memory</DialogTitle>
          </DialogHeader>
          
          {selectedMemorial && (
            <div className="space-y-6 text-center">
              {/* Memorial Image */}
              <div className="relative mx-auto w-40 h-40">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/20 to-muted/40 rounded-full" />
                <img
                  src={selectedMemorial.memorial_image_url || selectedMemorial.final_image_url || '/placeholder.svg'}
                  alt={selectedMemorial.companion_name}
                  className="w-full h-full object-cover rounded-full grayscale opacity-80 ring-4 ring-muted/30"
                />
                <motion.div
                  className="absolute -top-2 -right-2"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Heart className="w-8 h-8 text-primary/50 fill-primary/20" />
                </motion.div>
              </div>

              {/* Name */}
              <div>
                <h3 className="text-2xl font-heading font-black bg-gradient-to-r from-primary/70 to-accent/70 bg-clip-text text-transparent">
                  {selectedMemorial.companion_name || `The ${selectedMemorial.spirit_animal}`}
                </h3>
                <p className="text-sm text-muted-foreground capitalize">
                  {selectedMemorial.core_element} {selectedMemorial.spirit_animal}
                </p>
              </div>

              {/* Stats */}
              <div className="flex justify-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(selectedMemorial.death_date)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>{selectedMemorial.days_together} days</span>
                </div>
              </div>

              {/* Evolution */}
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm">Reached Stage {selectedMemorial.final_evolution_stage}</span>
              </div>

              {/* Cause */}
              <p className="text-sm text-muted-foreground/70 italic">
                "{selectedMemorial.death_cause}"
              </p>

              {/* Legacy Traits */}
              {selectedMemorial.legacy_traits_passed && selectedMemorial.legacy_traits_passed.length > 0 && (
                <div className="border-t border-muted/20 pt-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center justify-center gap-1">
                    <Star className="w-4 h-4 text-primary" />
                    Legacy Passed On
                  </h4>
                  <div className="space-y-1">
                    {selectedMemorial.legacy_traits_passed.map((trait, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        <span className="text-primary">{trait.trait}</span>: {trait.description}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedMemorial(null)}
                className="text-muted-foreground"
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
});

MemorialWall.displayName = 'MemorialWall';
