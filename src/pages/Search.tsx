import { BottomNav } from "@/components/BottomNav";
import { GlobalSearch } from "@/components/GlobalSearch";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";

const Search = () => {
  return (
    <PageTransition>
      {/* Cosmiq Starfield Background */}
      <StarfieldBackground />
      
      <div className="min-h-screen pb-24 relative">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 mb-6">
          <div className="max-w-4xl mx-auto px-4 py-4 safe-area-top">
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
