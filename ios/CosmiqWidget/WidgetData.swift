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
}

/// Manager for loading widget data from App Group shared container
class WidgetDataManager {
    static let shared = WidgetDataManager()
    
    private let appGroupId = "group.com.darrylgraham.revolution"
    private let dataKey = "widget_tasks_data"
    
    private init() {}
    
    /// Load task data from shared App Group UserDefaults
    func loadData() -> WidgetTaskData? {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            return nil
        }

        let decodedData: WidgetTaskData?

        if let data = userDefaults.data(forKey: dataKey) {
            decodedData = decodeWidgetData(from: data)
        } else if let jsonString = userDefaults.string(forKey: dataKey),
                  let data = jsonString.data(using: .utf8) {
            // Legacy string payload support
            decodedData = decodeWidgetData(from: data)
        } else {
            return nil
        }

        guard let payload = decodedData else {
            return nil
        }

        if payload.isForToday {
            return payload
        }

        // Never display stale day data on the widget.
        return getEmptyData(for: WidgetTaskData.localDateString())
    }

    private func decodeWidgetData(from data: Data) -> WidgetTaskData? {
        do {
            return try JSONDecoder().decode(WidgetTaskData.self, from: data)
        } catch {
            print("[WidgetDataManager] Failed to decode data: \(error)")
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
            updatedAt: nil
        )
    }
    
    /// Get placeholder data for widget previews
    func getPlaceholderData() -> WidgetTaskData {
        return WidgetTaskData(
            tasks: [
                WidgetTask(id: "1", text: "Morning meditation", completed: true, xpReward: 50, isMainQuest: false, category: "wellness", section: "morning", scheduledTime: "07:00"),
                WidgetTask(id: "2", text: "Complete daily quest", completed: false, xpReward: 100, isMainQuest: true, category: "growth", section: "morning", scheduledTime: "09:00"),
                WidgetTask(id: "3", text: "Review goals", completed: false, xpReward: 30, isMainQuest: false, category: "productivity", section: "afternoon", scheduledTime: nil)
            ],
            completedCount: 1,
            totalCount: 3,
            ritualCount: 4,
            ritualCompleted: 2,
            date: WidgetTaskData.localDateString(),
            updatedAt: nil
        )
    }
}
