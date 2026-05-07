#import <Capacitor/Capacitor.h>

CAP_PLUGIN(AppBadgePlugin, "AppBadge",
    CAP_PLUGIN_METHOD(setBadgeCount, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(clearBadge, CAPPluginReturnPromise);
)
