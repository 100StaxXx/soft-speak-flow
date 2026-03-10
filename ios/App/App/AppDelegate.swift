import UIKit
import Capacitor
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Disable iOS "Shake to Undo" so menu screens do not surface "Undo Typing".
        application.applicationSupportsShakeToEdit = false
        logNotificationSettings(context: "didFinishLaunching")
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
        logNotificationSettings(context: "applicationDidBecomeActive")
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // MARK: - Push Notification Delegates
    
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // Forward device token to Capacitor Push Notifications plugin
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
        
        // Log for debugging
        let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
        let token = tokenParts.joined()
        print("[APNs] Successfully registered for remote notifications with token: \(token)")
        logNotificationSettings(context: "didRegisterForRemoteNotifications")
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Forward error to Capacitor Push Notifications plugin
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
        
        // Log for debugging
        print("[APNs] Failed to register for remote notifications: \(error.localizedDescription)")
    }

    private func logNotificationSettings(context: String) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            var parts: [String] = []
            parts.append("authorization=\(self.string(from: settings.authorizationStatus))")
            parts.append("alert=\(self.string(from: settings.alertSetting))")
            parts.append("badge=\(self.string(from: settings.badgeSetting))")
            parts.append("sound=\(self.string(from: settings.soundSetting))")
            parts.append("lockScreen=\(self.string(from: settings.lockScreenSetting))")
            parts.append("notificationCenter=\(self.string(from: settings.notificationCenterSetting))")
            parts.append("carPlay=\(self.string(from: settings.carPlaySetting))")
            parts.append("alertStyle=\(self.string(from: settings.alertStyle))")
            parts.append("showPreviews=\(self.string(from: settings.showPreviewsSetting))")

            if #available(iOS 14.0, *) {
                parts.append("announcement=\(self.string(from: settings.announcementSetting))")
            }
            if #available(iOS 15.0, *) {
                parts.append("scheduledDelivery=\(self.string(from: settings.scheduledDeliverySetting))")
                parts.append("timeSensitive=\(self.string(from: settings.timeSensitiveSetting))")
            }

            print("[APNs] Notification settings (\(context)): \(parts.joined(separator: ", "))")
        }
    }

    private func string(from status: UNAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "notDetermined"
        case .denied: return "denied"
        case .authorized: return "authorized"
        case .provisional: return "provisional"
        @unknown default: return "unknown"
        }
    }

    private func string(from setting: UNNotificationSetting) -> String {
        switch setting {
        case .enabled: return "enabled"
        case .disabled: return "disabled"
        case .notSupported: return "notSupported"
        @unknown default: return "unknown"
        }
    }

    private func string(from alertStyle: UNAlertStyle) -> String {
        switch alertStyle {
        case .none: return "none"
        case .banner: return "banner"
        case .alert: return "alert"
        @unknown default: return "unknown"
        }
    }

    private func string(from preview: UNShowPreviewsSetting) -> String {
        switch preview {
        case .always: return "always"
        case .whenAuthenticated: return "whenAuthenticated"
        case .never: return "never"
        @unknown default: return "unknown"
        }
    }

}

/// Bridge VC used by Main.storyboard to register local plugins at runtime.
@objc(AppBridgeViewController)
class AppBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        // Local plugins are not auto-registered from capacitor.config.json packageClassList.
        bridge?.registerPluginInstance(WidgetDataPlugin())
        bridge?.registerPluginInstance(NativeCalendarPlugin())
    }
}
