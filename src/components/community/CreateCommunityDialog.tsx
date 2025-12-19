import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCommunity } from "@/hooks/useCommunity";
import { GuildEmblem, EmblemIcon, GuildBanner, BannerStyle, GuildParticles } from "@/components/guild";
import { Loader2, Globe, Lock, ChevronRight, ChevronLeft, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateCommunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (communityId: string) => void;
}

const THEME_COLORS = [
  "#8B5CF6", // Purple
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#6366F1", // Indigo
  "#F97316", // Orange
  "#14B8A6", // Teal
];

const EMBLEM_ICONS: EmblemIcon[] = [
  'shield', 'sword', 'crown', 'star', 'flame', 'ice', 'lightning', 'moon', 'crystal', 'phoenix'
];

const BANNER_STYLES: BannerStyle[] = [
  'cosmic', 'flames', 'crystal', 'lightning', 'nature', 'void', 'aurora', 'nebula'
];

const PARTICLE_EFFECTS = [
  { id: 'stars', label: 'Stars' },
  { id: 'embers', label: 'Embers' },
  { id: 'ice', label: 'Ice' },
  { id: 'void', label: 'Void' },
  { id: 'divine', label: 'Divine' },
  { id: 'none', label: 'None' },
];

const GLOW_EFFECTS = [
  { id: 'pulse', label: 'Pulse' },
  { id: 'breathe', label: 'Breathe' },
  { id: 'shimmer', label: 'Shimmer' },
  { id: 'none', label: 'None' },
];

export const CreateCommunityDialog = ({ open, onOpenChange, onSuccess }: CreateCommunityDialogProps) => {
  const { createCommunity, isCreating } = useCommunity();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [themeColor, setThemeColor] = useState(THEME_COLORS[0]);
  const [emblemIcon, setEmblemIcon] = useState<EmblemIcon>('shield');
  const [bannerStyle, setBannerStyle] = useState<BannerStyle>('cosmic');
  const [particleEffect, setParticleEffect] = useState('stars');
  const [glowEffect, setGlowEffect] = useState('pulse');

  const handleSubmit = async () => {
    if (!name.trim()) return;

    const result = await createCommunity.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      is_public: isPublic,
      theme_color: themeColor,
      emblem_icon: emblemIcon,
      banner_style: bannerStyle,
      particle_effect: particleEffect,
      glow_effect: glowEffect,
    });

    if (result) {
      onOpenChange(false);
      onSuccess?.(result.id);
      resetForm();
    }
  };

  const resetForm = () => {
    setStep(1);
    setName("");
    setDescription("");
    setIsPublic(false);
    setThemeColor(THEME_COLORS[0]);
    setEmblemIcon('shield');
    setBannerStyle('cosmic');
    setParticleEffect('stars');
    setGlowEffect('pulse');
  };

  const canProceed = step === 1 ? name.trim().length > 0 : true;

  return (
    <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if (!val) resetForm(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 overflow-hidden">
        {/* Live Preview Header */}
        <div className="relative h-24 overflow-hidden">
          <GuildBanner style={bannerStyle} color={themeColor} className="h-full" />
          <GuildParticles effect={particleEffect} color={themeColor} intensity="medium" />
          <div className="absolute inset-0 flex items-center justify-center">
            <GuildEmblem 
              icon={emblemIcon} 
              color={themeColor} 
              size="lg" 
              glowEffect={glowEffect}
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="px-6 pb-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {step === 1 ? "Create Your Guild" : "Customize Appearance"}
            </DialogTitle>
            <DialogDescription>
              {step === 1 
                ? "Set up your guild's identity" 
                : "Make your guild stand out with custom visuals"}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicators */}
          <div className="flex gap-2 mb-6">
            {[1, 2].map((s) => (
              <div 
                key={s}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all",
                  s <= step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Guild Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Guild Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter your guild's name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={50}
                    className="text-lg"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="What's your guild about?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={200}
                    rows={3}
                  />
                </div>

                {/* Public/Private Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-3">
                    {isPublic ? (
                      <Globe className="h-5 w-5 text-primary" />
                    ) : (
                      <Lock className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">
                        {isPublic ? "Public Guild" : "Private Guild"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isPublic ? "Anyone can discover and join" : "Invite-only via code"}
                      </p>
                    </div>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <ScrollArea className="h-[320px] pr-4">
                  <div className="space-y-5">
                    {/* Theme Color */}
                    <div className="space-y-2">
                      <Label>Theme Color</Label>
                      <div className="flex flex-wrap gap-2">
                        {THEME_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setThemeColor(color)}
                            className={cn(
                              "w-9 h-9 rounded-xl transition-all relative",
                              themeColor === color 
                                ? "ring-2 ring-offset-2 ring-primary scale-110" 
                                : "hover:scale-105"
                            )}
                            style={{ backgroundColor: color }}
                          >
                            {themeColor === color && (
                              <Check className="h-4 w-4 text-white absolute inset-0 m-auto" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Emblem Icon */}
                    <div className="space-y-2">
                      <Label>Emblem Icon</Label>
                      <div className="flex flex-wrap gap-2">
                        {EMBLEM_ICONS.map((icon) => (
                          <button
                            key={icon}
                            type="button"
                            onClick={() => setEmblemIcon(icon)}
                            className={cn(
                              "transition-all",
                              emblemIcon === icon ? "scale-110" : "opacity-60 hover:opacity-100"
                            )}
                          >
                            <GuildEmblem 
                              icon={icon} 
                              color={emblemIcon === icon ? themeColor : '#666'} 
                              size="sm"
                              animated={false}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Banner Style */}
                    <div className="space-y-2">
                      <Label>Banner Style</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {BANNER_STYLES.map((style) => (
                          <button
                            key={style}
                            type="button"
                            onClick={() => setBannerStyle(style)}
                            className={cn(
                              "relative h-12 rounded-lg overflow-hidden transition-all",
                              bannerStyle === style 
                                ? "ring-2 ring-primary scale-105" 
                                : "opacity-70 hover:opacity-100"
                            )}
                          >
                            <GuildBanner style={style} color={themeColor} className="h-full" animated={false} />
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white drop-shadow-lg capitalize">
                              {style}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Particle Effect */}
                    <div className="space-y-2">
                      <Label>Particle Effect</Label>
                      <div className="flex flex-wrap gap-2">
                        {PARTICLE_EFFECTS.map((effect) => (
                          <button
                            key={effect.id}
                            type="button"
                            onClick={() => setParticleEffect(effect.id)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-sm transition-all border",
                              particleEffect === effect.id
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/50 border-border/50 hover:bg-muted"
                            )}
                          >
                            {effect.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Glow Effect */}
                    <div className="space-y-2">
                      <Label>Glow Effect</Label>
                      <div className="flex flex-wrap gap-2">
                        {GLOW_EFFECTS.map((effect) => (
                          <button
                            key={effect.id}
                            type="button"
                            onClick={() => setGlowEffect(effect.id)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-sm transition-all border",
                              glowEffect === effect.id
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/50 border-border/50 hover:bg-muted"
                            )}
                          >
                            {effect.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex gap-2 pt-4 mt-4 border-t border-border/50">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="flex-1"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            
            {step < 2 ? (
              <Button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canProceed}
                className="flex-1"
              >
                Customize
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!name.trim() || isCreating}
                className="flex-1 bg-primary shadow-lg shadow-primary/25"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Create Guild
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
