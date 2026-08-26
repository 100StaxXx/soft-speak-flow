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
    
    private var appGroupId: String {
        Bundle.main.bundleIdentifier == "com.darrylgraham.revolution"
            ? "group.com.darrylgraham.revolution"
            : "group.com.darrylgraham.graceward"
    }
    private let dataKey = "widget_tasks_data"
    private var lastErrorCode: String?
    private var lastErrorMessage: String?
    private let isoFormatter = ISO8601DateFormatter()
    private let payloadFileName = "widget_tasks_data.json"
    private let diagnosticsDirectoryName = "WidgetSync"
    private let diagnosticsFileName = "widget-sync-diagnostics.jsonl"
    private let diagnosticsMaxFileBytes = 256 * 1024
    private let profileWallpaperRelativePath = "WidgetBackgrounds/profile-wallpaper"
    private let profileWallpaperStateRelativePath = "WidgetBackgrounds/profile-wallpaper-state.json"

    private enum ErrorCode {
        static let appGroupInaccessible = "APP_GROUP_INACCESSIBLE"
        static let payloadSerializationFailed = "PAYLOAD_SERIALIZATION_FAILED"
        static let payloadWriteFailed = "PAYLOAD_WRITE_FAILED"
        static let diagnosticsFailed = "DIAGNOSTICS_FAILED"
        static let invalidParameters = "INVALID_PARAMETERS"
    }

    private static let probePayloadKey = "widget_sync_probe"

    private struct ProfileWallpaperState {
        let relativePath: String?
        let dateKey: String?
    }

    private struct StoredProfileWallpaperState: Codable {
        let sourceUrl: String
        let dateKey: String
        let relativePath: String
    }
    
    @objc func updateWidgetData(_ call: CAPPluginCall) {
        guard let tasksArray = call.getArray("tasks") as? [[String: Any]],
              let completedCount = call.getInt("completedCount"),
              let totalCount = call.getInt("totalCount"),
              let date = call.getString("date") else {
            CosmiqNativeLog.warning("[WidgetDataPlugin] updateWidgetData rejected: missing required parameters")
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
        let profileWallpaperImageUrl = normalizedOptionalString(call.getString("profileWallpaperImageUrl"))
        let profileWallpaperDateKey = normalizedOptionalString(call.getString("profileWallpaperDateKey"))
        appendDiagnosticsLog(
            event: "updateWidgetData_start",
            details: [
                "date": date,
                "taskCount": tasksArray.count,
                "totalCount": totalCount,
                "completedCount": completedCount,
                "ritualCount": ritualCount,
                "ritualCompleted": ritualCompleted,
                "hasProfileWallpaperImageUrl": profileWallpaperImageUrl != nil,
                "profileWallpaperDateKey": profileWallpaperDateKey ?? NSNull()
            ]
        )

        guard appGroupContainerURL() != nil else {
            CosmiqNativeLog.warning("[WidgetDataPlugin] updateWidgetData rejected: failed to access App Group container \(appGroupId)")
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

        syncProfileWallpaper(
            imageUrl: profileWallpaperImageUrl,
            dateKey: profileWallpaperDateKey
        ) { wallpaperState in
            var widgetData: [String: Any] = [
                "tasks": tasksArray,
                "completedCount": completedCount,
                "totalCount": totalCount,
                "ritualCount": ritualCount,
                "ritualCompleted": ritualCompleted,
                "date": date,
                "updatedAt": self.isoFormatter.string(from: Date())
            ]

            if let relativePath = wallpaperState.relativePath {
                widgetData["profileWallpaperRelativePath"] = relativePath
            }

            if let wallpaperDateKey = wallpaperState.dateKey {
                widgetData["profileWallpaperDateKey"] = wallpaperDateKey
            }

            self.writeWidgetPayload(
                call,
                widgetData: widgetData,
                date: date,
                taskCount: tasksArray.count,
                totalCount: totalCount,
                completedCount: completedCount,
                ritualCount: ritualCount,
                ritualCompleted: ritualCompleted,
                wallpaperState: wallpaperState
            )
        }
    }

    @objc func reloadWidget(_ call: CAPPluginCall) {
        CosmiqNativeLog.debug("[WidgetDataPlugin] reloadWidget called from JS")
        appendDiagnosticsLog(
            event: "reloadWidget_called",
            status: "success"
        )
        triggerWidgetReload(withDelay: 0.0, reason: "reloadWidget")
        call.resolve()
    }

    @objc func getWidgetSyncDiagnostics(_ call: CAPPluginCall) {
        guard let payloadURL = widgetPayloadFileURL() else {
            CosmiqNativeLog.warning("[WidgetDataPlugin] Diagnostics: App Group inaccessible \(appGroupId)")
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

        let payloadData = try? Data(contentsOf: payloadURL)
        let hasPayload = payloadData != nil
        let payloadByteCount = payloadData?.count ?? 0
        var payloadObject: [String: Any]?

        do {
            if let payloadData {
                payloadObject = try JSONSerialization.jsonObject(with: payloadData) as? [String: Any]
            }
        } catch {
            CosmiqNativeLog.warning("[WidgetDataPlugin] Diagnostics decode failed: \(error.localizedDescription)")
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

        CosmiqNativeLog.debug(
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

        guard let payloadURL = widgetPayloadFileURL() else {
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

        let fileManager = FileManager.default
        let originalData = try? Data(contentsOf: payloadURL)

        defer {
            if let originalData {
                try? originalData.write(to: payloadURL, options: .atomic)
            } else {
                try? fileManager.removeItem(at: payloadURL)
            }
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

        let readBackData: Data
        do {
            try fileManager.createDirectory(
                at: payloadURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            try jsonData.write(to: payloadURL, options: .atomic)
            readBackData = try Data(contentsOf: payloadURL)
        } catch {
            let message = "Probe write failed: \(error.localizedDescription)"
            setLastError(code: ErrorCode.payloadWriteFailed, message: message)
            appendDiagnosticsLog(
                event: "runWidgetSyncProbe_failed",
                status: "error",
                details: [
                    "errorCode": ErrorCode.payloadWriteFailed,
                    "errorMessage": message,
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
            CosmiqNativeLog.warning("[WidgetDataPlugin] Probe decode failed: \(error.localizedDescription)")
        }

        if writeSucceeded && readBackSucceeded {
            clearLastError()
        } else {
            setLastError(
                code: ErrorCode.payloadWriteFailed,
                message: "Probe readback mismatch"
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
            CosmiqNativeLog.debug("[WidgetDataPlugin] Skipped widget reload (\(reason)): iOS < 14")
            return
        }

        CosmiqNativeLog.debug("[WidgetDataPlugin] Scheduling widget reload reason=\(reason) delay=\(delay)s")
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            CosmiqNativeLog.debug("[WidgetDataPlugin] Reloading widget timelines reason=\(reason)")
            WidgetCenter.shared.reloadTimelines(ofKind: "CosmiqWidget")
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    private func writeWidgetPayload(
        _ call: CAPPluginCall,
        widgetData: [String: Any],
        date: String,
        taskCount: Int,
        totalCount: Int,
        completedCount: Int,
        ritualCount: Int,
        ritualCompleted: Int,
        wallpaperState: ProfileWallpaperState
    ) {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: widgetData) else {
            CosmiqNativeLog.warning("[WidgetDataPlugin] updateWidgetData rejected: failed to serialize widget payload")
            appendDiagnosticsLog(
                event: "updateWidgetData_failed",
                status: "error",
                details: [
                    "date": date,
                    "errorCode": ErrorCode.payloadSerializationFailed,
                    "errorMessage": "Failed to serialize widget data"
                ]
            )
            DispatchQueue.main.async {
                self.reject(
                    call,
                    message: "Failed to serialize widget data",
                    code: ErrorCode.payloadSerializationFailed
                )
            }
            return
        }

        guard let payloadURL = widgetPayloadFileURL() else {
            CosmiqNativeLog.warning("[WidgetDataPlugin] updateWidgetData rejected: payload missing after write")
            appendDiagnosticsLog(
                event: "updateWidgetData_failed",
                status: "error",
                details: [
                    "date": date,
                    "errorCode": ErrorCode.payloadWriteFailed,
                    "errorMessage": "Failed to access App Group payload file",
                    "payloadByteCount": jsonData.count
                ]
            )
            DispatchQueue.main.async {
                self.reject(
                    call,
                    message: "Failed to write widget payload to shared storage",
                    code: ErrorCode.payloadWriteFailed
                )
            }
            return
        }

        let readBackData: Data
        do {
            try FileManager.default.createDirectory(
                at: payloadURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            try jsonData.write(to: payloadURL, options: .atomic)
            readBackData = try Data(contentsOf: payloadURL)
            guard !readBackData.isEmpty else {
                throw NSError(
                    domain: "WidgetDataPlugin",
                    code: 2,
                    userInfo: [NSLocalizedDescriptionKey: "Payload file was empty after write"]
                )
            }
        } catch {
            CosmiqNativeLog.warning("[WidgetDataPlugin] updateWidgetData rejected: payload file write failed")
            appendDiagnosticsLog(
                event: "updateWidgetData_failed",
                status: "error",
                details: [
                    "date": date,
                    "errorCode": ErrorCode.payloadWriteFailed,
                    "errorMessage": error.localizedDescription,
                    "payloadByteCount": jsonData.count
                ]
            )
            DispatchQueue.main.async {
                self.reject(
                    call,
                    message: "Failed to write widget payload to shared storage",
                    code: ErrorCode.payloadWriteFailed,
                    error: error
                )
            }
            return
        }

        CosmiqNativeLog.debug(
            "[WidgetDataPlugin] Wrote widget payload " +
            "date=\(date) " +
            "tasks=\(taskCount) " +
            "total=\(totalCount) " +
            "completed=\(completedCount) " +
            "rituals=\(ritualCompleted)/\(ritualCount) " +
            "bytes=\(jsonData.count) " +
            "readBackBytes=\(readBackData.count) " +
            "hasProfileWallpaper=\(wallpaperState.relativePath != nil)"
        )
        appendDiagnosticsLog(
            event: "updateWidgetData_succeeded",
            status: "success",
            details: [
                "date": date,
                "taskCount": taskCount,
                "totalCount": totalCount,
                "completedCount": completedCount,
                "ritualCount": ritualCount,
                "ritualCompleted": ritualCompleted,
                "payloadByteCount": jsonData.count,
                "readBackByteCount": readBackData.count,
                "profileWallpaperRelativePath": wallpaperState.relativePath ?? NSNull(),
                "profileWallpaperDateKey": wallpaperState.dateKey ?? NSNull()
            ]
        )

        clearLastError()
        triggerWidgetReload(withDelay: 0.15, reason: "updateWidgetData")
        DispatchQueue.main.async {
            call.resolve()
        }
    }

    private func syncProfileWallpaper(
        imageUrl: String?,
        dateKey: String?,
        completion: @escaping (ProfileWallpaperState) -> Void
    ) {
        guard let imageUrl, let dateKey else {
            clearCachedProfileWallpaper()
            completion(ProfileWallpaperState(relativePath: nil, dateKey: nil))
            return
        }

        if let cachedState = cachedProfileWallpaperState(
            imageUrl: imageUrl,
            dateKey: dateKey
        ) {
            completion(cachedState)
            return
        }

        guard let remoteURL = URL(string: imageUrl) else {
            appendDiagnosticsLog(
                event: "updateWidgetData_wallpaper_skipped",
                status: "error",
                details: [
                    "profileWallpaperDateKey": dateKey,
                    "errorMessage": "Invalid profile wallpaper URL"
                ]
            )
            clearCachedProfileWallpaper()
            completion(ProfileWallpaperState(relativePath: nil, dateKey: nil))
            return
        }

        let request = URLRequest(
            url: remoteURL,
            cachePolicy: .reloadIgnoringLocalCacheData,
            timeoutInterval: 20
        )

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error {
                self.appendDiagnosticsLog(
                    event: "updateWidgetData_wallpaper_skipped",
                    status: "error",
                    details: [
                        "profileWallpaperDateKey": dateKey,
                        "errorMessage": error.localizedDescription
                    ]
                )
                self.clearCachedProfileWallpaper()
                completion(ProfileWallpaperState(relativePath: nil, dateKey: nil))
                return
            }

            if let httpResponse = response as? HTTPURLResponse,
               !(200...299).contains(httpResponse.statusCode) {
                self.appendDiagnosticsLog(
                    event: "updateWidgetData_wallpaper_skipped",
                    status: "error",
                    details: [
                        "profileWallpaperDateKey": dateKey,
                        "errorMessage": "Wallpaper request failed with status \(httpResponse.statusCode)"
                    ]
                )
                self.clearCachedProfileWallpaper()
                completion(ProfileWallpaperState(relativePath: nil, dateKey: nil))
                return
            }

            guard let data, !data.isEmpty else {
                self.appendDiagnosticsLog(
                    event: "updateWidgetData_wallpaper_skipped",
                    status: "error",
                    details: [
                        "profileWallpaperDateKey": dateKey,
                        "errorMessage": "Wallpaper response was empty"
                    ]
                )
                self.clearCachedProfileWallpaper()
                completion(ProfileWallpaperState(relativePath: nil, dateKey: nil))
                return
            }

            do {
                let relativePath = try self.writeProfileWallpaperImage(data: data)
                try self.writeProfileWallpaperCache(
                    StoredProfileWallpaperState(
                        sourceUrl: imageUrl,
                        dateKey: dateKey,
                        relativePath: relativePath
                    )
                )
                self.appendDiagnosticsLog(
                    event: "updateWidgetData_wallpaper_cached",
                    status: "success",
                    details: [
                        "profileWallpaperDateKey": dateKey,
                        "profileWallpaperRelativePath": relativePath,
                        "payloadByteCount": data.count
                    ]
                )
                completion(ProfileWallpaperState(relativePath: relativePath, dateKey: dateKey))
            } catch {
                self.appendDiagnosticsLog(
                    event: "updateWidgetData_wallpaper_skipped",
                    status: "error",
                    details: [
                        "profileWallpaperDateKey": dateKey,
                        "errorMessage": error.localizedDescription
                    ]
                )
                self.clearCachedProfileWallpaper()
                completion(ProfileWallpaperState(relativePath: nil, dateKey: nil))
            }
        }.resume()
    }

    private func cachedProfileWallpaperState(
        imageUrl: String,
        dateKey: String
    ) -> ProfileWallpaperState? {
        guard
            let storedState = readProfileWallpaperCache(),
            let fileURL = profileWallpaperFileURL(relativePath: storedState.relativePath),
            FileManager.default.fileExists(atPath: fileURL.path),
            storedState.sourceUrl == imageUrl,
            storedState.dateKey == dateKey
        else {
            return nil
        }

        return ProfileWallpaperState(relativePath: storedState.relativePath, dateKey: storedState.dateKey)
    }

    private func writeProfileWallpaperImage(data: Data) throws -> String {
        let relativePath = profileWallpaperRelativePath
        guard let targetURL = profileWallpaperFileURL(relativePath: relativePath) else {
            throw NSError(
                domain: "WidgetDataPlugin",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Failed to access App Group wallpaper directory"]
            )
        }

        let directoryURL = targetURL.deletingLastPathComponent()
        let tempURL = directoryURL.appendingPathComponent("profile-wallpaper.tmp", isDirectory: false)
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)

        if FileManager.default.fileExists(atPath: tempURL.path) {
            try? FileManager.default.removeItem(at: tempURL)
        }

        try data.write(to: tempURL, options: .atomic)

        if FileManager.default.fileExists(atPath: targetURL.path) {
            _ = try FileManager.default.replaceItemAt(targetURL, withItemAt: tempURL)
        } else {
            try FileManager.default.moveItem(at: tempURL, to: targetURL)
        }

        return relativePath
    }

    private func clearCachedProfileWallpaper() {
        if let relativePath = readProfileWallpaperCache()?.relativePath,
           let fileURL = profileWallpaperFileURL(relativePath: relativePath),
           FileManager.default.fileExists(atPath: fileURL.path) {
            try? FileManager.default.removeItem(at: fileURL)
        }

        if let stateURL = profileWallpaperStateFileURL(),
           FileManager.default.fileExists(atPath: stateURL.path) {
            try? FileManager.default.removeItem(at: stateURL)
        }
    }

    private func appGroupContainerURL() -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId)
    }

    private func widgetPayloadFileURL() -> URL? {
        appGroupFileURL(relativePath: payloadFileName)
    }

    private func profileWallpaperStateFileURL() -> URL? {
        appGroupFileURL(relativePath: profileWallpaperStateRelativePath)
    }

    private func appGroupFileURL(relativePath: String) -> URL? {
        guard
            !relativePath.isEmpty,
            !relativePath.contains(".."),
            let containerURL = appGroupContainerURL()
        else {
            return nil
        }

        return containerURL.appendingPathComponent(relativePath, isDirectory: false)
    }

    private func readProfileWallpaperCache() -> StoredProfileWallpaperState? {
        guard
            let stateURL = profileWallpaperStateFileURL(),
            let data = try? Data(contentsOf: stateURL)
        else {
            return nil
        }

        return try? JSONDecoder().decode(StoredProfileWallpaperState.self, from: data)
    }

    private func writeProfileWallpaperCache(_ state: StoredProfileWallpaperState) throws {
        guard let stateURL = profileWallpaperStateFileURL() else {
            throw NSError(
                domain: "WidgetDataPlugin",
                code: 3,
                userInfo: [NSLocalizedDescriptionKey: "Failed to access App Group wallpaper state file"]
            )
        }

        try FileManager.default.createDirectory(
            at: stateURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let data = try JSONEncoder().encode(state)
        try data.write(to: stateURL, options: .atomic)
    }

    private func profileWallpaperFileURL(relativePath: String) -> URL? {
        appGroupFileURL(relativePath: relativePath)
    }

    private func normalizedOptionalString(_ value: String?) -> String? {
        guard let value else {
            return nil
        }

        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
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
            CosmiqNativeLog.warning("[WidgetDataPlugin] Diagnostics file encode failed: \(error.localizedDescription)")
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
            CosmiqNativeLog.warning("[WidgetDataPlugin] Diagnostics file write failed: \(error.localizedDescription)")
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
