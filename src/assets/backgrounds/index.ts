import cosmicPath1 from './cosmic-path-1.png';
import cosmicPath1_2x from './cosmic-path-1@2x.png';
import cosmicPath2 from './cosmic-path-2.png';
import cosmicPath2_2x from './cosmic-path-2@2x.png';
import cosmicGalaxyPortal from './cosmic-galaxy-portal.png';
import cosmicGalaxyPortal_2x from './cosmic-galaxy-portal@2x.png';
import cosmicWelcome from './cosmic-welcome.png';
import cosmicWelcome_2x from './cosmic-welcome@2x.png';
import cosmicSignin from './cosmic-signin.png';
import cosmicSignin_2x from './cosmic-signin@2x.png';

export interface StaticBackgroundAsset {
  src: string;
  src2x: string;
}

export type CinematicPageBackgroundKey =
  | "quests"
  | "campaigns"
  | "companion"
  | "profile";

export interface CinematicPageBackgroundPreset {
  background: StaticBackgroundAsset;
  mobileObjectPosition: string;
  desktopObjectPosition: string;
  overlayStrength: number;
  showCosmicOverlay: boolean;
}

const createBackgroundAsset = (src: string, src2x: string): StaticBackgroundAsset => ({
  src,
  src2x,
});

const cosmicPath1Asset = createBackgroundAsset(cosmicPath1, cosmicPath1_2x);
const cosmicPath2Asset = createBackgroundAsset(cosmicPath2, cosmicPath2_2x);
const cosmicGalaxyPortalAsset = createBackgroundAsset(cosmicGalaxyPortal, cosmicGalaxyPortal_2x);

// Specific backgrounds for key screens
export const welcomeBackground = createBackgroundAsset(cosmicWelcome, cosmicWelcome_2x);
export const signinBackground = createBackgroundAsset(cosmicSignin, cosmicSignin_2x);

export const cinematicPageBackgrounds: Record<CinematicPageBackgroundKey, CinematicPageBackgroundPreset> = {
  quests: {
    background: cosmicPath1Asset,
    mobileObjectPosition: "52% 34%",
    desktopObjectPosition: "50% 42%",
    overlayStrength: 0.62,
    showCosmicOverlay: true,
  },
  campaigns: {
    background: cosmicGalaxyPortalAsset,
    mobileObjectPosition: "50% 38%",
    desktopObjectPosition: "50% 46%",
    overlayStrength: 0.68,
    showCosmicOverlay: true,
  },
  companion: {
    background: welcomeBackground,
    mobileObjectPosition: "52% 24%",
    desktopObjectPosition: "50% 30%",
    overlayStrength: 0.72,
    showCosmicOverlay: true,
  },
  profile: {
    background: cosmicPath2Asset,
    mobileObjectPosition: "50% 42%",
    desktopObjectPosition: "50% 46%",
    overlayStrength: 0.7,
    showCosmicOverlay: false,
  },
};

// Legacy backgrounds for other uses
export const cosmicPathBackgrounds = [
  cosmicGalaxyPortalAsset,
  cosmicPath1Asset,
  cosmicPath2Asset,
];

export const getRandomBackground = () => {
  const index = Math.floor(Math.random() * cosmicPathBackgrounds.length);
  return cosmicPathBackgrounds[index].src;
};

export const getStaticBackgroundSrcSet = (background: StaticBackgroundAsset) =>
  `${background.src} 1x, ${background.src2x} 2x`;
