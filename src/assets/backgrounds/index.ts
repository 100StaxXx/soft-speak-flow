import cosmicPath1 from './cosmic-path-1.png';
import cosmicPath2 from './cosmic-path-2.png';
import cosmicGalaxyPortal from './cosmic-galaxy-portal.png';

export const cosmicPathBackgrounds = [
  cosmicGalaxyPortal, // Stunning cosmic portal as primary background
];

export const getRandomBackground = () => {
  const index = Math.floor(Math.random() * cosmicPathBackgrounds.length);
  return cosmicPathBackgrounds[index];
};
