import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sun, Moon, ArrowUp, Brain, Zap, Heart, Sparkles, CheckCircle2, XCircle, Star, Calendar } from "lucide-react";
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
  overview: string;
  strengths: string[];
  challenges: string[];
  in_relationships: string;
  in_work: string;
  in_wellness: string;
  compatible_signs: string[];
  daily_practice: string;
  chart_synergy?: string;
  todays_focus?: string;
}

const CosmiqDeepDive = () => {
  const { placement, sign } = useParams<{ placement: string; sign: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [content, setContent] = useState<CosmiqContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [quizAnswer, setQuizAnswer] = useState<boolean | null>(null);
  const [isPersonalized, setIsPersonalized] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      if (!placement || !sign) return;
      setLoading(true);

      try {
        // If user is logged in, try to get personalized content
        if (user) {
          const { data: personalizedData, error: personalizedError } = await supabase.functions.invoke(
            'generate-cosmic-deep-dive',
            { body: { placement: placement.toLowerCase(), sign: sign.toLowerCase() } }
          );

          if (!personalizedError && personalizedData && !personalizedData.error) {
            setContent(personalizedData);
            setIsPersonalized(true);
            setLoading(false);
            return;
          }

          // Log error but fall back to static content
          if (personalizedError || personalizedData?.error) {
            console.log('Falling back to static content:', personalizedError || personalizedData?.error);
          }
        }

        // Fall back to static content from zodiac_sign_content
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-purple-950/20 to-gray-950 relative overflow-hidden pb-24">
      {/* Cosmiq background */}
      <div className="absolute inset-0">
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
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <div className="relative max-w-3xl mx-auto p-6 space-y-8">
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
                <p className="text-sm text-gray-400">
                  {isPersonalized ? "Generated for your unique chart" : "Understanding your placement"}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 w-full bg-gray-800/50" />
            <Skeleton className="h-48 w-full bg-gray-800/50" />
            <Skeleton className="h-48 w-full bg-gray-800/50" />
            <p className="text-center text-gray-400 text-sm animate-pulse">
              ✨ Generating your personalized cosmic insights...
            </p>
          </div>
        ) : content ? (
          <>
            {/* Main Title Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className={`bg-gradient-to-br ${gradient} border-royal-purple/30 p-8`}>
                <div className="space-y-3 text-center">
                  <h2 className="text-3xl font-black text-white">{content.title}</h2>
                  <p className="text-xl text-gray-200 italic">{content.tagline}</p>
                </div>
              </Card>
            </motion.div>

            {/* Today's Focus - Only for personalized content */}
            {isPersonalized && content.todays_focus && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <Card className="bg-gradient-to-r from-indigo-600/30 via-purple-600/30 to-pink-600/30 border-purple-500/40 p-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-300" />
                      <h3 className="text-lg font-bold text-purple-200">Today's Focus</h3>
                      <Badge className="bg-purple-500/20 text-purple-200 text-xs border-purple-500/30">
                        {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Badge>
                    </div>
                    <p className="text-gray-100 leading-relaxed">{content.todays_focus}</p>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Chart Synergy - Only for personalized content */}
            {isPersonalized && content.chart_synergy && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
              >
                <Card className="bg-gradient-to-br from-violet-950/50 to-fuchsia-950/50 border-violet-500/30 p-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-violet-300" />
                      <h3 className="text-lg font-bold text-violet-200">In Your Chart</h3>
                    </div>
                    <p className="text-gray-200 leading-relaxed">{content.chart_synergy}</p>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* What is this placement? */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-obsidian/80 border-royal-purple/30 p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-accent-purple">
                    What is {placementNames[placement]} in {sign.charAt(0).toUpperCase() + sign.slice(1)}?
                  </h3>
                  <p className="text-gray-200 leading-relaxed">{content.overview}</p>
                </div>
              </Card>
            </motion.div>

            {/* Strengths & Challenges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <Card className="bg-emerald-950/30 border-emerald-500/30 p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Your Strengths
                  </h3>
                  <ul className="space-y-2">
                    {content.strengths.map((strength, i) => (
                      <li key={i} className="text-gray-200 flex items-start gap-2">
                        <span className="text-emerald-400 mt-1">•</span>
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>

              <Card className="bg-rose-950/30 border-rose-500/30 p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-rose-300 flex items-center gap-2">
                    <XCircle className="w-5 h-5" />
                    Growth Areas
                  </h3>
                  <ul className="space-y-2">
                    {content.challenges.map((challenge, i) => (
                      <li key={i} className="text-gray-200 flex items-start gap-2">
                        <span className="text-rose-400 mt-1">•</span>
                        <span>{challenge}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </motion.div>

            {/* How It Shows Up */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-4"
            >
              <h3 className="text-2xl font-bold text-white text-center">How It Shows Up</h3>

              <Card className="bg-pink-950/30 border-pink-500/30 p-6">
                <div className="space-y-3">
                  <h4 className="text-lg font-bold text-pink-300">💕 In Relationships</h4>
                  <p className="text-gray-200 leading-relaxed">{content.in_relationships}</p>
                </div>
              </Card>

              <Card className="bg-amber-950/30 border-amber-500/30 p-6">
                <div className="space-y-3">
                  <h4 className="text-lg font-bold text-amber-300">💼 In Work</h4>
                  <p className="text-gray-200 leading-relaxed">{content.in_work}</p>
                </div>
              </Card>

              <Card className="bg-blue-950/30 border-blue-500/30 p-6">
                <div className="space-y-3">
                  <h4 className="text-lg font-bold text-blue-300">🌿 In Wellness</h4>
                  <p className="text-gray-200 leading-relaxed">{content.in_wellness}</p>
                </div>
              </Card>
            </motion.div>

            {/* Compatible Signs */}
            {content.compatible_signs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="bg-obsidian/80 border-royal-purple/30 p-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-accent-purple">
                      Compatible with these signs
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {content.compatible_signs.map((compatSign) => (
                        <Badge key={compatSign} className="bg-purple-500/20 text-purple-300 border-purple-500/30 capitalize">
                          {compatSign}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Daily Practice */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 border-none p-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-white" />
                    <h3 className="text-lg font-bold text-white">Daily Practice</h3>
                  </div>
                  <p className="text-white/90 leading-relaxed">{content.daily_practice}</p>
                </div>
              </Card>
            </motion.div>

            {/* Interactive Quiz */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Card className="bg-obsidian/80 border-royal-purple/30 p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white">Does this resonate with you?</h3>
                  <p className="text-gray-300 text-sm">
                    {isPersonalized 
                      ? "This reading was generated specifically for your chart. How well does it match your experience?"
                      : "Astrology is a tool for self-reflection, not a rigid definition. How well does this description match your experience?"}
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setQuizAnswer(true)}
                      variant={quizAnswer === true ? "default" : "outline"}
                      className={quizAnswer === true ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Yes, that's me!
                    </Button>
                    <Button
                      onClick={() => setQuizAnswer(false)}
                      variant={quizAnswer === false ? "default" : "outline"}
                      className={quizAnswer === false ? "bg-rose-600 hover:bg-rose-700" : ""}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Not quite
                    </Button>
                  </div>
                  {quizAnswer !== null && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-gray-400 italic"
                    >
                      {quizAnswer
                        ? "Amazing! Your cosmiq blueprint is speaking to you. 🌟"
                        : "That's okay! Every placement expresses differently based on your whole chart. Keep exploring!"}
                    </motion.p>
                  )}
                </div>
              </Card>
            </motion.div>
          </>
        ) : (
          <Card className="bg-obsidian/80 border-royal-purple/30 p-8 text-center">
            <p className="text-gray-400">Content not found for this placement.</p>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default CosmiqDeepDive;
