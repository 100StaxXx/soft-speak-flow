import Foundation
import Capacitor
import Security

@objc(AuthSessionStoragePlugin)
public class AuthSessionStoragePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AuthSessionStoragePlugin"
    public let jsName = "AuthSessionStorage"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeItem", returnType: CAPPluginReturnPromise)
    ]

    private func query(_ call: CAPPluginCall) -> [String: Any]? {
        guard let key = call.getString("key"), key.hasPrefix("sb-opbfpbbqvuksuvmtmssd-auth-token") else {
            call.reject("Invalid session storage key")
            return nil
        }
        return [kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: (Bundle.main.bundleIdentifier ?? "com.darrylgraham.revolution") + ".cosmiq.auth",
                kSecAttrAccount as String: key]
    }

    @objc public func getItem(_ call: CAPPluginCall) {
        guard var lookup = query(call) else { return }
        lookup[kSecReturnData as String] = true
        lookup[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(lookup as CFDictionary, &result)
        if status == errSecItemNotFound { call.resolve(["value": NSNull()]); return }
        guard status == errSecSuccess, let data = result as? Data, let value = String(data: data, encoding: .utf8) else {
            call.reject("Secure session storage is temporarily unavailable")
            return
        }
        call.resolve(["value": value])
    }

    @objc public func setItem(_ call: CAPPluginCall) {
        guard let lookup = query(call) else { return }
        guard let value = call.getString("value"), let data = value.data(using: .utf8) else {
            call.reject("Session value is required")
            return
        }
        let attributes: [String: Any] = [kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        var status = SecItemUpdate(lookup as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            let item = lookup.merging(attributes) { _, new in new }
            status = SecItemAdd(item as CFDictionary, nil)
        }
        guard status == errSecSuccess else { call.reject("Could not save secure session"); return }
        call.resolve()
    }

    @objc public func removeItem(_ call: CAPPluginCall) {
        guard let lookup = query(call) else { return }
        let status = SecItemDelete(lookup as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            call.reject("Could not clear secure session")
            return
        }
        call.resolve()
    }
}
