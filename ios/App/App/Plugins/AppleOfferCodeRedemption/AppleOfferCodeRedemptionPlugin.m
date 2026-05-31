#import <Capacitor/Capacitor.h>

CAP_PLUGIN(AppleOfferCodeRedemptionPlugin, "AppleOfferCodeRedemption",
    CAP_PLUGIN_METHOD(openRedemptionUrl, CAPPluginReturnPromise);
)
