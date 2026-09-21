#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NativeCalendarPlugin, "NativeCalendar",
    CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestPermissions, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(listCalendars, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(listEvents, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getEvent, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestReminderPermissions, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(listReminderLists, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(listReminders, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getReminder, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(updateReminder, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(findOrCreateReminder, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(createOrUpdateEvent, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(deleteEvent, CAPPluginReturnPromise);
)
