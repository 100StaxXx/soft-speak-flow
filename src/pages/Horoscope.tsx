import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Star, Moon, Sun, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { HoroscopeInfoTooltip } from "@/components/HoroscopeInfoTooltip";
import { BottomNav } from "@/components/BottomNav";
import { motion } from "framer-motion";
import { useProfile } from "@/hooks/useProfile";
import { CosmiqProfileSection } from "@/components/astrology/CosmicProfileSection";
import { CosmiqProfileReveal } from "@/components/astrology/CosmicProfileReveal";
import { ZodiacSelector } from "@/components/astrology/ZodiacSelector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { HoroscopePageSkeleton } from "@/components/skeletons";
import { safeLocalStorage } from "@/utils/storage";

// Type definitions for horoscope data
interface EnergyForecast {
  planetaryWeather: string;
  mindEnergy: string;
  bodyEnergy: string;
  soulEnergy: string;
}

interface PlacementInsights {
  sun: string;
  moon: string;
  rising: string;
  mercury: string;
  mars: string;
  venus: string;
}

const Horoscope = () => {
  const [horoscope, setHoroscope] = useState<string | null>(null);
  const [cosmiqTip, setCosmiqTip] = useState<string | null>(null);
  const [zodiac, setZodiac] = useState<string | null>(null);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [date, setDate] = useState<string>("");
  const [energyForecast, setEnergyForecast] = useState<EnergyForecast | null>(null);
  const [placementInsights, setPlacementInsights] = useState<PlacementInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [showWelcomeTooltip, setShowWelcomeTooltip] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

  const hasAdvancedDetails = !!(profile?.birthdate && profile?.birth_time && profile?.birth_location);
  const hasCosmiqProfile = !!(profile?.moon_sign && profile?.rising_sign);

  // Check if user has visited Cosmiq Insight before
  useEffect(() => {
    const hasVisited = safeLocalStorage.getItem('cosmiq_insight_visited');
    if (!hasVisited) {
      setShowWelcomeTooltip(true);
      safeLocalStorage.setItem('cosmiq_insight_visited', 'true');
    }
  }, []);

  const generateHoroscope = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-daily-horoscope');

      // Check for zodiac/onboarding error anywhere in the error object
      // This handles the 400 response with "No zodiac sign found"
      const errorString = JSON.stringify(error) + (error?.message || '');
      if (error && (errorString.toLowerCase().includes('zodiac') || errorString.toLowerCase().includes('onboarding'))) {
        console.log('User needs to complete onboarding - no zodiac sign');
        setHoroscope(null);
        setZodiac(null);
        setIsPersonalized(false);
        setDate(new Date().toLocaleDateString('en-CA'));
        setLoading(false);
        return;
      }

      // Handle other errors
      if (error) {
        throw new Error(error.message || 'Failed to load horoscope');
      }

      // Check for error in data body
      if (data?.error) {
        if (data.error.toLowerCase().includes('zodiac') || data.error.toLowerCase().includes('onboarding')) {
          setHoroscope(null);
          setZodiac(null);
          setIsPersonalized(false);
          setDate(new Date().toLocaleDateString('en-CA'));
          setLoading(false);
          return;
        }
        throw new Error(data.error);
      }

      setHoroscope(data.horoscope);
      setZodiac(data.zodiac);
      setIsPersonalized(data.isPersonalized);
      setDate(data.date);
      setCosmiqTip(data.cosmiqTip || null);
      setEnergyForecast(data.energyForecast || null);
      setPlacementInsights(data.placementInsights || null);
      setGeneratedAt(data.generatedAt || null);
    } catch (err) {
      console.error('Error generating horoscope:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      
      // Final safety check for zodiac errors
      if (errMsg.toLowerCase().includes('zodiac') || errMsg.toLowerCase().includes('onboarding')) {
        setHoroscope(null);
        setZodiac(null);
        setIsPersonalized(false);
        setDate(new Date().toLocaleDateString('en-CA'));
        setLoading(false);
        return;
      }
      
      toast({
        title: "Error",
        description: errMsg || "Failed to load your horoscope",
        variant: "destructive",
      });
      setHoroscope("Unable to load your cosmiq insights at this moment. Please try again later.");
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

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    
    // Normalize birth time - extract HH:mm from any format (HH:mm or HH:mm:ss)
    const normalizedBirthTime = birthTime?.trim() ? birthTime.trim().substring(0, 5) : null;
    
    if (normalizedBirthTime) {
      // Validate HH:mm format
      const timeMatch = normalizedBirthTime.match(/^(\d{2}):(\d{2})$/);
      if (!timeMatch) {
        toast({
          title: "Invalid Format",
          description: "Birth time must be in HH:mm format (e.g., 14:30)",
          variant: "destructive",
        });
        return;
      }
      
      // Validate hour/minute ranges (matching server-side validation)
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        toast({
          title: "Invalid Time",
          description: "Please use 24-hour format (00:00 to 23:59)",
          variant: "destructive",
        });
        return;
      }
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
        description: "Your birth details have been updated. Generating your fresh Cosmiq reading...",
      });

      // Invalidate and refetch profile immediately
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      await queryClient.refetchQueries({ queryKey: ["profile", user.id] });
      
      // Wait for profile state to update
      await new Promise(resolve => setTimeout(resolve, 800));

      // Regenerate horoscope with new advanced details
      await generateHoroscope();

      // Auto-trigger cosmic profile calculation for first-time users (only if not generated today)
      if (!hasCosmiqProfile) {
        const alreadyGeneratedToday = profile?.cosmic_profile_generated_at 
          ? new Date(profile.cosmic_profile_generated_at).toDateString() === new Date().toDateString()
          : false;
        
        if (!alreadyGeneratedToday) {
          setTimeout(() => {
            handleRevealCosmiqProfile();
          }, 500);
        }
      }
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

  const handleRevealCosmiqProfile = async () => {
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
        description: "You can only generate one cosmiq profile per day",
          variant: "destructive",
        });
        return;
      }
    }
    
    setRevealing(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-cosmic-profile');

      if (error) {
        // Handle rate limit (429) specifically
        if (error.message?.includes('already generated today') || error.message?.includes('once per 24 hours')) {
          toast({
            title: "Already Generated",
            description: "You can only generate one cosmiq profile per day",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }
      
      if (data && typeof data === 'object' && 'error' in data) {
        const errorMsg = data.error as string;
        // Handle rate limit from response data
        if (errorMsg.includes('already generated today') || errorMsg.includes('once per 24 hours')) {
          toast({
            title: "Already Generated",
            description: "You can only generate one cosmiq profile per day",
            variant: "destructive",
          });
          return;
        }
        throw new Error(errorMsg);
      }

      toast({
        title: "✨ Cosmiq Profile Revealed!",
        description: "Your celestial map has been calculated.",
      });

      // Invalidate profile and regenerate horoscope instead of full page reload
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      await queryClient.refetchQueries({ queryKey: ["profile", user.id] });
      
      // Wait for profile state to update then regenerate horoscope
      setTimeout(async () => {
        await generateHoroscope();
      }, 500);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to calculate cosmiq profile",
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

  // Memoize star positions to prevent recreation on every render
  const starPositions = useMemo(() => {
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      duration: 2 + Math.random() * 3,
      delay: Math.random() * 2,
    }));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-purple-950/20 to-gray-950 relative overflow-hidden pb-24">
      {/* Animated constellation background */}
      <div className="absolute inset-0">
        {/* Stars */}
        {starPositions.map((star) => (
          <motion.div
            key={star.id}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              top: `${star.top}%`,
              left: `${star.left}%`,
            }}
            animate={{
              opacity: [0.1, 1, 0.1],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: star.duration,
              repeat: Infinity,
              delay: star.delay,
            }}
          />
        ))}
        
        {/* Cosmiq nebula */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
      </div>

      <header className="sticky top-0 z-40 w-full border-b border-purple-500/30 bg-gray-950/90 backdrop-blur supports-[backdrop-filter]:bg-gray-950/60 safe-area-top">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
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
              Cosmiq Insight
              <HoroscopeInfoTooltip />
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {date ? formatDate(date) : 'Loading...'}
              {generatedAt && (
                <span className="ml-2 text-xs text-purple-400/70">
                  • Cached
                </span>
              )}
            </p>
          </motion.div>
        </div>
      </header>

      <div className="relative max-w-2xl mx-auto px-6 pt-6 pb-6 space-y-6">
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
                    Your daily cosmiq guidance based on your zodiac sign. Add birth details below to unlock your rising sign and planetary influences for deeper insights.
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

          {/* Missing Zodiac - Let user select sign directly */}
          {!loading && !zodiac && (
            <ZodiacSelector 
              onSelect={async (sign) => {
                if (!user) return;
                try {
                  const { error } = await supabase
                    .from('profiles')
                    .update({ zodiac_sign: sign })
                    .eq('id', user.id);
                  
                  if (error) throw error;
                  
                  // Invalidate profile and regenerate horoscope
                  await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
                  await generateHoroscope();
                  
                  toast({
                    title: "Zodiac Set!",
                    description: `Welcome, ${sign.charAt(0).toUpperCase() + sign.slice(1)}! Loading your reading...`,
                  });
                } catch (err) {
                  console.error('Error setting zodiac:', err);
                  toast({
                    title: "Error",
                    description: "Failed to save zodiac sign",
                    variant: "destructive",
                  });
                }
              }}
            />
          )}

          {/* Main Horoscope Card - Only for users without advanced details */}
          {!hasAdvancedDetails && zodiac && (
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

        {/* Birth Details Form - Show when no advanced details but has zodiac */}
        {!hasAdvancedDetails && zodiac && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-gray-900/80 border-purple-500/30 backdrop-blur-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sun className="w-5 h-5 text-yellow-400" />
                <h3 className="text-lg font-bold text-white">Unlock Your Cosmiq Profile</h3>
              </div>
              <p className="text-sm text-gray-300 mb-6">
                Add your birth details to reveal your rising sign and planetary influences
              </p>
              
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="birthdate" className="text-sm font-medium text-gray-200">
                    Birth Date *
                  </Label>
                  <Input
                    id="birthdate"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="bg-gray-800 border-2 border-purple-500/50 text-white placeholder:text-gray-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/50"
                    max={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthtime" className="text-sm font-medium text-gray-200">
                    Birth Time *
                  </Label>
                  <Input
                    id="birthtime"
                    type="time"
                    value={birthTime}
                    onChange={(e) => setBirthTime(e.target.value)}
                    className="bg-gray-800 border-2 border-purple-500/50 text-white placeholder:text-gray-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/50"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthlocation" className="text-sm font-medium text-gray-200">
                    Birth Location *
                  </Label>
                  <Input
                    id="birthlocation"
                    type="text"
                    value={birthLocation}
                    onChange={(e) => setBirthLocation(e.target.value)}
                    placeholder="e.g., New York, USA"
                    className="bg-gray-800 border-2 border-purple-500/50 text-white placeholder:text-gray-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/50"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                >
                  {saving ? 'Saving...' : 'Save Details'}
                </Button>
              </form>
            </Card>
          </motion.div>
        )}

        {/* Cosmiq Profile Reveal - Show when has advanced details but no profile */}
        {hasAdvancedDetails && !hasCosmiqProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-gray-900/80 border-purple-500/30 backdrop-blur-xl overflow-hidden">
              <CosmiqProfileReveal 
                onReveal={handleRevealCosmiqProfile}
                isRevealing={revealing}
              />
            </Card>
          </motion.div>
        )}

        {/* Cosmiq Profile Display - Show when profile exists */}
        {hasCosmiqProfile && profile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            <CosmiqProfileSection 
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

          </motion.div>
        )}

        {/* Cosmiq Tip */}
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
                  ✨ Cosmiq Tip
                </h3>
                {loading ? (
                  <Skeleton className="h-4 w-full bg-white/20" />
                ) : (
                  <p className="text-sm text-white/90">
                    {cosmiqTip || 'The stars guide those who listen. Trust your inner compass today.'}
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
