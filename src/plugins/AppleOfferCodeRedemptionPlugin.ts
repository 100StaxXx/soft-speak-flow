import { registerPlugin, WebPlugin } from "@capacitor/core";

export interface AppleOfferCodeRedemptionPlugin {
  openRedemptionUrl(options: { url: string }): Promise<{ opened: boolean }>;
}

class AppleOfferCodeRedemptionWeb
  extends WebPlugin
  implements AppleOfferCodeRedemptionPlugin {
  async openRedemptionUrl(options: { url: string }): Promise<{ opened: boolean }> {
    window.location.href = options.url;
    return { opened: true };
  }
}

export const AppleOfferCodeRedemption = registerPlugin<AppleOfferCodeRedemptionPlugin>(
  "AppleOfferCodeRedemption",
  {
    web: () => new AppleOfferCodeRedemptionWeb(),
  },
);
