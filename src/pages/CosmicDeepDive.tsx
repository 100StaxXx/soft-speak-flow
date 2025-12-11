import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sun, Moon, ArrowUp, Brain, Zap, Heart, Sparkles, AlertCircle } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { getDocuments } from "@/lib/firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { PlacementAnimation } from "@/components/astrology/PlacementAnimation";

const placementIcons = {
  sun: Sun,
  moon: Moon,
  rising: ArrowUp,
  mercury: Brain,
  mars: Zap,
  venus: Heart,
};

const placementColors = {
  sun: "from-amber-500/20 to-orange-500/20",
  moon: "from-blue-500/20 to-purple-500/20",
  rising: "from-purple-500/20 to-rose-500/20",
  mercury: "from-cyan-500/20 to-teal-500/20",
  mars: "from-red-500/20 to-orange-500/20",
  venus: "from-pink-500/20 to-rose-500/20",
};

interface CosmiqContent {
  title: string;
  tagline: string;
  // Sun unique sections
  core_identity?: string;
  life_purpose?: string;
  natural_strengths?: string[];
  growth_areas?: string[];
  // Moon unique sections
  emotional_landscape?: string;
  comfort_needs?: string;
  intuitive_gifts?: string;
  emotional_triggers?: string[];
  // Rising unique sections
  your_aura?: string;
  first_impressions?: string;
  social_superpowers?: string;
  presentation_tips?: string[];
  // Mercury/Mars/Venus single insights
  mental_insight?: string;
  action_insight?: string;
  love_insight?: string;
  // Legacy fields
  identity_insight?: string;
  emotional_insight?: string;
  social_insight?: string;
  overview?: string;
}

const insightLabels: Record<string, { title: string; icon: string }> = {
  mercury: { title: "How You Think", icon: "💭" },
  mars: { title: "What Drives You", icon: "🔥" },
  venus: { title: "How You Love", icon: "💗" },
};

const VALID_PLACEMENTS = ['sun', 'moon', 'rising', 'mercury', 'mars', 'venus'];
const VALID_SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

