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
        CAPPluginMethod(name: "getWidgetSyncDiagnostics", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "runWidgetSyncProbe", returnType: CAPPluginReturnPromise)
    ]
    
    private let appGroupId = "group.com.darrylgraham.revolution"
    private let dataKey = "widget_tasks_data"
    private var lastErrorCode: String?
    private var lastErrorMessage: String?
    private let isoFormatter = ISO8601DateFormatter()
    private let diagnosticsDirectoryName = "WidgetSync"
    private let diagnosticsFileName = "widget-sync-diagnostics.jsonl"
    private let diagnosticsMaxFileBytes = 256 * 1024

    private enum ErrorCode {
        static let appGroupInaccessible = "APP_GROUP_INACCESSIBLE"
        static let payloadSerializationFailed = "PAYLOAD_SERIALIZATION_FAILED"
        static let payloadWriteFailed = "PAYLOAD_WRITE_FAILED"
        static let diagnosticsFailed = "DIAGNOSTICS_FAILED"
        static let invalidParameters = "INVALID_PARAMETERS"
    }

    private static let probePayloadKey = "widget_sync_probe"
    
    @objc func updateWidgetData(_ call: CAPPluginCall) {
        guard let tasksArray = call.getArray("tasks") as? [[String: Any]],
              let completedCount = call.getInt("completedCount"),
              let totalCount = call.getInt("totalCount"),
              let date = call.getString("date") else {
            print("[WidgetDataPlugin] updateWidgetData rejected: missing required parameters")
            appendDiagnosticsLog(
                event: "updateWidgetData_failed",
                status: "error",
                details: [
                    "errorCode": ErrorCode.invalidParameters,
                    "errorMessage": "Missing required parameters"
                ]
            )
            reject(
                call,
                message: "Missing required parameters",
                code: ErrorCode.invalidParameters
            )
            return
        }
        
        // Get ritual counts (default to 0 if not provided)
        let ritualCount = call.getInt("ritualCount") ?? 0
        let ritualCompleted = call.getInt("ritualCompleted") ?? 0
        appendDiagnosticsLog(
            event: "updateWidgetData_start",
            details: [
                "date": date,
                "taskCount": tasksArray.count,
                "totalCount": totalCount,
                "completedCount": completedCount,
                "ritualCount": ritualCount,
                "ritualCompleted": ritualCompleted
            ]
        )
        
        let widgetData: [String: Any] = [
            "tasks": tasksArray,
            "completedCount": completedCount,
            "totalCount": totalCount,
            "ritualCount": ritualCount,
            "ritualCompleted": ritualCompleted,
            "date": date,
            "updatedAt": isoFormatter.string(from: Date())
        ]
        
        // Write to App Group shared container
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            print("[WidgetDataPlugin] updateWidgetData rejected: failed to access App Group container \(appGroupId)")
            appendDiagnosticsLog(
                event: "updateWidgetData_failed",
                status: "error",
                details: [
                    "date": date,
                    "errorCode": ErrorCode.appGroupInaccessible,
                    "errorMessage": "Failed to access App Group container"
                ]
            )
            reject(
                call,
                message: "Failed to access App Group container",
                code: ErrorCode.appGroupInaccessible
            )
            return
        }

        guard let jsonData = try? JSONSerialization.data(withJSONObject: widgetData) else {
            print("[WidgetDataPlugin] updateWidgetData rejected: failed to serialize widget payload")
            appendDiagnosticsLog(
                event: "updateWidgetData_failed",
                status: "error",
                details: [
                    "date": date,
                    "errorCode": ErrorCode.payloadSerializationFailed,
                    "errorMessage": "Failed to serialize widget data"
                ]
            )
            reject(
                call,
                message: "Failed to serialize widget data",
                code: ErrorCode.payloadSerializationFailed
            )
            return
        }

        userDefaults.set(jsonData, forKey: dataKey)
        let didSynchronize = userDefaults.synchronize()
        guard let readBackData = userDefaults.data(forKey: dataKey), !readBackData.isEmpty else {
            print("[WidgetDataPlugin] updateWidgetData rejected: payload missing after write")
            appendDiagnosticsLog(
                event: "updateWidgetData_failed",
                status: "error",
                details: [
                    "date": date,
                    "errorCode": ErrorCode.payloadWriteFailed,
                    "errorMessage": "Failed to write widget payload to shared storage",
                    "payloadByteCount": jsonData.count,
                    "synchronized": didSynchronize
                ]
            )
            reject(
                call,
                message: "Failed to write widget payload to shared storage",
                code: ErrorCode.payloadWriteFailed
            )
            return
        }

        print(
            "[WidgetDataPlugin] Wrote widget payload " +
            "date=\(date) " +
            "tasks=\(tasksArray.count) " +
            "total=\(totalCount) " +
            "completed=\(completedCount) " +
            "rituals=\(ritualCompleted)/\(ritualCount) " +
            "bytes=\(jsonData.count) " +
            "readBackBytes=\(readBackData.count) " +
            "synchronized=\(didSynchronize)"
        )
        appendDiagnosticsLog(
            event: "updateWidgetData_succeeded",
            status: "success",
            details: [
                "date": date,
                "taskCount": tasksArray.count,
                "totalCount": totalCount,
                "completedCount": completedCount,
                "ritualCount": ritualCount,
                "ritualCompleted": ritualCompleted,
                "payloadByteCount": jsonData.count,
                "readBackByteCount": readBackData.count,
                "synchronized": didSynchronize
            ]
        )

        clearLastError()
        triggerWidgetReload(withDelay: 0.15, reason: "updateWidgetData")
        call.resolve()
    }

    @objc func reloadWidget(_ call: CAPPluginCall) {
        print("[WidgetDataPlugin] reloadWidget called from JS")
        appendDiagnosticsLog(
            event: "reloadWidget_called",
            status: "success"
        )
        triggerWidgetReload(withDelay: 0.0, reason: "reloadWidget")
        call.resolve()
    }

    @objc func getWidgetSyncDiagnostics(_ call: CAPPluginCall) {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            print("[WidgetDataPlugin] Diagnostics: App Group inaccessible \(appGroupId)")
            setLastError(
                code: ErrorCode.appGroupInaccessible,
                message: "Failed to access App Group container \(appGroupId)"
            )
            appendDiagnosticsLog(
                event: "getWidgetSyncDiagnostics_failed",
                status: "error",
                details: [
                    "errorCode": ErrorCode.appGroupInaccessible,
                    "errorMessage": "Failed to access App Group container \(appGroupId)"
                ]
            )
            call.resolve([
                "appGroupAccessible": false,
                "hasPayload": false,
                "payloadDate": NSNull(),
                "payloadUpdatedAt": NSNull(),
                "payloadByteCount": 0,
                "appGroupId": appGroupId,
                "dataKey": dataKey,
                "lastErrorCode": lastErrorCode ?? NSNull(),
                "lastErrorMessage": lastErrorMessage ?? NSNull()
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
        var payloadObject: [String: Any]?

        do {
            if let payloadData {
                payloadObject = try JSONSerialization.jsonObject(with: payloadData) as? [String: Any]
            }
        } catch {
            print("[WidgetDataPlugin] Diagnostics decode failed: \(error.localizedDescription)")
            appendDiagnosticsLog(
                event: "getWidgetSyncDiagnostics_failed",
                status: "error",
                details: [
                    "errorCode": ErrorCode.diagnosticsFailed,
                    "errorMessage": "Failed to decode widget diagnostics payload",
                    "payloadByteCount": payloadByteCount
                ]
            )
            reject(
                call,
                message: "Failed to decode widget diagnostics payload",
                code: ErrorCode.diagnosticsFailed,
                error: error
            )
            return
        }

        print(
            "[WidgetDataPlugin] Diagnostics " +
            "accessible=true " +
            "hasPayload=\(hasPayload) " +
            "payloadDate=\(payloadObject?["date"] as? String ?? "nil") " +
            "payloadUpdatedAt=\(payloadObject?["updatedAt"] as? String ?? "nil") " +
            "payloadBytes=\(payloadByteCount)"
        )
        appendDiagnosticsLog(
            event: "getWidgetSyncDiagnostics_succeeded",
            status: "success",
            details: [
                "appGroupAccessible": true,
                "hasPayload": hasPayload,
                "payloadDate": payloadObject?["date"] as? String ?? NSNull(),
                "payloadUpdatedAt": payloadObject?["updatedAt"] as? String ?? NSNull(),
                "payloadByteCount": payloadByteCount,
                "lastErrorCode": lastErrorCode ?? NSNull(),
                "lastErrorMessage": lastErrorMessage ?? NSNull()
            ]
        )

        call.resolve([
            "appGroupAccessible": true,
            "hasPayload": hasPayload,
            "payloadDate": payloadObject?["date"] as? String ?? NSNull(),
            "payloadUpdatedAt": payloadObject?["updatedAt"] as? String ?? NSNull(),
            "payloadByteCount": payloadByteCount,
            "appGroupId": appGroupId,
            "dataKey": dataKey,
            "lastErrorCode": lastErrorCode ?? NSNull(),
            "lastErrorMessage": lastErrorMessage ?? NSNull()
        ])
    }

    @objc func runWidgetSyncProbe(_ call: CAPPluginCall) {
        let timestamp = isoFormatter.string(from: Date())
        appendDiagnosticsLog(
            event: "runWidgetSyncProbe_start",
            details: [
                "timestamp": timestamp
            ]
        )

        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            let message = "Failed to access App Group container \(appGroupId)"
            setLastError(code: ErrorCode.appGroupInaccessible, message: message)
            appendDiagnosticsLog(
                event: "runWidgetSyncProbe_failed",
                status: "error",
                details: [
                    "errorCode": ErrorCode.appGroupInaccessible,
                    "errorMessage": message,
                    "timestamp": timestamp
                ]
            )
            call.resolve([
                "appGroupAccessible": false,
                "writeSucceeded": false,
                "readBackSucceeded": false,
                "payloadByteCount": 0,
                "errorCode": ErrorCode.appGroupInaccessible,
                "errorMessage": message,
                "timestamp": timestamp
            ])
            return
        }

        let originalData = userDefaults.data(forKey: dataKey)
        let originalString = originalData == nil ? userDefaults.string(forKey: dataKey) : nil

        defer {
            if let originalData {
                userDefaults.set(originalData, forKey: dataKey)
            } else if let originalString {
                userDefaults.set(originalString, forKey: dataKey)
            } else {
                userDefaults.removeObject(forKey: dataKey)
            }
            userDefaults.synchronize()
        }

        let probeNonce = UUID().uuidString
        let probePayload: [String: Any] = [
            Self.probePayloadKey: true,
            "nonce": probeNonce,
            "timestamp": timestamp
        ]

        guard let jsonData = try? JSONSerialization.data(withJSONObject: probePayload) else {
            let message = "Failed to serialize probe payload"
            setLastError(code: ErrorCode.payloadSerializationFailed, message: message)
            appendDiagnosticsLog(
                event: "runWidgetSyncProbe_failed",
                status: "error",
                details: [
                    "errorCode": ErrorCode.payloadSerializationFailed,
                    "errorMessage": message,
                    "timestamp": timestamp
                ]
            )
            call.resolve([
                "appGroupAccessible": true,
                "writeSucceeded": false,
                "readBackSucceeded": false,
                "payloadByteCount": 0,
                "errorCode": ErrorCode.payloadSerializationFailed,
                "errorMessage": message,
                "timestamp": timestamp
            ])
            return
        }

        userDefaults.set(jsonData, forKey: dataKey)
        let synchronized = userDefaults.synchronize()
        guard let readBackData = userDefaults.data(forKey: dataKey) else {
            let message = "Probe write failed: no data after write"
            setLastError(code: ErrorCode.payloadWriteFailed, message: message)
            appendDiagnosticsLog(
                event: "runWidgetSyncProbe_failed",
                status: "error",
                details: [
                    "errorCode": ErrorCode.payloadWriteFailed,
                    "errorMessage": message,
                    "synchronized": synchronized,
                    "timestamp": timestamp
                ]
            )
            call.resolve([
                "appGroupAccessible": true,
                "writeSucceeded": false,
                "readBackSucceeded": false,
                "payloadByteCount": 0,
                "errorCode": ErrorCode.payloadWriteFailed,
                "errorMessage": message,
                "timestamp": timestamp
            ])
            return
        }

        let writeSucceeded = !readBackData.isEmpty
        var readBackSucceeded = false
        do {
            if let decoded = try JSONSerialization.jsonObject(with: readBackData) as? [String: Any],
               let decodedNonce = decoded["nonce"] as? String {
                readBackSucceeded = decodedNonce == probeNonce
            }
        } catch {
            print("[WidgetDataPlugin] Probe decode failed: \(error.localizedDescription)")
        }

        if writeSucceeded && readBackSucceeded {
            clearLastError()
        } else {
            setLastError(
                code: ErrorCode.payloadWriteFailed,
                message: synchronized
                    ? "Probe readback mismatch"
                    : "Probe synchronization failed"
            )
        }
        appendDiagnosticsLog(
            event: "runWidgetSyncProbe_result",
            status: writeSucceeded && readBackSucceeded ? "success" : "error",
            details: [
                "appGroupAccessible": true,
                "writeSucceeded": writeSucceeded,
                "readBackSucceeded": readBackSucceeded,
                "payloadByteCount": readBackData.count,
                "synchronized": synchronized,
                "errorCode": writeSucceeded && readBackSucceeded ? NSNull() : (lastErrorCode ?? NSNull()),
                "errorMessage": writeSucceeded && readBackSucceeded ? NSNull() : (lastErrorMessage ?? NSNull()),
                "timestamp": timestamp
            ]
        )

        call.resolve([
            "appGroupAccessible": true,
            "writeSucceeded": writeSucceeded,
            "readBackSucceeded": readBackSucceeded,
            "payloadByteCount": readBackData.count,
            "errorCode": writeSucceeded && readBackSucceeded ? NSNull() : (lastErrorCode ?? NSNull()),
            "errorMessage": writeSucceeded && readBackSucceeded ? NSNull() : (lastErrorMessage ?? NSNull()),
            "timestamp": timestamp
        ])
    }

    private func triggerWidgetReload(withDelay delay: TimeInterval, reason: String) {
        guard #available(iOS 14.0, *) else {
            print("[WidgetDataPlugin] Skipped widget reload (\(reason)): iOS < 14")
            return
        }

        print("[WidgetDataPlugin] Scheduling widget reload reason=\(reason) delay=\(delay)s")
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            print("[WidgetDataPlugin] Reloading widget timelines reason=\(reason)")
            WidgetCenter.shared.reloadTimelines(ofKind: "CosmiqWidget")
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    private func diagnosticsLogFileURL() -> URL? {
        guard let cachesDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            return nil
        }
        return cachesDirectory
            .appendingPathComponent(diagnosticsDirectoryName, isDirectory: true)
            .appendingPathComponent(diagnosticsFileName, isDirectory: false)
    }

    private func appendDiagnosticsLog(
        event: String,
        status: String = "info",
        details: [String: Any] = [:]
    ) {
        guard let logURL = diagnosticsLogFileURL() else {
            return
        }

        var payload: [String: Any] = details
        payload["timestamp"] = payload["timestamp"] ?? isoFormatter.string(from: Date())
        payload["event"] = event
        payload["status"] = status
        payload["appGroupId"] = appGroupId
        payload["dataKey"] = dataKey

        let lineData: Data
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: payload)
            guard let jsonLine = String(data: jsonData, encoding: .utf8) else {
                return
            }
            lineData = Data((jsonLine + "\n").utf8)
        } catch {
            print("[WidgetDataPlugin] Diagnostics file encode failed: \(error.localizedDescription)")
            return
        }

        do {
            try FileManager.default.createDirectory(
                at: logURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )

            if FileManager.default.fileExists(atPath: logURL.path) {
                if let attrs = try? FileManager.default.attributesOfItem(atPath: logURL.path),
                   let fileSize = attrs[.size] as? NSNumber,
                   fileSize.intValue >= diagnosticsMaxFileBytes {
                    try Data().write(to: logURL, options: .atomic)
                }

                let handle = try FileHandle(forWritingTo: logURL)
                defer { try? handle.close() }
                _ = try handle.seekToEnd()
                try handle.write(contentsOf: lineData)
                return
            }

            try lineData.write(to: logURL, options: .atomic)
        } catch {
            print("[WidgetDataPlugin] Diagnostics file write failed: \(error.localizedDescription)")
        }
    }

    private func setLastError(code: String, message: String) {
        lastErrorCode = code
        lastErrorMessage = message
    }

    private func clearLastError() {
        lastErrorCode = nil
        lastErrorMessage = nil
    }

    private func reject(
        _ call: CAPPluginCall,
        message: String,
        code: String,
        error: Error? = nil
    ) {
        setLastError(code: code, message: message)
        call.reject(message, code, error)
    }
}
