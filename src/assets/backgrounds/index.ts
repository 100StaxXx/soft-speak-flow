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

export interface CinematicPageBackgroundPreset {
  background: StaticBackgroundAsset;
  mobileObjectPosition: string;
  desktopObjectPosition: string;
  overlayStrength: number;
  showCosmicOverlay: boolean;
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
  quests: {
    background: questsSeedBackground,
    mobileObjectPosition: `${wallpaperGenerationSpecs.quests.mobileFocus.x}% ${wallpaperGenerationSpecs.quests.mobileFocus.y}%`,
    desktopObjectPosition: `${wallpaperGenerationSpecs.quests.desktopFocus.x}% ${wallpaperGenerationSpecs.quests.desktopFocus.y}%`,
    overlayStrength: wallpaperGenerationSpecs.quests.overlayStrength,
    showCosmicOverlay: wallpaperGenerationSpecs.quests.showCosmicOverlay,
  },
  campaigns: {
    background: campaignsSeedBackground,
    mobileObjectPosition: `${wallpaperGenerationSpecs.campaigns.mobileFocus.x}% ${wallpaperGenerationSpecs.campaigns.mobileFocus.y}%`,
    desktopObjectPosition: `${wallpaperGenerationSpecs.campaigns.desktopFocus.x}% ${wallpaperGenerationSpecs.campaigns.desktopFocus.y}%`,
    overlayStrength: wallpaperGenerationSpecs.campaigns.overlayStrength,
    showCosmicOverlay: wallpaperGenerationSpecs.campaigns.showCosmicOverlay,
  },
  companion: {
    background: signinBackground,
    mobileObjectPosition: `${wallpaperGenerationSpecs.companion.mobileFocus.x}% ${wallpaperGenerationSpecs.companion.mobileFocus.y}%`,
    desktopObjectPosition: `${wallpaperGenerationSpecs.companion.desktopFocus.x}% ${wallpaperGenerationSpecs.companion.desktopFocus.y}%`,
    overlayStrength: wallpaperGenerationSpecs.companion.overlayStrength,
    showCosmicOverlay: wallpaperGenerationSpecs.companion.showCosmicOverlay,
  },
  profile: {
    background: welcomeBackground,
    mobileObjectPosition: `${wallpaperGenerationSpecs.profile.mobileFocus.x}% ${wallpaperGenerationSpecs.profile.mobileFocus.y}%`,
    desktopObjectPosition: `${wallpaperGenerationSpecs.profile.desktopFocus.x}% ${wallpaperGenerationSpecs.profile.desktopFocus.y}%`,
    overlayStrength: wallpaperGenerationSpecs.profile.overlayStrength,
    showCosmicOverlay: wallpaperGenerationSpecs.profile.showCosmicOverlay,
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
