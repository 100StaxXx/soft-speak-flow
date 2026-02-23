#import <Capacitor/Capacitor.h>

CAP_PLUGIN(WidgetDataPlugin, "WidgetData",
    CAP_PLUGIN_METHOD(updateWidgetData, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(reloadWidget, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getWidgetSyncDiagnostics, CAPPluginReturnPromise);
)
