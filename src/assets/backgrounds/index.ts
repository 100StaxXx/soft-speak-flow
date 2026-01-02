import cosmicPath1 from './cosmic-path-1.png';
import cosmicPath2 from './cosmic-path-2.png';

export const cosmicPathBackgrounds = [
  cosmicPath1,
  cosmicPath2,
];

export const getRandomBackground = () => {
  const index = Math.floor(Math.random() * cosmicPathBackgrounds.length);
  return cosmicPathBackgrounds[index];
};
