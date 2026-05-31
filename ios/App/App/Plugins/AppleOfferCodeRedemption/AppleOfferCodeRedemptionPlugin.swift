import Foundation
import Capacitor
import UIKit

@objc(AppleOfferCodeRedemptionPlugin)
public class AppleOfferCodeRedemptionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleOfferCodeRedemptionPlugin"
    public let jsName = "AppleOfferCodeRedemption"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openRedemptionUrl", returnType: CAPPluginReturnPromise)
    ]

    @objc func openRedemptionUrl(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let url = URL(string: urlString),
              let scheme = url.scheme?.lowercased(),
              scheme == "https" || scheme == "itms-apps",
              url.host?.lowercased() == "apps.apple.com" else {
            call.reject("Invalid Apple redemption URL.")
            return
        }

        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened {
                    call.resolve(["opened": true])
                } else {
                    call.reject("iOS could not open Apple redemption. Try the link in Safari or the App Store.")
                }
            }
        }
    }
}
