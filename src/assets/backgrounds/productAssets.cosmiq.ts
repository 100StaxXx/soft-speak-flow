import cosmicWelcome from "./cosmic-welcome.png";
import cosmicWelcome2x from "./cosmic-welcome@2x.png";
import cosmicGalaxyPortal from "./cosmic-galaxy-portal.png";
import cosmicGalaxyPortal2x from "./cosmic-galaxy-portal@2x.png";
import cosmicPath1 from "./cosmic-path-1.png";
import cosmicPath12x from "./cosmic-path-1@2x.png";
import cosmicPath2 from "./cosmic-path-2.png";
import cosmicPath22x from "./cosmic-path-2@2x.png";
import cosmicSignin from "./cosmic-signin.png";
import cosmicSignin2x from "./cosmic-signin@2x.png";
import wallpaperQuestsSeed from "./wallpaper-quests-seed.webp";
import wallpaperQuestsSeed2x from "./wallpaper-quests-seed@2x.webp";
import wallpaperCampaignsSeed from "./wallpaper-campaigns-seed.jpg";
import wallpaperCampaignsSeed2x from "./wallpaper-campaigns-seed@2x.jpg";

const asset = (src: string, src2x = src) => ({ src, src2x });

const welcome = asset(cosmicWelcome, cosmicWelcome2x);
const galaxyPortal = asset(cosmicGalaxyPortal, cosmicGalaxyPortal2x);
const path1 = asset(cosmicPath1, cosmicPath12x);
const path2 = asset(cosmicPath2, cosmicPath22x);
const signin = asset(cosmicSignin, cosmicSignin2x);
const questsSeed = asset(wallpaperQuestsSeed, wallpaperQuestsSeed2x);
const campaignsSeed = asset(wallpaperCampaignsSeed, wallpaperCampaignsSeed2x);

export const productBackgroundAssets = {
  product: "cosmiq" as const,
  welcome,
  galaxyPortal,
  path1,
  path2,
  signin,
  questsSeed,
  campaignsSeed,
  starPathPlaceholders: [questsSeed, campaignsSeed],
  cinematicFallbacks: {
    guide: galaxyPortal,
    quests: questsSeed,
    campaigns: campaignsSeed,
    companion: welcome,
    profile: signin,
  },
  legacy: [galaxyPortal, path1, path2, questsSeed, campaignsSeed, welcome, signin],
};
