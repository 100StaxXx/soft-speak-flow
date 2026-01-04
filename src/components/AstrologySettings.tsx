import { memo } from "react";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Sun } from "lucide-react";

export const AstrologySettings = memo(() => {
  const { profile } = useProfile();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent-purple" />
          Zodiac Sign
        </CardTitle>
        <CardDescription>
          Your zodiac sign from onboarding
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 p-4 bg-royal-purple/10 rounded-lg border border-royal-purple/30">
          <Sun className="w-6 h-6 text-accent-purple" />
          <div>
            <p className="font-semibold text-pure-white capitalize">
              {profile?.zodiac_sign || 'Not set'}
            </p>
            <p className="text-xs text-steel">
              Your sun sign
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
AstrologySettings.displayName = 'AstrologySettings';
