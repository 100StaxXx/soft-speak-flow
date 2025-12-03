import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Zap, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PlanetaryCardProps {
  planet: 'mercury' | 'mars' | 'venus';
  sign: string;
  description: string;
  delay?: number;
}

const planetConfig = {
  mercury: {
    icon: Brain,
    name: "Mercury",
    aspect: "Mind",
    subtitle: "Communication & Thought",
    gradient: "from-cyan-500/20 to-teal-500/20",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    deepDive: "Mercury is the messenger planet, governing how you think, learn, and communicate. It influences your mental processes, how you absorb and share information, and your style of expression. A strong Mercury placement helps you articulate ideas clearly and think critically.",
  },
  mars: {
    icon: Zap,
    name: "Mars",
    aspect: "Body",
    subtitle: "Drive & Action",
    gradient: "from-red-500/20 to-orange-500/20",
    badgeColor: "bg-red-500/20 text-red-300 border-red-500/30",
    deepDive: "Mars is your warrior energy - the planet of action, drive, and physical vitality. It governs how you pursue goals, handle conflict, and channel your energy into physical activities. Understanding your Mars helps you harness your motivation and assertiveness constructively.",
  },
  venus: {
    icon: Heart,
    name: "Venus",
    aspect: "Soul",
    subtitle: "Values & Connection",
    gradient: "from-pink-500/20 to-rose-500/20",
    badgeColor: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    deepDive: "Venus rules love, beauty, and values. It shapes what you find attractive, how you relate to others in relationships, and what brings you pleasure and harmony. Your Venus placement reveals your love language and what makes you feel truly valued and appreciated.",
  },
};

export const PlanetaryCard = ({ planet, sign, description, delay = 0 }: PlanetaryCardProps) => {
  const config = planetConfig[planet];
  const Icon = config.icon;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay }}
      onClick={() => setIsOpen(true)}
      className="cursor-pointer"
    >
      <Card className="bg-obsidian/60 border-royal-purple/30 hover:border-royal-purple/50 transition-all hover:shadow-lg hover:shadow-accent-purple/10 hover:scale-[1.02]">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <motion.div
              animate={{ rotate: planet === 'mars' ? [0, 5, -5, 0] : 0 }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className={`w-12 h-12 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center flex-shrink-0 border border-royal-purple/30`}
            >
              <Icon className="w-6 h-6 text-pure-white" />
            </motion.div>

            {/* Content */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-pure-white">{config.name}</h4>
                  <p className="text-xs text-steel">{config.subtitle}</p>
                </div>
                <Badge className={`${config.badgeColor} border`}>
                  {config.aspect}
                </Badge>
              </div>

              <p className="text-lg font-semibold text-accent-purple capitalize">
                {sign}
              </p>

              <p className="text-sm text-cloud-white leading-relaxed">
                {description}
              </p>
              <p className="text-xs text-accent-purple mt-2 font-medium">
                Tap to explore →
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>

    {/* Deep Dive Dialog */}
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className={`bg-obsidian/95 border border-royal-purple/50 backdrop-blur-xl max-w-md`}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center border border-royal-purple/30`}>
              <Icon className="w-6 h-6 text-pure-white" />
            </div>
            <div>
              <DialogTitle className="text-pure-white text-xl">{config.name}</DialogTitle>
              <p className="text-sm text-steel">{config.subtitle}</p>
            </div>
            <Badge className={`${config.badgeColor} border ml-auto`}>
              {config.aspect}
            </Badge>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-center py-3">
            <p className="text-2xl font-bold text-accent-purple capitalize">{sign}</p>
          </div>
          <p className="text-cloud-white leading-relaxed text-sm">
            {description}
          </p>
          <div className="pt-4 border-t border-royal-purple/30">
            <p className="text-steel text-sm leading-relaxed">
              {config.deepDive}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};