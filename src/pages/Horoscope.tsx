import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Star, Moon, Sun, Settings, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNav } from "@/components/BottomNav";
import { motion } from "framer-motion";
import { useProfile } from "@/hooks/useProfile";
import { CosmicProfileSection } from "@/components/astrology/CosmicProfileSection";
import { CosmicProfileReveal } from "@/components/astrology/CosmicProfileReveal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

const Horoscope = () => {
  const [horoscope, setHoroscope] = useState<string | null>(null);
  const [cosmicTip, setCosmicTip] = useState<string | null>(null);
  const [zodiac, setZodiac] = useState<string | null>(null);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [date, setDate] = useState<string>("");
  const [energyForecast, setEnergyForecast] = useState<any>(null);
  const [placementInsights, setPlacementInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcomeTooltip, setShowWelcomeTooltip] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { user } = useAuth();

  // Birth details state
  const normalizeBirthTime = (time: string | null | undefined) => {
    if (!time) return "";
    return time.substring(0, 5);
  };

  const [birthDate, setBirthDate] = useState(profile?.birthdate || "");
  const [birthTime, setBirthTime] = useState(normalizeBirthTime(profile?.birth_time));
  const [birthLocation, setBirthLocation] = useState(profile?.birth_location || "");
  const [saving, setSaving] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const hasAdvancedDetails = !!(profile?.birth_time && profile?.birth_location);
  const hasCosmicProfile = !!(profile?.moon_sign && profile?.rising_sign);

  // Check if user has visited Cosmiq Insight before
  useEffect(() => {
    const hasVisited = localStorage.getItem('cosmiq_insight_visited');
    if (!hasVisited) {
      setShowWelcomeTooltip(true);
      localStorage.setItem('cosmiq_insight_visited', 'true');
    }
  }, []);

  const generateHoroscope = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-daily-horoscope');

      if (error) throw error;

      setHoroscope(data.horoscope);
      setZodiac(data.zodiac);
      setIsPersonalized(data.isPersonalized);
      setDate(data.date);
      setCosmicTip(data.cosmicTip || null);
      setEnergyForecast(data.energyForecast || null);
      setPlacementInsights(data.placementInsights || null);
    } catch (error) {
      console.error('Error generating horoscope:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load your horoscope",
        variant: "destructive",
      });
      // Set fallback content so UI doesn't break
      setHoroscope("Unable to load your cosmic insights at this moment. Please try again later.");
      setZodiac(profile?.zodiac_sign || "");
      setIsPersonalized(false);
      setDate(new Date().toLocaleDateString('en-CA'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateHoroscope();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Update birth details when profile changes
  useEffect(() => {
    setBirthDate(profile?.birthdate || "");
    setBirthTime(normalizeBirthTime(profile?.birth_time));
    setBirthLocation(profile?.birth_location || "");
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    
    let normalizedBirthTime = birthTime?.trim() || null;
    if (normalizedBirthTime && !/^\d{2}:\d{2}$/.test(normalizedBirthTime)) {
      toast({
        title: "Invalid Format",
        description: "Birth time must be in HH:mm format (e.g., 14:30)",
        variant: "destructive",
      });
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          birthdate: birthDate?.trim() || null,
          birth_time: normalizedBirthTime,
          birth_location: birthLocation?.trim() || null,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Saved!",
        description: "Your birth details have been updated.",
      });
    } catch (error) {
      console.error('Error saving:', error);
      toast({
        title: "Error",
        description: "Failed to save birth details",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRevealCosmicProfile = async () => {
    if (!user || !hasAdvancedDetails) return;
    
    if (!profile?.birthdate) {
      toast({
        title: "Missing Information",
        description: "Please add your birthdate above",
        variant: "destructive",
      });
      return;
    }

    // Check if profile was already generated today
    if (profile.cosmic_profile_generated_at) {
      const generatedDate = new Date(profile.cosmic_profile_generated_at);
      const today = new Date();
      if (generatedDate.toDateString() === today.toDateString()) {
        toast({
          title: "Already Generated",
          description: "You can only generate one cosmic profile per day",
          variant: "destructive",
        });
        return;
      }
    }
    
    setRevealing(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-cosmic-profile');

      if (error) throw error;
      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error(data.error as string);
      }

      toast({
        title: "✨ Cosmic Profile Revealed!",
        description: "Your celestial map has been calculated.",
      });

      setTimeout(() => {
        window.location.href = window.location.pathname;
      }, 1000);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to calculate cosmic profile",
        variant: "destructive",
      });
    } finally {
      setRevealing(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getZodiacIcon = () => {
    if (isPersonalized) return <Star className="w-6 h-6 text-accent-purple" />;
    return <Sparkles className="w-6 h-6 text-royal-purple" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-purple-950/20 to-gray-950 relative overflow-hidden pb-24">
      {/* Animated constellation background */}
      <div className="absolute inset-0">
        {/* Stars */}
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.1, 1, 0.1],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
        
        {/* Cosmic nebula */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
      </div>

      <div className="relative max-w-2xl mx-auto p-6 space-y-6">
        {/* Welcome Tooltip for first-time visitors */}
        {showWelcomeTooltip && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-gradient-to-r from-purple-600/90 via-pink-600/90 to-blue-600/90 backdrop-blur-md p-4 rounded-xl border border-purple-400/50 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <Sparkles className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-white mb-1">Welcome to Cosmiq Insight! ✨</h3>
                  <p className="text-sm text-gray-100">
                    Your daily cosmic guidance based on your zodiac sign. Add birth details below to unlock your rising sign and planetary influences for deeper insights.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWelcomeTooltip(false)}
                className="text-white/80 hover:text-white flex-shrink-0"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/mentor-chat')}
            className="text-gray-400 hover:text-white bg-gray-900/50 backdrop-blur-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <motion.div
            className="flex-1 text-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-3xl font-black text-white flex items-center justify-center gap-2">
              <motion.div
                animate={{
                  rotate: [0, 360],
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <Moon className="w-8 h-8 text-purple-400" />
              </motion.div>
              Cosmic Insight
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {date ? formatDate(date) : 'Loading...'}
            </p>
          </motion.div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/profile')}
            className="text-gray-400 hover:text-white bg-gray-900/50 backdrop-blur-sm"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Constellation Zodiac Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative"
        >
          {/* Glowing zodiac symbol */}
          <div className="flex justify-center mb-8">
            <motion.div
              className="relative"
              animate={{
                rotate: [0, 360],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              {/* Glow rings */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 blur-2xl opacity-50 animate-pulse" />
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 blur-xl opacity-30" style={{ animation: 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
              
              {/* Zodiac circle */}
              <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600 p-1">
                <div className="w-full h-full rounded-full bg-gray-950 flex items-center justify-center">
                  <motion.div
                    animate={{
                      scale: [1, 1.1, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                    }}
                  >
                    <Star className="w-16 h-16 text-purple-300" />
                  </motion.div>
                </div>
              </div>

              {/* Orbiting particles */}
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-purple-400 rounded-full"
                  style={{
                    top: '50%',
                    left: '50%',
                  }}
                  animate={{
                    rotate: [0, 360],
                    x: [0, Math.cos((i / 8) * Math.PI * 2) * 80],
                    y: [0, Math.sin((i / 8) * Math.PI * 2) * 80],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "linear",
                    delay: i * 0.5,
                  }}
                />
              ))}
            </motion.div>
          </div>

          {/* Main Horoscope Card - Only for users without advanced details */}
          {!hasAdvancedDetails && (
          <Card className="bg-gray-900/80 border-purple-500/30 backdrop-blur-xl p-8 shadow-2xl">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-32 bg-gray-700/50" />
                <Skeleton className="h-4 w-full bg-gray-700/50" />
                <Skeleton className="h-4 w-full bg-gray-700/50" />
                <Skeleton className="h-4 w-3/4 bg-gray-700/50" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Zodiac Badge */}
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="flex items-center gap-3"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-purple-500/30 blur-xl rounded-full" />
                    {getZodiacIcon()}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white capitalize">
                      {zodiac}
                    </h2>
                    <p className="text-xs text-gray-400">
                      {isPersonalized ? '✨ Personalized Reading' : '🌙 Daily Overview'}
                    </p>
                  </div>
                </motion.div>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

                {/* Horoscope Content */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="prose prose-invert max-w-none"
                >
                  <p className="text-gray-200 leading-relaxed whitespace-pre-wrap text-lg">
                    {horoscope}
                  </p>
                </motion.div>

              </div>
            )}
          </Card>
          )}
        </motion.div>

        {/* Birth Details Form - Show when no advanced details */}
        {!hasAdvancedDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-gray-900/80 border-purple-500/30 backdrop-blur-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sun className="w-5 h-5 text-yellow-400" />
                <h3 className="text-lg font-bold text-white">Unlock Your Cosmic Profile</h3>
              </div>
              <p className="text-sm text-gray-300 mb-6">
                Add your birth details to reveal your rising sign and planetary influences
              </p>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="birthdate" className="text-sm text-gray-300">
                    Birth Date
                  </Label>
                  <Input
                    id="birthdate"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="bg-gray-950/50 border-purple-500/30 text-white"
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthtime" className="text-sm text-gray-300">
                    Birth Time
                  </Label>
                  <Input
                    id="birthtime"
                    type="time"
                    value={birthTime}
                    onChange={(e) => setBirthTime(e.target.value)}
                    className="bg-gray-950/50 border-purple-500/30 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthlocation" className="text-sm text-gray-300">
                    Birth Location
                  </Label>
                  <Input
                    id="birthlocation"
                    type="text"
                    value={birthLocation}
                    onChange={(e) => setBirthLocation(e.target.value)}
                    placeholder="New York, USA"
                    className="bg-gray-950/50 border-purple-500/30 text-white"
                  />
                </div>

                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                >
                  {saving ? 'Saving...' : 'Save Details'}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Cosmic Profile Reveal - Show when has advanced details but no profile */}
        {hasAdvancedDetails && !hasCosmicProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-gray-900/80 border-purple-500/30 backdrop-blur-xl overflow-hidden">
              <CosmicProfileReveal 
                onReveal={handleRevealCosmicProfile}
                isRevealing={revealing}
              />
            </Card>
          </motion.div>
        )}

        {/* Cosmic Profile Display - Show when profile exists */}
        {hasCosmicProfile && profile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
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
          </motion.div>
        )}

        {/* Planetary Weather (only for advanced profiles) */}
        {energyForecast && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="space-y-3"
          >
            {/* Today's Planetary Weather */}
            <Card className="bg-gray-900/80 border-purple-500/30 backdrop-blur-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Moon className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-bold text-white">Today's Planetary Weather</h3>
              </div>
              <p className="text-gray-200 text-sm leading-relaxed">
                {energyForecast.planetaryWeather}
              </p>
            </Card>

            {/* Your Energy Forecast */}
            <Card className="bg-gray-900/80 border-purple-500/30 backdrop-blur-xl p-5">
              <h3 className="text-lg font-bold text-white mb-4">Your Energy Forecast</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-cyan-300 font-bold text-xs">M</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 uppercase mb-1 font-semibold">Mind</p>
                    <p className="text-sm text-gray-200 leading-relaxed">{energyForecast.mindEnergy}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-red-300 font-bold text-xs">B</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 uppercase mb-1 font-semibold">Body</p>
                    <p className="text-sm text-gray-200 leading-relaxed">{energyForecast.bodyEnergy}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-pink-300 font-bold text-xs">S</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 uppercase mb-1 font-semibold">Soul</p>
                    <p className="text-sm text-gray-200 leading-relaxed">{energyForecast.soulEnergy}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Learn More about Your Cosmic Profile */}
            <Card className="bg-gradient-to-br from-purple-900/30 via-pink-900/30 to-blue-900/30 border border-purple-500/30 backdrop-blur-sm p-5">
              <div className="flex items-start gap-3">
                <Star className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-200 mb-3 font-medium">
                    Want to understand what all this means for you?
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/cosmic-academy')}
                    className="border-purple-500/50 text-purple-300 hover:bg-purple-900/30 hover:text-white transition-all"
                  >
                    Explore Cosmic Academy →
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Cosmic Tip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 border-none p-6 shadow-glow-lg">
            <div className="flex items-start gap-3">
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 180, 360],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                }}
              >
                <Sparkles className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
              </motion.div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white mb-1">
                  ✨ Cosmic Tip
                </h3>
                {loading ? (
                  <Skeleton className="h-4 w-full bg-white/20" />
                ) : (
                  <p className="text-sm text-white/90">
                    {cosmicTip || 'The stars guide those who listen. Trust your inner compass today.'}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Horoscope;
