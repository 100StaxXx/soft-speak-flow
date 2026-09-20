import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AccessCheckError({ retry }: { retry?: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false);
  return <div className="min-h-screen flex items-center justify-center bg-background p-6">
    <div role="alert" className="max-w-sm space-y-4 text-center">
      <h1 className="text-xl font-semibold">We couldn’t check your access</h1>
      <p className="text-muted-foreground">Check your connection and try again. You don’t need to purchase again to retry.</p>
      <Button disabled={retrying} onClick={async () => {
        setRetrying(true);
        try { await retry?.(); } catch { /* Keep the retry screen available. */ }
        finally { setRetrying(false); }
      }}>{retrying ? "Checking access..." : "Retry access check"}</Button>
    </div>
  </div>;
}
