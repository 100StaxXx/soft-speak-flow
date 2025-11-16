import { BottomNav } from "@/components/BottomNav";
import { GlobalSearch } from "@/components/GlobalSearch";
import { PageTransition } from "@/components/PageTransition";

const Search = () => {
  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 mb-6">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Search
            </h1>
            <p className="text-sm text-muted-foreground">Find quotes, pep talks, and challenges</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4">
          <GlobalSearch />
        </div>
      </div>
      <BottomNav />
    </PageTransition>
  );
};

export default Search;
