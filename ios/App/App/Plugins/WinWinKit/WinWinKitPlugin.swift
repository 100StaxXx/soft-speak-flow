import Foundation
import Capacitor
import WinWinKit

@objc(WinWinKitPlugin)
public class WinWinKitPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "WinWinKitPlugin"
    public let jsName = "WinWinKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAppUserId", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setFirstSeenAt", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setIsPremium", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getUser", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "claimCode", returnType: CAPPluginReturnPromise),
    ]

    private lazy var iso8601Formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private var didConfigure = false

    @objc func configure(_ call: CAPPluginCall) {
        do {
            Referrals.configure(apiKey: try apiKey())
            didConfigure = true
            call.resolve(["configured": true])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func setAppUserId(_ call: CAPPluginCall) {
        guard let appUserId = call.getString("appUserId")?.trimmingCharacters(in: .whitespacesAndNewlines), !appUserId.isEmpty else {
            call.reject("appUserId is required")
            return
        }

        do {
            try ensureConfigured()
            Referrals.shared.set(appUserId: appUserId)
            call.resolve(["user": serializeUser(Referrals.shared.user) ?? NSNull()])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func setFirstSeenAt(_ call: CAPPluginCall) {
        guard let isoDate = call.getString("isoDate"), let firstSeenAt = parseDate(isoDate) else {
            call.reject("isoDate is required")
            return
        }

        do {
            try ensureConfigured()
            Referrals.shared.set(firstSeenAt: firstSeenAt)
            call.resolve(["user": serializeUser(Referrals.shared.user) ?? NSNull()])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func setIsPremium(_ call: CAPPluginCall) {
        guard let isPremium = call.getBool("isPremium") else {
            call.reject("isPremium is required")
            return
        }

        do {
            try ensureConfigured()
            Referrals.shared.set(isPremium: isPremium)
            call.resolve(["user": serializeUser(Referrals.shared.user) ?? NSNull()])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func getUser(_ call: CAPPluginCall) {
        do {
            try ensureConfigured()
            call.resolve(["user": serializeUser(Referrals.shared.user) ?? NSNull()])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func claimCode(_ call: CAPPluginCall) {
        guard let code = call.getString("code")?.trimmingCharacters(in: .whitespacesAndNewlines), !code.isEmpty else {
            call.reject("code is required")
            return
        }

        do {
            try ensureConfigured()
        } catch {
            call.reject(error.localizedDescription)
            return
        }

        Task {
            do {
                let (user, rewardsGranted) = try await Referrals.shared.claimCode(code: code)
                call.resolve([
                    "user": self.serializeUser(user) ?? NSNull(),
                    "rewardsGranted": rewardsGranted,
                ])
            } catch {
                call.reject("Failed to claim code: \(error.localizedDescription)")
            }
        }
    }

    private func apiKey() throws -> String {
        guard let rawValue = Bundle.main.object(forInfoDictionaryKey: "WinWinKitAPIKey") as? String else {
            throw NSError(domain: "WinWinKitPlugin", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Missing WinWinKitAPIKey in Info.plist",
            ])
        }

        let key = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if key.isEmpty || key == "$(WINWINKIT_IOS_API_KEY)" {
            throw NSError(domain: "WinWinKitPlugin", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "WinWinKitAPIKey is not configured for this build",
            ])
        }

        return key
    }

    private func ensureConfigured() throws {
        if didConfigure {
            return
        }

        Referrals.configure(apiKey: try apiKey())
        didConfigure = true
    }

    private func parseDate(_ rawValue: String) -> Date? {
        if let date = iso8601Formatter.date(from: rawValue) {
            return date
        }

        let fallback = ISO8601DateFormatter()
        fallback.formatOptions = [.withInternetDateTime]
        return fallback.date(from: rawValue)
    }

    private func serializeUser(_ user: Any?) -> [String: Any]? {
        guard let user else {
            return nil
        }

        let mirror = Mirror(reflecting: user)
        let appUserId = stringProperty("appUserId", in: mirror) ?? stringProperty("app_user_id", in: mirror)
        let referralCode = stringProperty("referralCode", in: mirror) ?? stringProperty("referral_code", in: mirror)
        let isPremium = boolProperty("isPremium", in: mirror) ?? boolProperty("is_premium", in: mirror) ?? false
        let metadata = dictionaryProperty("metadata", in: mirror) ?? [:]
        let stats = dictionaryProperty("stats", in: mirror)

        var payload: [String: Any] = [
            "appUserId": appUserId as Any,
            "referralCode": referralCode as Any,
            "isPremium": isPremium,
            "metadata": metadata,
            "stats": stats as Any,
        ]

        if let referredBy = nestedCodeReference(labels: ["referredBy", "referred_by"], in: mirror) {
            payload["referredBy"] = referredBy
        } else {
            payload["referredBy"] = NSNull()
        }

        return payload
    }

    private func stringProperty(_ label: String, in mirror: Mirror) -> String? {
        for child in mirror.children where child.label == label {
            return unwrap(child.value) as? String
        }
        return nil
    }

    private func boolProperty(_ label: String, in mirror: Mirror) -> Bool? {
        for child in mirror.children where child.label == label {
            return unwrap(child.value) as? Bool
        }
        return nil
    }

    private func dictionaryProperty(_ label: String, in mirror: Mirror) -> [String: Any]? {
        for child in mirror.children where child.label == label {
            return dictionaryValue(from: child.value)
        }
        return nil
    }

    private func nestedCodeReference(labels: [String], in mirror: Mirror) -> [String: Any]? {
        for child in mirror.children {
            guard let label = child.label, labels.contains(label) else {
                continue
            }

            let nestedValue = unwrap(child.value)
            let nestedMirror = Mirror(reflecting: nestedValue as Any)
            let code = stringProperty("code", in: nestedMirror)
            let type = stringProperty("type", in: nestedMirror)
            return [
                "code": code as Any,
                "type": type as Any,
            ]
        }
        return nil
    }

    private func dictionaryValue(from value: Any) -> [String: Any]? {
        if let stringDict = unwrap(value) as? [String: String] {
            return stringDict
        }

        if let anyDict = unwrap(value) as? [String: Any] {
            return anyDict
        }

        return nil
    }

    private func unwrap(_ value: Any) -> Any? {
        let mirror = Mirror(reflecting: value)
        guard mirror.displayStyle == .optional else {
            return value
        }

        return mirror.children.first?.value
    }
}
