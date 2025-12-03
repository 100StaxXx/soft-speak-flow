import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sun, Moon, ArrowUp, Brain, Zap, Heart, Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";

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
  identity_insight?: string;  // Sun
  emotional_insight?: string; // Moon
  social_insight?: string;    // Rising
  mental_insight?: string;    // Mercury
  action_insight?: string;    // Mars
  love_insight?: string;      // Venus
  // Legacy fields
  overview?: string;
}

const insightLabels: Record<string, { title: string; icon: string }> = {
  sun: { title: "Your Core Identity", icon: "☀️" },
  moon: { title: "Your Emotional World", icon: "🌙" },
  rising: { title: "Your First Impression", icon: "✨" },
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
  const [quizAnswer, setQuizAnswer] = useState<boolean | null>(null);
  const [isPersonalized, setIsPersonalized] = useState(false);

  const handleQuizAnswer = async (resonates: boolean) => {
    setQuizAnswer(resonates);
    
    if (user && placement && sign) {
      try {
        await supabase.from('cosmic_deep_dive_feedback').insert({
          user_id: user.id,
          placement: placement.toLowerCase(),
          sign: sign.toLowerCase(),
          resonates,
        });
      } catch (error) {
        console.error('Failed to save feedback:', error);
      }
    }
  };

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

  const placementNames: Record<string, string> = {
    sun: "Sun",
    moon: "Moon",
    rising: "Rising",
    mercury: "Mercury",
    mars: "Mars",
    venus: "Venus",
  };

  // Get the insight for any placement
  const getPlacementInsight = () => {
    if (!content) return null;
    const p = placement.toLowerCase();
    if (p === 'sun') return content.identity_insight;
    if (p === 'moon') return content.emotional_insight;
    if (p === 'rising') return content.social_insight;
    if (p === 'mercury') return content.mental_insight;
    if (p === 'mars') return content.action_insight;
    if (p === 'venus') return content.love_insight;
    return content.overview; // Fallback for old data
  };

  const insight = getPlacementInsight();
  const label = insightLabels[placement.toLowerCase()];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-purple-950/20 to-gray-950 relative overflow-hidden pb-24">
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

      <div className="relative max-w-3xl mx-auto p-6 space-y-6">
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
              <Card className={`bg-gradient-to-br ${gradient} border-royal-purple/30 p-6`}>
                <div className="space-y-2 text-center">
                  <h2 className="text-2xl font-black text-white">{content.title}</h2>
                  <p className="text-lg text-gray-200 italic">{content.tagline}</p>
                </div>
              </Card>
            </motion.div>

            {/* Single Insight Card */}
            {insight && label && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <Card className="bg-obsidian/80 border-royal-purple/30 p-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{label.icon}</span>
                      <h3 className="text-lg font-bold text-white">{label.title}</h3>
                    </div>
                    <p className="text-gray-200 leading-relaxed">{insight}</p>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Feedback */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="bg-obsidian/60 border-royal-purple/20 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Does this resonate?</span>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleQuizAnswer(true)}
                      variant={quizAnswer === true ? "default" : "outline"}
                      size="sm"
                      className={quizAnswer === true ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                      disabled={quizAnswer !== null}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Yes
                    </Button>
                    <Button
                      onClick={() => handleQuizAnswer(false)}
                      variant={quizAnswer === false ? "default" : "outline"}
                      size="sm"
                      className={quizAnswer === false ? "bg-rose-600 hover:bg-rose-700" : ""}
                      disabled={quizAnswer !== null}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      No
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </>
        ) : null}
      </div>

      <BottomNav />
    </div>
  );
};

export default CosmiqDeepDive;
