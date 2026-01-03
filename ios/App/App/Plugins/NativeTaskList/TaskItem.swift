import Foundation

struct TaskItem: Codable {
    let id: String
    let task_text: String
    let completed: Bool
    let xp_reward: Int
    let difficulty: String?
    let category: String?
    let scheduled_time: String?
    let is_main_quest: Bool
    let section: String? // morning, afternoon, evening, unscheduled
    
    init(from dictionary: [String: Any]) {
        self.id = dictionary["id"] as? String ?? ""
        self.task_text = dictionary["task_text"] as? String ?? ""
        self.completed = dictionary["completed"] as? Bool ?? false
        self.xp_reward = dictionary["xp_reward"] as? Int ?? 0
        self.difficulty = dictionary["difficulty"] as? String
        self.category = dictionary["category"] as? String
        self.scheduled_time = dictionary["scheduled_time"] as? String
        self.is_main_quest = dictionary["is_main_quest"] as? Bool ?? false
        self.section = dictionary["section"] as? String
    }
    
    func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [
            "id": id,
            "task_text": task_text,
            "completed": completed,
            "xp_reward": xp_reward,
            "is_main_quest": is_main_quest
        ]
        if let difficulty = difficulty { dict["difficulty"] = difficulty }
        if let category = category { dict["category"] = category }
        if let scheduled_time = scheduled_time { dict["scheduled_time"] = scheduled_time }
        if let section = section { dict["section"] = section }
        return dict
    }
}
