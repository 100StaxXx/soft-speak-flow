import { ArrowRight, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StarfieldBackground } from "@/components/StarfieldBackground";

export default function Creator() {
  return (
    <div className="min-h-screen pb-nav-safe relative overflow-hidden">
      <StarfieldBackground />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-xl p-8 cosmic-glass text-center">
          <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="font-heading text-3xl font-bold mb-3">
            Creator partnerships live in Cosmiq
          </h1>
          <p className="text-muted-foreground mb-6">
            Creator codes, Apple offer eligibility, and partner reporting are handled by Cosmiq.
          </p>
          <div className="space-y-3">
            <Button
              asChild
              className="w-full"
              size="lg"
            >
              <a href="/partners">
                View Partner Program
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full"
            >
              <a href="/profile">
                Open Your Rewards
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
