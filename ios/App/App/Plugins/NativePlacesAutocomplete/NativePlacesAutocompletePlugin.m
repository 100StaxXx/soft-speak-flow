#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NativePlacesAutocompletePlugin, "NativePlacesAutocomplete",
    CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(beginSession, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(fetchSuggestions, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(resolveSuggestion, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(endSession, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getOpenSourceLicenseInfo, CAPPluginReturnPromise);
)
