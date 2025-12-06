import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface CategoryCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
  glowColor: string;
  onClick: () => void;
  delay?: number;
}

export const CategoryCard = ({
  icon: Icon,
  title,
  description,
  gradient,
  glowColor,
  onClick,
  delay = 0,
}: CategoryCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative group cursor-pointer"
    >
      <div
        className={`absolute inset-0 rounded-2xl blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-500 ${glowColor}`}
      />
      
      <div className={`relative overflow-hidden rounded-2xl p-6 border border-white/10 backdrop-blur-sm ${gradient}`}>
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)',
          }}
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            repeatDelay: 2,
          }}
        />

        <motion.div
          className="mb-4 inline-flex items-center justify-center w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm"
          whileHover={{ rotate: [0, -10, 10, 0] }}
          transition={{ duration: 0.5 }}
        >
          <Icon className="h-7 w-7 text-pure-white" />
        </motion.div>

        <div>
          <h3 className="text-lg font-bold text-pure-white mb-1">{title}</h3>
          <p className="text-sm text-white/60 mb-3">{description}</p>
        </div>

        <motion.div
          className="absolute top-4 right-4 text-white/30"
          animate={{ rotate: 360, scale: [1, 1.2, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        >
          ✦
        </motion.div>
      </div>
    </motion.div>
  );
};