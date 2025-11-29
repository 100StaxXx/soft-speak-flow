import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sparkles, Sun, Moon } from "lucide-react";
import { CosmicProfileSection } from "./astrology/CosmicProfileSection";
import { CosmicProfileReveal } from "./astrology/CosmicProfileReveal";

export const AstrologySettings = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [revealing, setRevealing] = useState(false);

  // Parse existing birth time (HH:mm format)
  const [birthTime, setBirthTime] = useState(profile?.birth_time || "");
  const [birthLocation, setBirthLocation] = useState(profile?.birth_location || "");

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          birth_time: birthTime || null,
          birth_location: birthLocation || null,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Saved!",
        description: "Your astrology details have been updated.",
      });
    } catch (error) {
      console.error('Error saving astrology details:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save astrology details",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const hasAdvancedDetails = !!(profile?.birth_time && profile?.birth_location);
  const hasCosmicProfile = !!(profile?.moon_sign && profile?.rising_sign);

  const handleRevealCosmicProfile = async () => {
    if (!user || !hasAdvancedDetails) return;
    
    setRevealing(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-cosmic-profile');

      if (error) throw error;

      toast({
        title: "✨ Cosmic Profile Revealed!",
        description: "Your celestial map has been calculated from the stars.",
      });

      // Refresh profile to show new data
      window.location.reload();
    } catch (error) {
      console.error('Error calculating cosmic profile:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to calculate cosmic profile",
        variant: "destructive",
      });
    } finally {
      setRevealing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent-purple" />
            Zodiac Sign
          </CardTitle>
          <CardDescription>Your zodiac sign from onboarding</CardDescription>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5 text-accent-purple" />
            Advanced Astrology
          </CardTitle>
          <CardDescription>
            Add birth details for personalized horoscopes with rising sign and planetary transits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {hasAdvancedDetails && (
            <div className="p-3 bg-accent-purple/10 rounded-lg border border-accent-purple/30 mb-4">
              <p className="text-sm text-cloud-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent-purple" />
                You're unlocking personalized cosmic insights!
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="birth-time" className="text-sm">
              Birth Time (optional)
            </Label>
            <Input
              id="birth-time"
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
              className="bg-obsidian/50 border-royal-purple/30"
              placeholder="14:30"
            />
            <p className="text-xs text-steel">
              Your exact birth time for calculating your rising sign
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="birth-location" className="text-sm">
              Birth Location (optional)
            </Label>
            <Input
              id="birth-location"
              type="text"
              value={birthLocation}
              onChange={(e) => setBirthLocation(e.target.value)}
              className="bg-obsidian/50 border-royal-purple/30"
              placeholder="New York, USA"
            />
            <p className="text-xs text-steel">
              City and country where you were born
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-royal-purple hover:bg-accent-purple"
          >
            {saving ? 'Saving...' : 'Save Astrology Details'}
          </Button>

          {!hasAdvancedDetails && (
            <div className="p-4 bg-steel/5 rounded-lg border border-steel/20">
              <p className="text-xs text-steel">
                💫 Adding these details unlocks personalized daily horoscopes in the Mentor tab
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cosmic Profile Section */}
      {hasAdvancedDetails && !hasCosmicProfile && (
        <Card className="border-accent-purple/50 bg-gradient-to-br from-purple-900/20 to-pink-900/20">
          <CardContent className="p-0">
            <CosmicProfileReveal 
              onReveal={handleRevealCosmicProfile}
              isRevealing={revealing}
            />
          </CardContent>
        </Card>
      )}

      {hasCosmicProfile && profile && (
        <CosmicProfileSection 
          profile={{
            zodiac_sign: profile.zodiac_sign || '',
            moon_sign: profile.moon_sign || '',
            rising_sign: profile.rising_sign || '',
            mercury_sign: profile.mercury_sign || '',
            mars_sign: profile.mars_sign || '',
            venus_sign: profile.venus_sign || '',
          }}
        />
      )}
    </div>
  );
};
