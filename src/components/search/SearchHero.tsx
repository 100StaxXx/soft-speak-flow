import { useMemo } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Search, Sparkles } from "lucide-react";

interface SearchHeroProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  stats: {
    quotes: number;
    pepTalks: number;
    challenges: number;
  };
}

export const SearchHero = ({ searchQuery, onSearchChange, stats }: SearchHeroProps) => {
  const floatingOrbs = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => ({
        id: index,
        size: Math.random() * 120 + 80,
        x: Math.random() * 120 - 10,
        y: Math.random() * 80,
        duration: Math.random() * 10 + 15,
        delay: Math.random() * 4,
      })),
    []
  );

  const statBlocks = [
    { label: "Quotes", value: stats.quotes },
    { label: "Pep Talks", value: stats.pepTalks },
    { label: "Challenges", value: stats.challenges },
  ];

  return (
    <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-[hsl(var(--deep-space))] via-[hsl(var(--royal-purple)/0.6)] to-[hsl(var(--nebula-pink)/0.6)] px-6 py-12 md:px-10 md:py-16 shadow-[0_25px_120px_rgba(88,63,172,0.3)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent)]" />

      {floatingOrbs.map((orb) => (
        <motion.div
          key={orb.id}
          className="absolute rounded-full blur-3xl opacity-70 pointer-events-none"
          style={{
            width: orb.size,
            height: orb.size,
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            background:
              orb.id % 2 === 0
                ? "radial-gradient(circle, rgba(255,255,255,0.4), transparent)"
                : "radial-gradient(circle, rgba(131,105,255,0.5), transparent)",
          }}
          animate={{
            x: [0, 25, -20, 0],
            y: [0, -35, 20, 0],
            scale: [1, 1.15, 0.95, 1],
            opacity: [0.25, 0.6, 0.4, 0.25],
          }}
          transition={{
            duration: orb.duration,
            delay: orb.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      <div className="relative z-10 text-center space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-3"
        >
          <motion.div
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.3em] text-stardust-gold"
            animate={{ opacity: [0.8, 1, 0.8] }}
            transition={{ repeat: Infinity, duration: 4 }}
          >
            <Sparkles className="h-4 w-4" />
            Signal Search
            <Sparkles className="h-4 w-4" />
          </motion.div>
          <h1 className="text-3xl md:text-5xl font-bold text-pure-white leading-tight bg-gradient-to-r from-pure-white via-[hsl(var(--celestial-blue))] to-[hsl(var(--nebula-pink))] bg-clip-text text-transparent">
            Find the words that shift your universe
          </h1>
          <p className="text-base md:text-lg text-white/70 max-w-2xl mx-auto">
            Search across curated quotes, immersive pep talks, and guided challenges. Start typing to see results come alive in real time.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative max-w-2xl mx-auto"
        >
          <motion.div
            className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[hsl(var(--celestial-blue)/0.6)] via-[hsl(var(--nebula-pink)/0.7)] to-[hsl(var(--stardust-gold)/0.6)] blur-xl opacity-70"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <div className="relative rounded-2xl bg-background/80 backdrop-blur-2xl border border-white/10 shadow-[0_15px_60px_rgba(0,0,0,0.35)]">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
            <Input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search across everything..."
              className="pl-14 pr-4 py-6 text-base bg-transparent border-none focus-visible:ring-0 focus-visible:outline-none text-pure-white placeholder:text-white/50"
            />
            <div className="absolute inset-px rounded-[1.05rem] border border-white/5 pointer-events-none" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-3 max-w-3xl mx-auto"
        >
          {statBlocks.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/80"
            >
              <p className="text-xs uppercase tracking-widest text-white/60">{stat.label}</p>
              <p className="text-2xl font-bold text-pure-white">{stat.value.toLocaleString()}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
