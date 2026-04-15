import { useEffect } from "react";
import { ArrowRight, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { WINWINKIT_AFFILIATES_URL } from "@/constants/winwinkit";
import { redirectToWinWinKit } from "@/utils/winwinkit";

export default function Creator() {
  useEffect(() => {
    redirectToWinWinKit();
  }, []);

  return (
    <div className="min-h-screen pb-nav-safe relative overflow-hidden">
      <StarfieldBackground />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-xl p-8 cosmic-glass text-center">
          <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="font-heading text-3xl font-bold mb-3">
            Creator applications moved to WinWinKit
          </h1>
          <p className="text-muted-foreground mb-6">
            Cosmiq now handles creator onboarding, reporting, and affiliate operations through WinWinKit.
            You should be redirected automatically.
          </p>
          <div className="space-y-3">
            <Button
              asChild
              className="w-full"
              size="lg"
            >
              <a href={WINWINKIT_AFFILIATES_URL}>
                Open WinWinKit
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full"
            >
              <a href="/partners">
                Learn about the partner program
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
