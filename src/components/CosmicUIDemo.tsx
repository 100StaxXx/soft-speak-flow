/**
 * CosmicUIDemo - Demonstration component showcasing all cosmic UI enhancements
 * 
 * This component can be used as a reference or added to a settings/about page
 * to showcase the cosmic visual effects.
 */

import { useState } from "react";
import { CosmicButton } from "./CosmicButton";
import { CosmicCard } from "./CosmicCard";
import { CosmicTransition } from "./CosmicTransition";
import { ScrollStars } from "./ScrollStars";
import { StarfieldBackground } from "./StarfieldBackground";

export const CosmicUIDemo = () => {
  const [showTransition, setShowTransition] = useState(true);
  const [transitionMode, setTransitionMode] = useState<"warp" | "constellation">("warp");

  return (
    <div className="min-h-screen relative p-8">
      {/* Background Effects */}
      <StarfieldBackground />
      <ScrollStars />

      {/* Demo Content */}
      <div className="relative z-10 max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-[hsl(var(--cosmic-glow))] via-[hsl(var(--nebula-pink))] to-[hsl(var(--celestial-blue))] bg-clip-text text-transparent">
            Cosmiq UI Showcase
          </h1>
          <p className="text-[hsl(var(--steel))] text-lg">
            Explore the cosmic visual enhancements
          </p>
        </div>

        {/* Cosmic Buttons */}
        <CosmicCard glowColor="purple" intensity="medium">
          <h2 className="text-2xl font-bold mb-4">CosmicButton</h2>
          <p className="text-[hsl(var(--steel))] mb-6">
            Click buttons to see particle burst effects
          </p>
          <div className="flex flex-wrap gap-4">
            <CosmicButton variant="default">
              Default Button
            </CosmicButton>
            <CosmicButton variant="glow">
              Glow Button
            </CosmicButton>
            <CosmicButton variant="glass">
              Glass Button
            </CosmicButton>
          </div>
        </CosmicCard>

        {/* Cosmic Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <CosmicCard glowColor="pink" intensity="strong">
            <h3 className="text-xl font-bold mb-2">Nebula Pink</h3>
            <p className="text-[hsl(var(--steel))]">
              Standard card with constellation pattern
            </p>
          </CosmicCard>

          <CosmicCard glowColor="blue" intensity="medium">
            <h3 className="text-xl font-bold mb-2">Celestial Blue</h3>
            <p className="text-[hsl(var(--steel))]">
              Hover to see scale effect
            </p>
          </CosmicCard>

          <CosmicCard glowColor="gold" intensity="subtle">
            <h3 className="text-xl font-bold mb-2">Stardust Gold</h3>
            <p className="text-[hsl(var(--steel))]">
              Subtle intensity variant
            </p>
          </CosmicCard>

          <CosmicCard animated>
            <h3 className="text-xl font-bold mb-2">Animated Border</h3>
            <p className="text-[hsl(var(--steel))]">
              Watch the gradient spin
            </p>
          </CosmicCard>
        </div>

        {/* Transition Demo */}
        <CosmicCard glowColor="purple" intensity="medium">
          <h2 className="text-2xl font-bold mb-4">CosmicTransition</h2>
          <p className="text-[hsl(var(--steel))] mb-6">
            Toggle to see page transition effects
          </p>
          
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setTransitionMode("warp")}
              className={`px-4 py-2 rounded ${
                transitionMode === "warp" 
                  ? "bg-[hsl(var(--cosmic-glow))]" 
                  : "bg-[hsl(var(--charcoal))]"
              }`}
            >
              Warp Mode
            </button>
            <button
              onClick={() => setTransitionMode("constellation")}
              className={`px-4 py-2 rounded ${
                transitionMode === "constellation" 
                  ? "bg-[hsl(var(--cosmic-glow))]" 
                  : "bg-[hsl(var(--charcoal))]"
              }`}
            >
              Constellation Mode
            </button>
          </div>

          <CosmicButton 
            variant="glow" 
            onClick={() => setShowTransition(!showTransition)}
          >
            Toggle Transition
          </CosmicButton>

          <div className="mt-6 min-h-[200px] flex items-center justify-center">
            <CosmicTransition show={showTransition} mode={transitionMode}>
              <div className="cosmic-glass p-8 rounded-xl text-center">
                <h3 className="text-3xl font-bold mb-2">
                  {transitionMode === "warp" ? "🚀 Warp Drive" : "⭐ Constellation"}
                </h3>
                <p className="text-[hsl(var(--steel))]">
                  This content animates in and out
                </p>
              </div>
            </CosmicTransition>
          </div>
        </CosmicCard>

        {/* Animation Classes Demo */}
        <CosmicCard glowColor="blue" intensity="medium">
          <h2 className="text-2xl font-bold mb-4">Animation Classes</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="cosmic-glass p-4 rounded text-center">
              <div className="w-4 h-4 mx-auto mb-2 bg-white rounded-full animate-twinkle" />
              <p className="text-sm">Twinkle</p>
            </div>

            <div className="cosmic-glass p-4 rounded text-center">
              <div className="w-4 h-4 mx-auto mb-2 bg-white rounded-full animate-orbit" />
              <p className="text-sm">Orbit</p>
            </div>

            <div className="cosmic-glass p-4 rounded text-center">
              <div className="w-16 h-16 mx-auto mb-2 bg-[hsl(var(--cosmic-glow))] rounded-full animate-cosmic-pulse" />
              <p className="text-sm">Cosmic Pulse</p>
            </div>

            <div className="cosmic-glass p-4 rounded text-center star-shimmer">
              <div className="w-full h-8 mb-2 flex items-center justify-center">
                ✨
              </div>
              <p className="text-sm">Star Shimmer</p>
            </div>
          </div>
        </CosmicCard>

        {/* Color Palette */}
        <CosmicCard glowColor="gold" intensity="medium">
          <h2 className="text-2xl font-bold mb-4">Cosmic Color Palette</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            
            <div className="text-center">
              <div className="w-full h-16 rounded bg-[hsl(var(--nebula-pink))] mb-2" />
              <p className="text-sm">Nebula Pink</p>
            </div>

            <div className="text-center">
              <div className="w-full h-16 rounded bg-[hsl(var(--celestial-blue))] mb-2" />
              <p className="text-sm">Celestial Blue</p>
            </div>

            <div className="text-center">
              <div className="w-full h-16 rounded bg-[hsl(var(--stardust-gold))] mb-2" />
              <p className="text-sm">Stardust Gold</p>
            </div>

            <div className="text-center">
              <div className="w-full h-16 rounded bg-[hsl(var(--deep-space))] mb-2" />
              <p className="text-sm">Deep Space</p>
            </div>

            <div className="text-center">
              <div className="w-full h-16 rounded bg-[hsl(var(--cosmic-glow))] mb-2" />
              <p className="text-sm">Cosmic Glow</p>
            </div>
          </div>
        </CosmicCard>

        {/* Scroll Stars Note */}
        <div className="text-center p-8 cosmic-glass rounded-xl">
          <p className="text-[hsl(var(--steel))]">
            💫 <strong>Tip:</strong> Scroll this page to see ambient star particles drift upward!
          </p>
        </div>

      </div>
    </div>
  );
};
