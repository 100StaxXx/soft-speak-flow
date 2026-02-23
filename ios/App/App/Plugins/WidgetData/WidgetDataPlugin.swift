import Foundation
import Capacitor
import WidgetKit

@objc(WidgetDataPlugin)
public class WidgetDataPlugin: CAPPlugin, CAPBridgedPlugin {
    
    public let identifier = "WidgetDataPlugin"
    public let jsName = "WidgetData"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateWidgetData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reloadWidget", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getWidgetSyncDiagnostics", returnType: CAPPluginReturnPromise)
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
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            call.reject("Failed to access App Group container")
            return
        }

        guard let jsonData = try? JSONSerialization.data(withJSONObject: widgetData) else {
            call.reject("Failed to serialize widget data")
            return
        }

        userDefaults.set(jsonData, forKey: dataKey)
        _ = userDefaults.synchronize()

        triggerWidgetReload(withDelay: 0.15)
        call.resolve()
    }

    @objc func reloadWidget(_ call: CAPPluginCall) {
        triggerWidgetReload(withDelay: 0.0)
        call.resolve()
    }

    @objc func getWidgetSyncDiagnostics(_ call: CAPPluginCall) {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            call.resolve([
                "appGroupAccessible": false,
                "hasPayload": false,
                "payloadDate": NSNull(),
                "payloadUpdatedAt": NSNull(),
                "payloadByteCount": 0
            ])
            return
        }

        var payloadData = userDefaults.data(forKey: dataKey)

        if payloadData == nil,
           let jsonString = userDefaults.string(forKey: dataKey) {
            payloadData = jsonString.data(using: .utf8)
        }

        let hasPayload = payloadData != nil
        let payloadByteCount = payloadData?.count ?? 0
        let payloadObject = payloadData
            .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }

        call.resolve([
            "appGroupAccessible": true,
            "hasPayload": hasPayload,
            "payloadDate": payloadObject?["date"] as? String ?? NSNull(),
            "payloadUpdatedAt": payloadObject?["updatedAt"] as? String ?? NSNull(),
            "payloadByteCount": payloadByteCount
        ])
    }

    private func triggerWidgetReload(withDelay delay: TimeInterval) {
        guard #available(iOS 14.0, *) else {
            return
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            WidgetCenter.shared.reloadTimelines(ofKind: "CosmiqWidget")
            WidgetCenter.shared.reloadAllTimelines()
        }
    }
}
