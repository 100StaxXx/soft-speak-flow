import { BottomNav } from "@/components/BottomNav";
import { Heart, Sparkles } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-cream-glow to-petal-pink/30">
      <div className="max-w-lg mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blush-rose to-lavender-mist mb-4">
            <Heart className="h-10 w-10 text-warm-charcoal" fill="currentColor" />
          </div>
          <h1 className="font-heading text-4xl font-bold text-foreground mb-2">
            About A Lil Push
          </h1>
        </div>

        {/* Content */}
        <div className="space-y-6">
          <div className="bg-card rounded-3xl p-8 shadow-soft">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-gold-accent" />
              <h2 className="font-heading text-2xl font-semibold text-foreground">
                Our Purpose
              </h2>
            </div>
            <p className="text-foreground leading-relaxed mb-4">
              A Lil Push is your pocket-sized dose of comfort and motivation. When life feels heavy or overwhelming, you can come here for a gentle reminder that you're doing better than you think.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              We believe in the power of soft encouragement. Sometimes all we need is a little push—not a shove—to keep moving forward.
            </p>
          </div>

          <div className="bg-card rounded-3xl p-8 shadow-soft">
            <h2 className="font-heading text-2xl font-semibold text-foreground mb-4">
              What We Offer
            </h2>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blush-rose/20 flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-blush-rose" />
                </div>
                <span>Daily featured pep talks to start your day with intention</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-lavender-mist/20 flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-lavender-mist" />
                </div>
                <span>A library of motivational audio messages for different moods and moments</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-petal-pink/20 flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-blush-rose" />
                </div>
                <span>Soothing quotes to remind you of your strength and worth</span>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-blush-rose/10 to-lavender-mist/10 rounded-3xl p-8 border border-blush-rose/20">
            <p className="font-heading text-xl text-center text-foreground italic">
              "You deserve this moment of peace. You deserve encouragement. You deserve a lil push."
            </p>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default About;
