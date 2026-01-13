import Foundation

/// Data structure for widget task information
struct WidgetTaskData: Codable {
    let tasks: [WidgetTask]
    let completedCount: Int
    let totalCount: Int
    let date: String
    let updatedAt: String?
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
        guard let userDefaults = UserDefaults(suiteName: appGroupId),
              let jsonString = userDefaults.string(forKey: dataKey),
              let data = jsonString.data(using: .utf8) else {
            return nil
        }
        
        do {
            return try JSONDecoder().decode(WidgetTaskData.self, from: data)
        } catch {
            print("[WidgetDataManager] Failed to decode data: \(error)")
            return nil
        }
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
            date: ISO8601DateFormatter().string(from: Date()),
            updatedAt: nil
        )
    }
}
