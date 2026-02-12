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
