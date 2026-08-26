import { productBackgroundAssets } from "@/assets/backgrounds/productAssets";
import {
  wallpaperGenerationSpecs,
  type WallpaperPageKey,
} from "@/shared/wallpaperCatalog";

export interface StaticBackgroundAsset {
  src: string;
  src2x: string;
}

export type CinematicPageBackgroundKey = Exclude<WallpaperPageKey, "pep_talk">;

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
  fallbackBackground?: StaticBackgroundAsset;
  mobileObjectPosition: string;
  desktopObjectPosition: string;
  loadingGradient: string;
  showCosmicOverlay: boolean;
  scrim: CinematicBackgroundScrim;
}

export const createBackgroundAsset = (src: string, src2x = src): StaticBackgroundAsset => ({
  src,
  src2x,
});

export const createRemoteBackgroundAsset = (src: string): StaticBackgroundAsset => createBackgroundAsset(src, src);

export const welcomeBackground = productBackgroundAssets.welcome;
export const galaxyPortalBackground = productBackgroundAssets.galaxyPortal;
export const cosmicPath1Background = productBackgroundAssets.path1;
export const cosmicPath2Background = productBackgroundAssets.path2;
export const signinBackground = productBackgroundAssets.signin;
export const questsSeedBackground = productBackgroundAssets.questsSeed;
export const campaignsSeedBackground = productBackgroundAssets.campaignsSeed;
export const starPathPlaceholderBackgrounds = productBackgroundAssets.starPathPlaceholders;
const isCosmiqBackgroundFamily = productBackgroundAssets.product === "cosmiq";

export const cinematicPageBackgrounds: Record<CinematicPageBackgroundKey, CinematicPageBackgroundPreset> = {
  guide: {
    fallbackBackground: productBackgroundAssets.cinematicFallbacks.guide,
    mobileObjectPosition: `${wallpaperGenerationSpecs.guide.mobileFocus.x}% ${wallpaperGenerationSpecs.guide.mobileFocus.y}%`,
    desktopObjectPosition: `${wallpaperGenerationSpecs.guide.desktopFocus.x}% ${wallpaperGenerationSpecs.guide.desktopFocus.y}%`,
    loadingGradient: "radial-gradient(circle at 50% 18%, rgba(255, 255, 255, 0.08), transparent 34%), linear-gradient(180deg, rgba(9, 20, 36, 0.18), rgba(5, 12, 24, 0.08))",
    showCosmicOverlay: isCosmiqBackgroundFamily,
    scrim: {
      topGradientTopAlpha: 0.22,
      topGradientMiddleAlpha: 0.06,
      topGradientBottomAlpha: 0.28,
      centerAnchor: "50% 30%",
      centerClearStop: 46,
      centerMidStop: 78,
      centerMidAlpha: 0.06,
      centerEdgeAlpha: 0.16,
      bottomFadeStart: 84,
      bottomFadeEndAlpha: 0.22,
      cosmicGlowOpacity: 0.05,
    },
  },
  quests: {
    fallbackBackground: productBackgroundAssets.cinematicFallbacks.quests,
    mobileObjectPosition: `${wallpaperGenerationSpecs.quests.mobileFocus.x}% ${wallpaperGenerationSpecs.quests.mobileFocus.y}%`,
    desktopObjectPosition: `${wallpaperGenerationSpecs.quests.desktopFocus.x}% ${wallpaperGenerationSpecs.quests.desktopFocus.y}%`,
    loadingGradient: "radial-gradient(circle at 48% 24%, rgba(58, 120, 130, 0.22), transparent 32%), linear-gradient(180deg, rgba(20, 29, 42, 0.98), rgba(11, 16, 26, 0.96))",
    showCosmicOverlay: isCosmiqBackgroundFamily,
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
    fallbackBackground: productBackgroundAssets.cinematicFallbacks.campaigns,
    mobileObjectPosition: `${wallpaperGenerationSpecs.campaigns.mobileFocus.x}% ${wallpaperGenerationSpecs.campaigns.mobileFocus.y}%`,
    desktopObjectPosition: `${wallpaperGenerationSpecs.campaigns.desktopFocus.x}% ${wallpaperGenerationSpecs.campaigns.desktopFocus.y}%`,
    loadingGradient: "radial-gradient(circle at 52% 20%, rgba(104, 153, 177, 0.18), transparent 30%), linear-gradient(180deg, rgba(13, 25, 39, 0.985), rgba(7, 13, 24, 0.97))",
    showCosmicOverlay: isCosmiqBackgroundFamily,
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
    fallbackBackground: productBackgroundAssets.cinematicFallbacks.companion,
    mobileObjectPosition: `${wallpaperGenerationSpecs.companion.mobileFocus.x}% ${wallpaperGenerationSpecs.companion.mobileFocus.y}%`,
    desktopObjectPosition: `${wallpaperGenerationSpecs.companion.desktopFocus.x}% ${wallpaperGenerationSpecs.companion.desktopFocus.y}%`,
    loadingGradient: "radial-gradient(circle at 50% 22%, rgba(76, 170, 175, 0.22), transparent 34%), linear-gradient(180deg, rgba(12, 24, 37, 0.985), rgba(7, 14, 24, 0.965))",
    showCosmicOverlay: isCosmiqBackgroundFamily,
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
    fallbackBackground: productBackgroundAssets.cinematicFallbacks.profile,
    mobileObjectPosition: `${wallpaperGenerationSpecs.profile.mobileFocus.x}% ${wallpaperGenerationSpecs.profile.mobileFocus.y}%`,
    desktopObjectPosition: `${wallpaperGenerationSpecs.profile.desktopFocus.x}% ${wallpaperGenerationSpecs.profile.desktopFocus.y}%`,
    loadingGradient: "radial-gradient(circle at 50% 20%, rgba(138, 166, 182, 0.14), transparent 28%), linear-gradient(180deg, rgba(16, 22, 31, 0.985), rgba(10, 14, 20, 0.965))",
    showCosmicOverlay: isCosmiqBackgroundFamily,
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
export const cosmicPathBackgrounds = productBackgroundAssets.legacy;

export const getRandomBackground = () => {
  const index = Math.floor(Math.random() * cosmicPathBackgrounds.length);
  return cosmicPathBackgrounds[index].src;
};

export const getStaticBackgroundSrcSet = (background: StaticBackgroundAsset) =>
  `${background.src} 1x, ${background.src2x} 2x`;
