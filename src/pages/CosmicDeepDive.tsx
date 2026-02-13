import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sun, Moon, ArrowUp, Brain, Zap, Heart, Sparkles } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
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

const CosmiqDeepDive = () => {
  const { placement, sign } = useParams<{ placement: string; sign: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [content, setContent] = useState<CosmiqContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPersonalized, setIsPersonalized] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      if (!placement || !sign) return;
      setLoading(true);

      try {
        if (user) {
          const timezoneOffset = new Date().getTimezoneOffset();
          const { data: personalizedData, error: personalizedError } = await supabase.functions.invoke(
            'generate-cosmic-deep-dive',
            { body: { placement: placement.toLowerCase(), sign: sign.toLowerCase(), timezoneOffset } }
          );

          if (!personalizedError && personalizedData && !personalizedData.error) {
            setContent(personalizedData);
            setIsPersonalized(true);
            setLoading(false);
            return;
          }
        }

        const { data, error } = await supabase
          .from('zodiac_sign_content')
          .select('*')
          .eq('placement', placement.toLowerCase())
          .eq('sign', sign.toLowerCase())
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          toast({
            title: "Content Not Found",
            description: `No insights available for ${sign} ${placement} yet`,
            variant: "destructive",
          });
        }

        setContent(data);
        setIsPersonalized(false);
      } catch (error) {
        console.error('Error fetching cosmiq content:', error);
        toast({
          title: "Error",
          description: "Failed to load cosmiq insights",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [placement, sign, toast, user]);

  if (!placement || !sign) {
    return <div>Invalid placement or sign</div>;
  }

  const Icon = placementIcons[placement as keyof typeof placementIcons] || Sparkles;
  const gradient = placementColors[placement as keyof typeof placementColors];
  const p = placement.toLowerCase();

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
                    {sign} {placementNames[placement]}
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

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full bg-gray-800/50" />
            <Skeleton className="h-20 w-full bg-gray-800/50" />
            <Skeleton className="h-20 w-full bg-gray-800/50" />
            <p className="text-center text-gray-400 text-sm animate-pulse">
              ✨ Preparing your Cosmiq insight...
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
