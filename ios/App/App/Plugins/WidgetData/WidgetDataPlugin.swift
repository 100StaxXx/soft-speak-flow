import Foundation
import Capacitor
import WidgetKit

@objc(WidgetDataPlugin)
public class WidgetDataPlugin: CAPPlugin, CAPBridgedPlugin {
    
    public let identifier = "WidgetDataPlugin"
    public let jsName = "WidgetData"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateWidgetData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reloadWidget", returnType: CAPPluginReturnPromise)
    ]
    
    private let appGroupId = "group.com.darrylgraham.revolution"
    private let dataKey = "widget_tasks_data"
    
    @objc func updateWidgetData(_ call: CAPPluginCall) {
        guard let tasksArray = call.getArray("tasks") as? [[String: Any]],
              let completedCount = call.getInt("completedCount"),
              let totalCount = call.getInt("totalCount"),
              let date = call.getString("date") else {
            call.reject("Missing required parameters")
            return
        }
        
        // Get ritual counts (default to 0 if not provided)
        let ritualCount = call.getInt("ritualCount") ?? 0
        let ritualCompleted = call.getInt("ritualCompleted") ?? 0
        
        let widgetData: [String: Any] = [
            "tasks": tasksArray,
            "completedCount": completedCount,
            "totalCount": totalCount,
            "ritualCount": ritualCount,
            "ritualCompleted": ritualCompleted,
            "date": date,
            "updatedAt": ISO8601DateFormatter().string(from: Date())
        ]
        
        // Write to App Group shared container
        if let userDefaults = UserDefaults(suiteName: appGroupId) {
            if let jsonData = try? JSONSerialization.data(withJSONObject: widgetData),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                userDefaults.set(jsonString, forKey: dataKey)
                userDefaults.synchronize()
                
                // Trigger widget reload on iOS 14+
                if #available(iOS 14.0, *) {
                    WidgetCenter.shared.reloadTimelines(ofKind: "CosmiqWidget")
                }
                
                call.resolve()
            } else {
                call.reject("Failed to serialize widget data")
            }
        } else {
            call.reject("Failed to access App Group container")
        }
    }
    
    @objc func reloadWidget(_ call: CAPPluginCall) {
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}
