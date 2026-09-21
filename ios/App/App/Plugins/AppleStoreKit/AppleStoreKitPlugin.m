#import <Capacitor/Capacitor.h>

CAP_PLUGIN(AppleStoreKitPlugin, "AppleStoreKit",
    CAP_PLUGIN_METHOD(loadProducts, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(purchase, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(currentEntitlements, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(restorePurchases, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(presentCodeRedemptionSheet, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(manageSubscriptions, CAPPluginReturnPromise);
)
