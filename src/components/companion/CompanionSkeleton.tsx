import { Sparkles } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";

export const CompanionSkeleton = () => {
  return (
    <div className="min-h-screen pb-20 relative">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-top">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="font-heading font-black text-xl">Companion</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
          </div>
        </div>
      </header>

      <div className="container py-6 space-y-4">
        <Tabs defaultValue="overview">
          <TabsList className="grid w-full grid-cols-5">
            {["overview", "badges", "story", "cards", "postcards"].map((value) => (
              <TabsTrigger key={value} value={value} className="text-xs px-2" disabled>
                <div className="h-4 w-12 bg-muted rounded animate-pulse" />
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="space-y-4">
          {[1, 2, 3].map((section) => (
            <div
              key={section}
              className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-6 shadow-sm animate-pulse"
            >
              <div className="h-6 w-32 bg-muted rounded mb-4" />
              <div className="h-32 w-full bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
