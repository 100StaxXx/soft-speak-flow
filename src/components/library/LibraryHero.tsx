import { motion } from "framer-motion";
import { Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMemo } from "react";

interface LibraryHeroProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalQuotes: number;
  totalPepTalks: number;
  totalChallenges: number;
}

export const LibraryHero = ({
  searchQuery,
  onSearchChange,
  totalQuotes,
  totalPepTalks,
  totalChallenges,
}: LibraryHeroProps) => {
  const floatingOrbs = useMemo(() => 
    Array.from({ length: 6 }, (_, i) => ({
      id: i,
      size: Math.random() * 100 + 60,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 5,
      duration: Math.random() * 10 + 15,
    })), []
  );

  return (
    <div className="relative overflow-hidden rounded-2xl mb-8">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--royal-purple)/0.3)] via-[hsl(var(--deep-space))] to-[hsl(var(--nebula-pink)/0.2)]" />
      
      {floatingOrbs.map((orb) => (
        <motion.div
          key={orb.id}
          className="absolute rounded-full blur-3xl pointer-events-none"
          style={{
            width: orb.size,
            height: orb.size,
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            background: orb.id % 2 === 0 
              ? 'radial-gradient(circle, hsl(var(--nebula-pink)/0.4), transparent)'
              : 'radial-gradient(circle, hsl(var(--celestial-blue)/0.3), transparent)',
          }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -40, 20, 0],
            scale: [1, 1.2, 0.9, 1],
            opacity: [0.3, 0.6, 0.4, 0.3],
          }}
          transition={{
            duration: orb.duration,
            delay: orb.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      <div className="relative z-10 px-6 py-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-2"
        >
          <motion.div
            className="inline-flex items-center gap-2 mb-3"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Sparkles className="h-5 w-5 text-stardust-gold" />
            <span className="text-stardust-gold text-sm font-medium uppercase tracking-widest">
              Cosmic Library
            </span>
            <Sparkles className="h-5 w-5 text-stardust-gold" />
          </motion.div>
          
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-pure-white via-[hsl(var(--nebula-pink))] to-pure-white bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-text">
            Discover Your Inspiration
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-muted-foreground mb-6 max-w-md mx-auto"
        >
          Explore {totalQuotes.toLocaleString()} quotes, {totalPepTalks.toLocaleString()} pep talks & {totalChallenges.toLocaleString()} challenges
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="relative max-w-md mx-auto"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--royal-purple)/0.5)] via-[hsl(var(--nebula-pink)/0.5)] to-[hsl(var(--celestial-blue)/0.5)] rounded-xl blur-xl opacity-50" />
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search for wisdom..."
              className="pl-12 pr-4 py-6 text-base bg-background/80 backdrop-blur-xl border-white/10 rounded-xl focus:border-primary/50 transition-all"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
};