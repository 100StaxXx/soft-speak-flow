import Foundation

/// Data structure for widget task information
struct WidgetTaskData: Codable {
    let tasks: [WidgetTask]
    let completedCount: Int
    let totalCount: Int
    let ritualCount: Int?
    let ritualCompleted: Int?
    let date: String
    let updatedAt: String?
    let profileWallpaperRelativePath: String?
    let profileWallpaperDateKey: String?
    
    /// Combined count of all tasks (quests + rituals)
    var totalAllCount: Int {
        return totalCount + (ritualCount ?? 0)
    }
    
    /// Combined completed count (quests + rituals)
    var totalAllCompleted: Int {
        return completedCount + (ritualCompleted ?? 0)
    }

    /// Widget payload should only render for the current local day.
    var isForToday: Bool {
        return date == Self.localDateString()
    }

    static func localDateString(from date: Date = Date()) -> String {
        return dayFormatter.string(from: date)
    }

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar.current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

/// Individual task for widget display
struct WidgetTask: Codable, Identifiable {
    let id: String
    let text: String
    let completed: Bool
    let xpReward: Int
    let isMainQuest: Bool
    let category: String?
    let section: String
    let scheduledTime: String?
    let kind: String?
    let isRitual: Bool?
    let isCampaignRitual: Bool?
    let campaignTitle: String?
    let epicId: String?
    let habitSourceId: String?

    init(
        id: String,
        text: String,
        completed: Bool,
        xpReward: Int,
        isMainQuest: Bool,
        category: String?,
        section: String,
        scheduledTime: String?,
        kind: String? = nil,
        isRitual: Bool? = nil,
        isCampaignRitual: Bool? = nil,
        campaignTitle: String? = nil,
        epicId: String? = nil,
        habitSourceId: String? = nil
    ) {
        self.id = id
        self.text = text
        self.completed = completed
        self.xpReward = xpReward
        self.isMainQuest = isMainQuest
        self.category = category
        self.section = section
        self.scheduledTime = scheduledTime
        self.kind = kind
        self.isRitual = isRitual
        self.isCampaignRitual = isCampaignRitual
        self.campaignTitle = campaignTitle
        self.epicId = epicId
        self.habitSourceId = habitSourceId
    }
}

/// Manager for loading widget data from App Group shared container
class WidgetDataManager {
    static let shared = WidgetDataManager()
    
    private let appGroupId = "group.com.darrylgraham.graceward"
    private let payloadFileName = "widget_tasks_data.json"
    
    private init() {}
    
    /// Load task data from the shared App Group file container.
    func loadData() -> WidgetTaskData? {
        guard let data = loadPayloadData() else {
            return nil
        }

        guard let payload = decodeWidgetData(from: data) else {
            return nil
        }

        if payload.isForToday {
            return payload
        }

        // Never display stale day data on the widget.
        return getEmptyData(for: WidgetTaskData.localDateString())
    }

    private func loadPayloadData() -> Data? {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId
        ) else {
            return nil
        }

        let payloadURL = containerURL.appendingPathComponent(payloadFileName, isDirectory: false)
        return try? Data(contentsOf: payloadURL)
    }

    private func decodeWidgetData(from data: Data) -> WidgetTaskData? {
        do {
            return try JSONDecoder().decode(WidgetTaskData.self, from: data)
        } catch {
            return nil
        }
    }

    func getEmptyData(for date: String = WidgetTaskData.localDateString()) -> WidgetTaskData {
        return WidgetTaskData(
            tasks: [],
            completedCount: 0,
            totalCount: 0,
            ritualCount: 0,
            ritualCompleted: 0,
            date: date,
            updatedAt: nil,
            profileWallpaperRelativePath: nil,
            profileWallpaperDateKey: nil
        )
    }
    
    /// Get placeholder data for widget previews
    func getPlaceholderData() -> WidgetTaskData {
        return WidgetTaskData(
            tasks: [
                WidgetTask(
                    id: "preview-daily-practice",
                    text: "Name three gifts from the last 24 hours and thank God for each one.",
                    completed: false,
                    xpReward: 5,
                    isMainQuest: false,
                    category: "soul",
                    section: "unscheduled",
                    scheduledTime: nil,
                    kind: "daily_practice",
                    isRitual: false,
                    isCampaignRitual: false
                )
            ],
            completedCount: 0,
            totalCount: 1,
            ritualCount: 0,
            ritualCompleted: 0,
            date: WidgetTaskData.localDateString(),
            updatedAt: nil,
            profileWallpaperRelativePath: nil,
            profileWallpaperDateKey: nil
        )
    }

    func profileWallpaperFileURL(for relativePath: String?) -> URL? {
        guard
            let relativePath,
            !relativePath.isEmpty,
            !relativePath.contains(".."),
            let containerURL = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: appGroupId
            )
        else {
            return nil
        }

        return containerURL.appendingPathComponent(relativePath, isDirectory: false)
    }
}
