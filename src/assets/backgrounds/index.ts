import cosmicPath1 from './cosmic-path-1.png';
import cosmicPath2 from './cosmic-path-2.png';
import cosmicGalaxyPortal from './cosmic-galaxy-portal.png';
import cosmicWelcome from './cosmic-welcome.png';
import cosmicSignin from './cosmic-signin.png';

// Specific backgrounds for key screens
export const welcomeBackground = cosmicWelcome;
export const signinBackground = cosmicSignin;

// Legacy backgrounds for other uses
export const cosmicPathBackgrounds = [
  cosmicGalaxyPortal,
];

export const getRandomBackground = () => {
  const index = Math.floor(Math.random() * cosmicPathBackgrounds.length);
  return cosmicPathBackgrounds[index];
};
