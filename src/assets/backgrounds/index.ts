import cosmicWelcome from "./cosmic-welcome.png";
import cosmicWelcome_2x from "./cosmic-welcome@2x.png";
import cosmicSignin from "./cosmic-signin.png";
import cosmicSignin_2x from "./cosmic-signin@2x.png";
import wallpaperQuestsSeed from "./wallpaper-quests-seed.webp";
import wallpaperQuestsSeed_2x from "./wallpaper-quests-seed@2x.webp";
import wallpaperCampaignsSeed from "./wallpaper-campaigns-seed.jpg";
import wallpaperCampaignsSeed_2x from "./wallpaper-campaigns-seed@2x.jpg";
import {
  wallpaperGenerationSpecs,
  type WallpaperPageKey,
} from "@/shared/wallpaperCatalog";

export interface StaticBackgroundAsset {
  src: string;
  src2x: string;
}

export type CinematicPageBackgroundKey = WallpaperPageKey;

export interface CinematicBackgroundScrim {
  topGradientTopAlpha: number;
  topGradientMiddleAlpha: number;
  topGradientBottomAlpha: number;
  centerAnchor: string;
  centerClearStop: number;
  centerMidStop: number;
  centerMidAlpha: number;
  centerEdgeAlpha: number;
  bottomFadeStart: number;
  bottomFadeEndAlpha: number;
  cosmicGlowOpacity: number;
}

export interface CinematicPageBackgroundPreset {
  background: StaticBackgroundAsset;
  mobileObjectPosition: string;
  desktopObjectPosition: string;
  showCosmicOverlay: boolean;
  scrim: CinematicBackgroundScrim;
}

export const createBackgroundAsset = (src: string, src2x = src): StaticBackgroundAsset => ({
  src,
  src2x,
});

export const createRemoteBackgroundAsset = (src: string): StaticBackgroundAsset => createBackgroundAsset(src, src);

export const welcomeBackground = createBackgroundAsset(cosmicWelcome, cosmicWelcome_2x);
export const signinBackground = createBackgroundAsset(cosmicSignin, cosmicSignin_2x);
export const questsSeedBackground = createBackgroundAsset(wallpaperQuestsSeed, wallpaperQuestsSeed_2x);
export const campaignsSeedBackground = createBackgroundAsset(wallpaperCampaignsSeed, wallpaperCampaignsSeed_2x);

