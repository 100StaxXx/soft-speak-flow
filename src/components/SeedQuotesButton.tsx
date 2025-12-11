import { Button } from "@/components/ui/button";
import { seedRealQuotes } from "@/lib/firebase/functions";
import { toast } from "sonner";
import { Loader2, Database } from "lucide-react";
import { useState } from "react";

export const SeedQuotesButton = () => {
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedQuotes = async () => {
    setIsSeeding(true);
    try {
      const data = await seedRealQuotes();

      if (data?.success) {
        toast.success(`Successfully seeded ${data.inserted || 0} quotes!`);
      } else {
        throw new Error("Unexpected response from seed function");
      }
    } catch (error) {
      console.error("Error seeding quotes:", error);
      toast.error(error instanceof Error ? error.message : "Failed to seed quotes");
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <Button
      onClick={handleSeedQuotes}
      disabled={isSeeding}
      variant="outline"
      className="gap-2"
    >
      {isSeeding ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Seeding Quotes...
        </>
      ) : (
        <>
          <Database className="h-4 w-4" />
          Seed Real Quotes
        </>
      )}
    </Button>
  );
};
