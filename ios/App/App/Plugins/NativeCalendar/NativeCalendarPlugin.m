#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NativeCalendarPlugin, "NativeCalendar",
    CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestPermissions, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(listCalendars, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(createOrUpdateEvent, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(deleteEvent, CAPPluginReturnPromise);
)