export const cinematicPageBackgrounds: Record<CinematicPageBackgroundKey, CinematicPageBackgroundPreset> = {
  guide: {
    background: welcomeBackground,
    mobileObjectPosition: `${wallpaperGenerationSpecs.guide.mobileFocus.x}% ${wallpaperGenerationSpecs.guide.mobileFocus.y}%`,
    desktopObjectPosition: `${wallpaperGenerationSpecs.guide.desktopFocus.x}% ${wallpaperGenerationSpecs.guide.desktopFocus.y}%`,
    showCosmicOverlay: true,
    scrim: {
      topGradientTopAlpha: 0.5,
      topGradientMiddleAlpha: 0.16,
      topGradientBottomAlpha: 0.62,
      centerAnchor: "50% 30%",
      centerClearStop: 38,
      centerMidStop: 74,
      centerMidAlpha: 0.12,
      centerEdgeAlpha: 0.34,
      bottomFadeStart: 78,
      bottomFadeEndAlpha: 0.52,
      cosmicGlowOpacity: 0.11,
    },
  },
  quests: {
    background: questsSeedBackground,
    mobileObjectPosition: `${wallpaperGenerationSpecs.quests.mobileFocus.x}% ${wallpaperGenerationSpecs.quests.mobileFocus.y}%`,
    desktopObjectPosition: `${wallpaperGenerationSpecs.quests.desktopFocus.x}% ${wallpaperGenerationSpecs.quests.desktopFocus.y}%`,
    showCosmicOverlay: true,
    scrim: {
      topGradientTopAlpha: 0.58,
      topGradientMiddleAlpha: 0.2,
      topGradientBottomAlpha: 0.76,
      centerAnchor: "50% 36%",
      centerClearStop: 30,
      centerMidStop: 74,
      centerMidAlpha: 0.24,
      centerEdgeAlpha: 0.46,
      bottomFadeStart: 72,
      bottomFadeEndAlpha: 0.68,
      cosmicGlowOpacity: 0.16,
    },
  },
  campaigns: {
    background: campaignsSeedBackground,
    mobileObjectPosition: `${wallpaperGenerationSpecs.campaigns.mobileFocus.x}% ${wallpaperGenerationSpecs.campaigns.mobileFocus.y}%`,
    desktopObjectPosition: `${wallpaperGenerationSpecs.campaigns.desktopFocus.x}% ${wallpaperGenerationSpecs.campaigns.desktopFocus.y}%`,
    showCosmicOverlay: true,
    scrim: {
      topGradientTopAlpha: 0.64,
      topGradientMiddleAlpha: 0.24,
      topGradientBottomAlpha: 0.82,
      centerAnchor: "50% 34%",
      centerClearStop: 28,
      centerMidStop: 74,
      centerMidAlpha: 0.28,
      centerEdgeAlpha: 0.52,
      bottomFadeStart: 68,
      bottomFadeEndAlpha: 0.76,
      cosmicGlowOpacity: 0.15,
    },
  },
  companion: {
    background: signinBackground,
    mobileObjectPosition: `${wallpaperGenerationSpecs.companion.mobileFocus.x}% ${wallpaperGenerationSpecs.companion.mobileFocus.y}%`,
    desktopObjectPosition: `${wallpaperGenerationSpecs.companion.desktopFocus.x}% ${wallpaperGenerationSpecs.companion.desktopFocus.y}%`,
    showCosmicOverlay: true,
    scrim: {
      topGradientTopAlpha: 0.42,
      topGradientMiddleAlpha: 0.12,
      topGradientBottomAlpha: 0.56,
      centerAnchor: "50% 26%",
      centerClearStop: 44,
      centerMidStop: 80,
      centerMidAlpha: 0.1,
      centerEdgeAlpha: 0.24,
      bottomFadeStart: 82,
      bottomFadeEndAlpha: 0.42,
      cosmicGlowOpacity: 0.08,
    },
  },
  profile: {
    background: welcomeBackground,
    mobileObjectPosition: `${wallpaperGenerationSpecs.profile.mobileFocus.x}% ${wallpaperGenerationSpecs.profile.mobileFocus.y}%`,
    desktopObjectPosition: `${wallpaperGenerationSpecs.profile.desktopFocus.x}% ${wallpaperGenerationSpecs.profile.desktopFocus.y}%`,
    showCosmicOverlay: false,
    scrim: {
      topGradientTopAlpha: 0.54,
      topGradientMiddleAlpha: 0.16,
      topGradientBottomAlpha: 0.68,
      centerAnchor: "50% 34%",
      centerClearStop: 36,
      centerMidStop: 76,
      centerMidAlpha: 0.18,
      centerEdgeAlpha: 0.4,
      bottomFadeStart: 76,
      bottomFadeEndAlpha: 0.56,
      cosmicGlowOpacity: 0.06,
    },
  },
};

// Legacy scenic fallbacks for other surfaces that still want bundled atmosphere.
export const cosmicPathBackgrounds = [
  questsSeedBackground,
  campaignsSeedBackground,
  welcomeBackground,
  signinBackground,
];

export const getRandomBackground = () => {
  const index = Math.floor(Math.random() * cosmicPathBackgrounds.length);
  return cosmicPathBackgrounds[index].src;
};

export const getStaticBackgroundSrcSet = (background: StaticBackgroundAsset) =>
  `${background.src} 1x, ${background.src2x} 2x`;
