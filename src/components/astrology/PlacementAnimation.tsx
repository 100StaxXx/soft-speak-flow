import { motion } from "framer-motion";

interface PlacementAnimationProps {
  placement: string;
}

export const PlacementAnimation = ({ placement }: PlacementAnimationProps) => {
  switch (placement) {
    case 'sun':
      return <SunAnimation />;
    case 'moon':
      return <MoonAnimation />;
    case 'rising':
      return <RisingAnimation />;
    case 'mercury':
      return <MercuryAnimation />;
    case 'mars':
      return <MarsAnimation />;
    case 'venus':
      return <VenusAnimation />;
    default:
      return null;
  }
};

// Sun: Golden rays pulsing outward from center
const SunAnimation = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden">
    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2">
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-32 bg-gradient-to-t from-amber-500/40 to-transparent origin-bottom"
          style={{ rotate: `${i * 45}deg` }}
          animate={{
            scaleY: [1, 1.3, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut",
          }}
        />
      ))}
      <motion.div
        className="absolute w-20 h-20 rounded-full bg-amber-400/20 blur-xl -translate-x-1/2 -translate-y-1/2"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.4, 0.6, 0.4],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  </div>
);

// Moon: Soft floating orbs drifting
const MoonAnimation = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden">
    {[...Array(6)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full bg-purple-300/20 blur-md"
        style={{
          width: 20 + Math.random() * 30,
          height: 20 + Math.random() * 30,
          left: `${10 + i * 15}%`,
          top: `${20 + (i % 3) * 25}%`,
        }}
        animate={{
          y: [0, -20, 0],
          x: [0, 10, 0],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 5 + i,
          repeat: Infinity,
          delay: i * 0.5,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);

// Rising: Light rays ascending from bottom
const RisingAnimation = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden">
    {[...Array(5)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute bottom-0 w-px bg-gradient-to-t from-cyan-400/50 via-cyan-300/30 to-transparent"
        style={{
          left: `${15 + i * 18}%`,
          height: '40%',
        }}
        animate={{
          scaleY: [0, 1, 0],
          opacity: [0, 0.6, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          delay: i * 0.4,
          ease: "easeOut",
        }}
      />
    ))}
    <motion.div
      className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-cyan-500/10 to-transparent"
      animate={{
        opacity: [0.3, 0.5, 0.3],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  </div>
);

// Mercury: Quick thought sparks flickering
const MercuryAnimation = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden">
    {[...Array(8)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-2 h-2 rounded-full bg-emerald-400/60"
        style={{
          left: `${Math.random() * 80 + 10}%`,
          top: `${Math.random() * 60 + 20}%`,
        }}
        animate={{
          scale: [0, 1, 0],
          opacity: [0, 0.8, 0],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          delay: i * 0.3,
          ease: "easeOut",
        }}
      />
    ))}
  </div>
);

// Mars: Floating ember particles rising
const MarsAnimation = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden">
    {[...Array(12)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1.5 h-1.5 rounded-full bg-orange-500/70"
        style={{
          left: `${Math.random() * 90 + 5}%`,
          bottom: `-5%`,
        }}
        animate={{
          y: [0, -window.innerHeight * 0.8],
          x: [0, (Math.random() - 0.5) * 50],
          opacity: [0.8, 0],
          scale: [1, 0.3],
        }}
        transition={{
          duration: 4 + Math.random() * 2,
          repeat: Infinity,
          delay: i * 0.4,
          ease: "easeOut",
        }}
      />
    ))}
  </div>
);

// Venus: Soft pink swirls
const VenusAnimation = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden">
    {[...Array(3)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full blur-2xl"
        style={{
          width: 150,
          height: 150,
          background: `radial-gradient(circle, rgba(244,114,182,0.2) 0%, transparent 70%)`,
          left: `${20 + i * 25}%`,
          top: `${30 + i * 15}%`,
        }}
        animate={{
          scale: [1, 1.3, 1],
          rotate: [0, 180, 360],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8 + i * 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);
