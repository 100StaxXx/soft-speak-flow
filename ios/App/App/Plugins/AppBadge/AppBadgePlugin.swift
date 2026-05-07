import Foundation
import Capacitor
import UIKit
import UserNotifications

@objc(AppBadgePlugin)
public class AppBadgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppBadgePlugin"
    public let jsName = "AppBadge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setBadgeCount", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearBadge", returnType: CAPPluginReturnPromise)
    ]

    @objc func setBadgeCount(_ call: CAPPluginCall) {
        let count = max(0, call.getInt("count") ?? 0)
        setApplicationBadgeCount(count) { error in
            if let error = error {
                call.reject("Failed to set app badge count: \(error.localizedDescription)")
                return
            }

            call.resolve()
        }
    }

    @objc func clearBadge(_ call: CAPPluginCall) {
        setApplicationBadgeCount(0) { error in
            if let error = error {
                call.reject("Failed to clear app badge: \(error.localizedDescription)")
                return
            }

            call.resolve()
        }
    }

    private func setApplicationBadgeCount(_ count: Int, completion: @escaping (Error?) -> Void) {
        DispatchQueue.main.async {
            if #available(iOS 16.0, *) {
                UNUserNotificationCenter.current().setBadgeCount(count) { error in
                    completion(error)
                }
            } else {
                UIApplication.shared.applicationIconBadgeNumber = count
                completion(nil)
            }
        }
    }
}
