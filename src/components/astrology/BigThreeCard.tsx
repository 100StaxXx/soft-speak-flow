import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Sun, Moon, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface BigThreeCardProps {
  type: 'sun' | 'moon' | 'rising';
  sign: string;
  description: string;
  delay?: number;
}

const cardConfig = {
  sun: {
    icon: Sun,
    title: "Sun Sign",
    subtitle: "Your Core Identity",
    gradient: "from-amber-500/20 via-orange-500/20 to-yellow-500/20",
    borderColor: "border-amber-500/50",
    iconColor: "text-amber-400",
    glowColor: "shadow-amber-500/20",
  },
  moon: {
    icon: Moon,
    title: "Moon Sign",
    subtitle: "Your Emotional Nature",
    gradient: "from-blue-500/20 via-indigo-500/20 to-purple-500/20",
    borderColor: "border-blue-400/50",
    iconColor: "text-blue-300",
    glowColor: "shadow-blue-500/20",
  },
  rising: {
    icon: ArrowUp,
    title: "Rising Sign",
    subtitle: "How the World Sees You",
    gradient: "from-purple-500/20 via-pink-500/20 to-rose-500/20",
    borderColor: "border-purple-400/50",
    iconColor: "text-purple-300",
    glowColor: "shadow-purple-500/20",
  },
};

export const BigThreeCard = ({ type, sign, description, delay = 0 }: BigThreeCardProps) => {
  const config = cardConfig[type];
  const Icon = config.icon;
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/cosmic/${type}/${sign.toLowerCase()}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.6, 
        delay,
        type: "spring",
        stiffness: 100,
      }}
      onClick={handleClick}
      className="cursor-pointer"
    >
      <Card className={`relative overflow-hidden border-2 ${config.borderColor} bg-obsidian/80 backdrop-blur-sm shadow-2xl ${config.glowColor} hover:scale-105 transition-transform duration-300`}>
        {/* Animated cosmic background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-30`}>
          <motion.div
            className="absolute inset-0"
            animate={{
              backgroundPosition: ['0% 0%', '100% 100%'],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              repeatType: 'reverse',
            }}
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '50px 50px',
            }}
          />
        </div>

        <CardContent className="relative p-8 space-y-4">
          {/* Icon with pulse animation */}
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: type === 'sun' ? [0, 360] : 0,
            }}
            transition={{
              duration: type === 'sun' ? 20 : 4,
              repeat: Infinity,
              repeatType: 'loop',
            }}
            className="flex justify-center mb-4"
          >
            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center border-2 ${config.borderColor}`}>
              <Icon className={`w-10 h-10 ${config.iconColor}`} />
            </div>
          </motion.div>

          {/* Title and sign */}
          <div className="text-center space-y-2">
            <h3 className="text-sm font-medium text-steel uppercase tracking-wider">
              {config.title}
            </h3>
            <p className="text-3xl font-bold text-pure-white capitalize">
              {sign}
            </p>
            <p className="text-xs text-accent-purple font-medium">
              {config.subtitle}
            </p>
          </div>

          {/* Description */}
          <div className="pt-4 border-t border-royal-purple/30">
            <p className="text-sm text-cloud-white leading-relaxed text-center">
              {description}
            </p>
            <p className="text-xs text-accent-purple text-center mt-2 font-medium">
              Tap to learn more →
            </p>
          </div>

          {/* Sparkle effects */}
          <motion.div
            className="absolute top-4 right-4 w-2 h-2 bg-accent-purple rounded-full"
            animate={{
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: delay + 0.5,
            }}
          />
          <motion.div
            className="absolute bottom-4 left-4 w-2 h-2 bg-accent-purple rounded-full"
            animate={{
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: delay + 1,
            }}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
};