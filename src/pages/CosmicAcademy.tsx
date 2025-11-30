import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Sun, Moon, ArrowUp, Brain, Zap, Heart, Sparkles, BookOpen } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

const CosmiqAcademy = () => {
  const navigate = useNavigate();

  const academyTopics = [
    {
      title: "Understanding Your Big Three",
      description: "Learn about the most important trio in your cosmiq profile: Sun, Moon, and Rising",
      icon: Sparkles,
      gradient: "from-purple-500/20 to-pink-500/20"
    },
    {
      title: "The Sun: Your Core Self",
      description: "Your Sun sign represents your core identity, ego, and life purpose",
      icon: Sun,
      gradient: "from-amber-500/20 to-orange-500/20"
    },
    {
      title: "The Moon: Your Emotional World",
      description: "Your Moon sign reveals your inner emotional landscape and instincts",
      icon: Moon,
      gradient: "from-blue-500/20 to-purple-500/20"
    },
    {
      title: "The Rising: Your Mask",
      description: "Your Rising sign is how the world sees you - your first impression",
      icon: ArrowUp,
      gradient: "from-purple-500/20 to-rose-500/20"
    },
    {
      title: "Mercury: Mind & Communication",
      description: "Mercury rules how you think, learn, and communicate with the world",
      icon: Brain,
      gradient: "from-cyan-500/20 to-teal-500/20"
    },
    {
      title: "Mars: Drive & Energy",
      description: "Mars governs your physical energy, drive, and how you take action",
      icon: Zap,
      gradient: "from-red-500/20 to-orange-500/20"
    },
    {
      title: "Venus: Love & Values",
      description: "Venus reveals what you value, how you love, and what brings you joy",
      icon: Heart,
      gradient: "from-pink-500/20 to-rose-500/20"
    }
  ];

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

      <div className="relative max-w-4xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-white bg-gray-900/50 backdrop-blur-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 text-center"
          >
            <h1 className="text-3xl font-black text-white flex items-center justify-center gap-2">
              <BookOpen className="w-8 h-8 text-purple-400" />
              Cosmiq Academy
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Deepen your understanding of your cosmiq blueprint
            </p>
          </motion.div>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>

        {/* Intro Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-purple-900/30 via-pink-900/30 to-blue-900/30 border-purple-500/30 p-6">
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-white">What is Astrology?</h2>
              <p className="text-gray-200 leading-relaxed">
                Astrology is the study of how celestial bodies influence our lives. Your birth chart is like a snapshot of the sky at the exact moment you were born - a cosmiq fingerprint that's uniquely yours.
              </p>
              <p className="text-gray-200 leading-relaxed">
                Each planet represents different aspects of your personality and life experience. Their positions in different zodiac signs color how those planetary energies express themselves through you.
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Topic Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {academyTopics.map((topic, index) => {
            const Icon = topic.icon;
            return (
              <motion.div
                key={topic.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
              >
                <Card className="bg-obsidian/80 border-royal-purple/30 hover:border-royal-purple/60 transition-all cursor-pointer group hover:scale-105">
                  <div className="p-6 space-y-3">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${topic.gradient} flex items-center justify-center border border-royal-purple/30`}>
                      <Icon className="w-6 h-6 text-pure-white" />
                    </div>
                    <h3 className="text-lg font-bold text-pure-white group-hover:text-accent-purple transition-colors">
                      {topic.title}
                    </h3>
                    <p className="text-sm text-cloud-white leading-relaxed">
                      {topic.description}
                    </p>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <Card className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 border-none p-6">
            <div className="text-center space-y-3">
              <h3 className="text-xl font-bold text-white">Ready to explore your placements?</h3>
              <p className="text-white/90 text-sm">
                Tap on any of your Big Three or planetary placements on your profile to dive deeper into what they mean for you.
              </p>
              <Button
                onClick={() => navigate('/profile')}
                className="bg-white text-purple-600 hover:bg-gray-100 font-bold"
              >
                View My Profile
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
};

export default CosmiqAcademy;
