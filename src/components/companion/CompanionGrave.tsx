import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Sparkles, Calendar, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface CompanionMemorial {
  id: string;
  companion_name: string;
  spirit_animal: string;
  core_element?: string | null;
  days_together: number;
  death_date: string;
  death_cause: string;
  final_evolution_stage: number;
  final_image_url?: string | null;
  memorial_image_url?: string | null;
}

interface CompanionGraveProps {
  memorial: CompanionMemorial;
  onStartFresh: () => void;
}

export const CompanionGrave = memo(({ memorial, onStartFresh }: CompanionGraveProps) => {
  const formattedDate = new Date(memorial.death_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="w-full max-w-md mx-auto"
    >
      <Card className="relative overflow-hidden bg-card/30 backdrop-blur-2xl border-muted/30">
        {/* Somber background */}
        <div className="absolute inset-0 bg-gradient-to-b from-muted/20 via-background to-muted/30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--muted)/0.3),transparent_70%)]" />
        
        {/* Floating particles (soul ascending) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-primary/40 rounded-full"
              initial={{ 
                x: Math.random() * 100 + '%', 
                y: '100%',
                opacity: 0 
              }}
              animate={{ 
                y: '-20%',
                opacity: [0, 0.6, 0],
              }}
              transition={{
                duration: 4 + Math.random() * 2,
                repeat: Infinity,
                delay: i * 0.8,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>

        <div className="relative p-8 space-y-6 text-center">
          {/* Memorial Image */}
          <div className="relative mx-auto w-48 h-48">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/20 to-muted/40 rounded-full" />
            <img
              src={memorial.memorial_image_url || memorial.final_image_url || '/placeholder.svg'}
              alt={`Memorial for ${memorial.companion_name}`}
              className="w-full h-full object-cover rounded-full grayscale opacity-70 ring-4 ring-muted/30"
            />
            <div className="absolute -top-2 -right-2">
              <Heart className="w-8 h-8 text-primary/50 fill-primary/20" />
            </div>
          </div>

          {/* Name and Title */}
          <div className="space-y-2">
            <h2 className="text-2xl font-heading font-bold text-foreground/80">
              In Memory of
            </h2>
            <p className="text-3xl font-heading font-black bg-gradient-to-r from-primary/70 to-accent/70 bg-clip-text text-transparent">
              {memorial.companion_name || `The ${memorial.spirit_animal}`}
            </p>
            <p className="text-sm text-muted-foreground capitalize">
              {memorial.core_element} {memorial.spirit_animal}
            </p>
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>{memorial.days_together} days together</span>
            </div>
          </div>

          {/* Evolution Stage */}
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm">
              Reached Stage {memorial.final_evolution_stage}
            </span>
          </div>

          {/* Cause */}
          <p className="text-sm text-muted-foreground/70 italic">
            "{memorial.death_cause}"
          </p>

          {/* Message */}
          <div className="py-4 border-t border-muted/20">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your companion waited for you to return, but the bond grew too weak.
              <br />
              <span className="text-foreground/60">
                A new journey can begin when you're ready.
              </span>
            </p>
          </div>

          {/* Start Fresh Button */}
          <Button
            onClick={onStartFresh}
            variant="outline"
            className="w-full border-primary/30 hover:bg-primary/10 hover:border-primary/50"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Start a New Journey
          </Button>
        </div>
      </Card>
    </motion.div>
  );
});

CompanionGrave.displayName = 'CompanionGrave';
