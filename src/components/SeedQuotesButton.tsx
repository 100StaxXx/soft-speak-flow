import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Database } from "lucide-react";
import { useState } from "react";

export const SeedQuotesButton = () => {
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedQuotes = async () => {
    setIsSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-real-quotes");

      if (error) throw error;

      if (data?.success) {
        toast.success(`Successfully seeded ${data.quotes?.length || 0} quotes!`);
      } else {
        throw new Error("Unexpected response from seed function");
      }
    } catch (error) {
      console.error("Error seeding quotes:", error);
      toast.error(error.message || "Failed to seed quotes");
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