const CosmiqDeepDive = () => {
  const { placement, sign } = useParams<{ placement: string; sign: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [content, setContent] = useState<CosmiqContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate route parameters and fetch content
  useEffect(() => {
    // Validate first
    if (!placement || !sign) {
      setError("Missing placement or sign parameter");
      setLoading(false);
      setContent(null);
      return;
    }

    const normalizedPlacement = placement.toLowerCase();
    const normalizedSign = sign.toLowerCase();

    if (!VALID_PLACEMENTS.includes(normalizedPlacement)) {
      setError(`Invalid placement: ${placement}. Valid placements are: ${VALID_PLACEMENTS.join(', ')}`);
      setLoading(false);
      setContent(null);
      return;
    }

    if (!VALID_SIGNS.includes(normalizedSign)) {
      setError(`Invalid sign: ${sign}. Valid signs are: ${VALID_SIGNS.join(', ')}`);
      setLoading(false);
      setContent(null);
      return;
    }

    // Validation passed, clear any previous errors and fetch content
    setError(null);
    
    const fetchContent = async () => {
      setLoading(true);

      try {
        // Try personalized content if user is logged in (commented out until function is available)
        // if (user) {
        //   const personalizedData = await generateCosmicDeepDive({
        //     topic: `${normalizedPlacement}-${normalizedSign}`,
        //     userContext: profile?.zodiac_sign,
        //   });
        //   
        //   if (personalizedData?.deepDive) {
        //     setContent(personalizedData.deepDive as any);
        //     setIsPersonalized(true);
        //     setLoading(false);
        //     return;
        //   }
        // }

        // Fallback to static content
        const contentData = await getDocuments(
          'zodiac_sign_content',
          [
            ['placement', '==', normalizedPlacement],
            ['sign', '==', normalizedSign],
          ]
        );

        if (contentData.length === 0) {
          setError(`No insights available for ${sign} ${placement} yet`);
          toast({
            title: "Content Not Found",
            description: `No insights available for ${sign} ${placement} yet`,
            variant: "destructive",
          });
          setContent(null);
        } else {
          setContent(contentData[0] as CosmiqContent || null);
        }
        
        setIsPersonalized(false);
      } catch (error) {
        console.error('Error fetching cosmiq content:', error);
        const errorMessage = error instanceof Error ? error.message : "Failed to load cosmiq insights";
        setError(errorMessage);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        setContent(null);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [placement, sign, toast, user, profile]);

  // Safe access to placement/sign with fallbacks
  const normalizedPlacement = placement?.toLowerCase() || '';
  const normalizedSign = sign?.toLowerCase() || '';
  const Icon = placementIcons[normalizedPlacement as keyof typeof placementIcons] || Sparkles;
  const gradient = placementColors[normalizedPlacement as keyof typeof placementColors] || 'from-gray-500/20 to-gray-500/20';
  const p = normalizedPlacement;

  const placementNames: Record<string, string> = {
    sun: "Sun",
    moon: "Moon",
    rising: "Rising",
    mercury: "Mercury",
    mars: "Mars",
    venus: "Venus",
  };

  // Render Sun sections
  const renderSunSections = () => {
    if (!content) return null;
    return (
      <>
        {content.core_identity && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="bg-obsidian/80 border-royal-purple/30 p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✨</span>
                  <h3 className="text-base font-bold text-white">Your Core Identity</h3>
                </div>
                <p className="text-gray-200 text-sm leading-relaxed">{content.core_identity}</p>
              </div>
            </Card>
          </motion.div>
        )}
        {content.life_purpose && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-obsidian/80 border-royal-purple/30 p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎯</span>
                  <h3 className="text-base font-bold text-white">Life Purpose Themes</h3>
                </div>
                <p className="text-gray-200 text-sm leading-relaxed">{content.life_purpose}</p>
              </div>
            </Card>
          </motion.div>
        )}
        {content.natural_strengths && content.natural_strengths.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="bg-obsidian/80 border-royal-purple/30 p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💪</span>
                  <h3 className="text-base font-bold text-white">Natural Strengths</h3>
                </div>
                <ul className="space-y-1.5">
                  {content.natural_strengths.map((s, i) => (
                    <li key={i} className="text-gray-200 text-sm flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </motion.div>
        )}
        {content.growth_areas && content.growth_areas.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-obsidian/80 border-royal-purple/30 p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌱</span>
                  <h3 className="text-base font-bold text-white">Growth Edges</h3>
                </div>
                <ul className="space-y-1.5">
                  {content.growth_areas.map((g, i) => (
                    <li key={i} className="text-gray-200 text-sm flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5">•</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </motion.div>
        )}
      </>
    );
  };

  // Render Moon sections
  const renderMoonSections = () => {
    if (!content) return null;
    return (
      <>
        {content.emotional_landscape && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="bg-obsidian/80 border-royal-purple/30 p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌊</span>
                  <h3 className="text-base font-bold text-white">Your Emotional Landscape</h3>
                </div>
                <p className="text-gray-200 text-sm leading-relaxed">{content.emotional_landscape}</p>
              </div>
            </Card>
          </motion.div>
        )}
        {content.comfort_needs && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-obsidian/80 border-royal-purple/30 p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏠</span>
                  <h3 className="text-base font-bold text-white">What You Need to Feel Safe</h3>
                </div>
                <p className="text-gray-200 text-sm leading-relaxed">{content.comfort_needs}</p>
              </div>
            </Card>
          </motion.div>
        )}
        {content.intuitive_gifts && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="bg-obsidian/80 border-royal-purple/30 p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔮</span>
                  <h3 className="text-base font-bold text-white">Intuitive Gifts</h3>
                </div>
                <p className="text-gray-200 text-sm leading-relaxed">{content.intuitive_gifts}</p>
              </div>
            </Card>
          </motion.div>
        )}
        {content.emotional_triggers && content.emotional_triggers.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-obsidian/80 border-royal-purple/30 p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚡</span>
                  <h3 className="text-base font-bold text-white">Watch Out For</h3>
                </div>
                <ul className="space-y-1.5">
                  {content.emotional_triggers.map((t, i) => (
                    <li key={i} className="text-gray-200 text-sm flex items-start gap-2">
                      <span className="text-rose-400 mt-0.5">•</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </motion.div>
        )}
      </>
    );
  };

  // Render Rising sections
  const renderRisingSections = () => {
    if (!content) return null;
    return (
      <>
        {content.your_aura && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="bg-obsidian/80 border-royal-purple/30 p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✨</span>
                  <h3 className="text-base font-bold text-white">Your Aura & Energy</h3>
                </div>
                <p className="text-gray-200 text-sm leading-relaxed">{content.your_aura}</p>
              </div>
            </Card>
          </motion.div>
        )}
        {content.first_impressions && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-obsidian/80 border-royal-purple/30 p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">👋</span>
                  <h3 className="text-base font-bold text-white">How Others See You</h3>
                </div>
                <p className="text-gray-200 text-sm leading-relaxed">{content.first_impressions}</p>
              </div>
            </Card>
          </motion.div>
        )}
        {content.social_superpowers && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="bg-obsidian/80 border-royal-purple/30 p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌟</span>
                  <h3 className="text-base font-bold text-white">Social Superpowers</h3>
                </div>
                <p className="text-gray-200 text-sm leading-relaxed">{content.social_superpowers}</p>
              </div>
            </Card>
          </motion.div>
        )}
        {content.presentation_tips && content.presentation_tips.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-obsidian/80 border-royal-purple/30 p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💡</span>
                  <h3 className="text-base font-bold text-white">Quick Tips</h3>
                </div>
                <ul className="space-y-1.5">
                  {content.presentation_tips.map((tip, i) => (
                    <li key={i} className="text-gray-200 text-sm flex items-start gap-2">
                      <span className="text-purple-400 mt-0.5">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </motion.div>
        )}
      </>
    );
  };

  // Render Mercury/Mars/Venus single insight
  const renderSingleInsight = () => {
    if (!content) return null;
    
    let insight: string | undefined;
    if (p === 'mercury') insight = content.mental_insight;
    else if (p === 'mars') insight = content.action_insight;
    else if (p === 'venus') insight = content.love_insight;
    
    // Fallback for legacy data
    if (!insight) {
      if (p === 'mercury') insight = content.overview;
      else if (p === 'mars') insight = content.overview;
      else if (p === 'venus') insight = content.overview;
    }
    
    const label = insightLabels[p];
    
    if (!insight || !label) return null;
    
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="bg-obsidian/80 border-royal-purple/30 p-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{label.icon}</span>
              <h3 className="text-base font-bold text-white">{label.title}</h3>
            </div>
            <p className="text-gray-200 text-sm leading-relaxed">{insight}</p>
          </div>
        </Card>
      </motion.div>
    );
  };

  // Determine which sections to render based on placement
  const renderSections = () => {
    if (p === 'sun') return renderSunSections();
    if (p === 'moon') return renderMoonSections();
    if (p === 'rising') return renderRisingSections();
    return renderSingleInsight();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-purple-950/20 to-gray-950 relative overflow-hidden pb-24">
      {/* Placement-specific animation */}
      <PlacementAnimation placement={p} />

      {/* Stars background */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
            animate={{ opacity: [0.1, 1, 0.1] }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <div className="relative max-w-3xl mx-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-white bg-gray-900/50 backdrop-blur-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1"
          >
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center border border-royal-purple/30`}>
                <Icon className="w-5 h-5 text-pure-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-white capitalize">
                    {normalizedSign} {placementNames[normalizedPlacement] || normalizedPlacement}
                  </h1>
                  {isPersonalized && (
                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs border-none">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Personalized
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {error ? (
          <Card className="bg-red-950/50 border-red-500/30 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-200 mb-2">Unable to Load Content</h3>
                <p className="text-red-300 text-sm mb-4">{error}</p>
                <Button
                  onClick={() => navigate('/horoscope')}
                  variant="outline"
                  className="border-red-500/50 text-red-200 hover:bg-red-500/20"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Horoscope
                </Button>
              </div>
            </div>
          </Card>
        ) : loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full bg-gray-800/50" />
            <Skeleton className="h-20 w-full bg-gray-800/50" />
            <Skeleton className="h-20 w-full bg-gray-800/50" />
            <p className="text-center text-gray-400 text-sm animate-pulse">
              ✨ Generating your cosmic insight...
            </p>
          </div>
        ) : content ? (
          <>
            {/* Title Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className={`bg-gradient-to-br ${gradient} border-royal-purple/30 p-5`}>
                <div className="space-y-1 text-center">
                  <h2 className="text-xl font-black text-white">{content.title}</h2>
                  <p className="text-base text-gray-200 italic">{content.tagline}</p>
                </div>
              </Card>
            </motion.div>

            {/* Placement-specific sections */}
            {renderSections()}
          </>
        ) : null}
      </div>

      <BottomNav />
    </div>
  );
};

export default CosmiqDeepDive;
