import { useEffect } from "react";
import { ArrowRight, BarChart3, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { WINWINKIT_AFFILIATES_URL } from "@/constants/winwinkit";
import { redirectToWinWinKit } from "@/utils/winwinkit";

const InfluencerDashboard = () => {
  useEffect(() => {
    redirectToWinWinKit();
  }, []);

  return (
    <div className="min-h-screen pb-nav-safe relative overflow-hidden">
      <StarfieldBackground />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-xl p-8 cosmic-glass text-center">
          <BarChart3 className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="font-heading text-3xl font-bold mb-3">
            Creator dashboard moved to WinWinKit
          </h1>
          <p className="text-muted-foreground mb-6">
            Creator stats, reporting, and payout operations are no longer hosted inside Cosmiq.
            You should be redirected to the active WinWinKit affiliate dashboard automatically.
          </p>
          <div className="space-y-3">
            <Button asChild className="w-full" size="lg">
              <a href={WINWINKIT_AFFILIATES_URL}>
                Open affiliate dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <a href="/creator">
                Back to creator handoff page
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default InfluencerDashboard;
