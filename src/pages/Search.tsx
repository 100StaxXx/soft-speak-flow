import { BottomNav } from "@/components/BottomNav";
import { GlobalSearch } from "@/components/GlobalSearch";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { ZodiacSymbols } from "@/assets/zodiac-symbols";

const Search = () => {
  return (
    <PageTransition>
      {/* Cosmic Starfield Background */}
      <StarfieldBackground />
      
      {/* Zodiac Constellations */}
      <div className="fixed top-20 left-8 w-32 h-32 text-primary/40 opacity-60 animate-pulse pointer-events-none z-0"
           style={{ 
             filter: 'drop-shadow(0 0 20px hsl(var(--primary)))', 
             animation: 'pulse 4s ease-in-out infinite' 
           }}>
        {ZodiacSymbols.pisces}
      </div>
      <div className="fixed bottom-32 right-8 w-32 h-32 text-accent/40 opacity-60 animate-pulse pointer-events-none z-0"
           style={{ 
             filter: 'drop-shadow(0 0 20px hsl(var(--accent)))', 
             animation: 'pulse 4s ease-in-out infinite 2s' 
           }}>
        {ZodiacSymbols.cancer}
      </div>
      
      <div className="min-h-screen pb-24 relative">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 mb-6">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Search
            </h1>
            <p className="text-sm text-muted-foreground">Find quotes, pep talks, and challenges</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <GlobalSearch />
        </div>
      </div>
      <BottomNav />
    </PageTransition>
  );
};

export default Search;
