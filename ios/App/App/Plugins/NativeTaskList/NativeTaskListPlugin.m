#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NativeTaskListPlugin, "NativeTaskList",
    CAP_PLUGIN_METHOD(showTaskList, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(updateTasks, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(hideTaskList, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
)
