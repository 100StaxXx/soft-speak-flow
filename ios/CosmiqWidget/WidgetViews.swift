import SwiftUI
import WidgetKit

// MARK: - Small Widget View

struct SmallWidgetView: View {
    let entry: TaskEntry
    
    private var completedCount: Int {
        entry.data?.completedCount ?? 0
    }
    
    private var totalCount: Int {
        entry.data?.totalCount ?? 0
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Text("⚔️ Quests")
                    .font(.caption.bold())
                    .foregroundColor(.primary)
                Spacer()
                Text("\(completedCount)/\(totalCount)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            // Task list
            if let tasks = entry.data?.tasks.prefix(3), !tasks.isEmpty {
                ForEach(Array(tasks), id: \.id) { task in
                    Link(destination: URL(string: "cosmiq://task/\(task.id)")!) {
                        SmallTaskRow(task: task)
                    }
                }
            } else {
                VStack(spacing: 4) {
                    Text("✨")
                        .font(.title2)
                    Text("No quests today")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            
            Spacer(minLength: 0)
        }
        .padding()
    }
}

struct SmallTaskRow: View {
    let task: WidgetTask
    
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: task.completed ? "checkmark.circle.fill" : "circle")
                .foregroundColor(task.completed ? .green : .gray)
                .font(.caption)
            Text(task.text)
                .font(.caption2)
                .lineLimit(1)
                .strikethrough(task.completed)
                .foregroundColor(task.completed ? .secondary : .primary)
        }
    }
}

// MARK: - Medium Widget View

struct MediumWidgetView: View {
    let entry: TaskEntry
    
    private var completedCount: Int {
        entry.data?.completedCount ?? 0
    }
    
    private var totalCount: Int {
        entry.data?.totalCount ?? 0
    }
    
    private var progress: Double {
        totalCount > 0 ? Double(completedCount) / Double(totalCount) : 0
    }
    
    var body: some View {
        HStack(spacing: 16) {
            // Left side - tasks
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("⚔️ Today's Quests")
                        .font(.subheadline.bold())
                    Spacer()
                }
                
                if let tasks = entry.data?.tasks.prefix(5), !tasks.isEmpty {
                    ForEach(Array(tasks), id: \.id) { task in
                        Link(destination: URL(string: "cosmiq://task/\(task.id)")!) {
                            TaskRowView(task: task)
                        }
                    }
                } else {
                    Text("No quests scheduled")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer(minLength: 0)
            }
            
            // Right side - progress
            VStack(spacing: 8) {
                ProgressCircleView(
                    completed: completedCount,
                    total: totalCount
                )
                
                VStack(spacing: 2) {
                    Text("\(completedCount)/\(totalCount)")
                        .font(.caption.bold())
                    Text("Done")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            .frame(width: 70)
        }
        .padding()
    }
}

struct TaskRowView: View {
    let task: WidgetTask
    
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: task.completed ? "checkmark.circle.fill" : "circle")
                .foregroundColor(task.isMainQuest ? .yellow : (task.completed ? .green : .gray))
                .font(.caption)
            
            Text(task.text)
                .font(.caption)
                .lineLimit(1)
                .strikethrough(task.completed)
                .foregroundColor(task.completed ? .secondary : .primary)
            
            if task.isMainQuest {
                Text("⭐")
                    .font(.caption2)
            }
            
            Spacer()
            
            Text("+\(task.xpReward)")
                .font(.caption2)
                .foregroundColor(.orange)
        }
    }
}

// MARK: - Large Widget View

struct LargeWidgetView: View {
    let entry: TaskEntry
    
    private var completedCount: Int {
        entry.data?.completedCount ?? 0
    }
    
    private var totalCount: Int {
        entry.data?.totalCount ?? 0
    }
    
    private var morningTasks: [WidgetTask] {
        entry.data?.tasks.filter { $0.section == "morning" } ?? []
    }
    
    private var afternoonTasks: [WidgetTask] {
        entry.data?.tasks.filter { $0.section == "afternoon" } ?? []
    }
    
    private var eveningTasks: [WidgetTask] {
        entry.data?.tasks.filter { $0.section == "evening" } ?? []
    }
    
    private var unscheduledTasks: [WidgetTask] {
        entry.data?.tasks.filter { $0.section == "unscheduled" } ?? []
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header with progress
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("⚔️ Daily Quests")
                        .font(.headline.bold())
                    Text(formattedDate)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                HStack(spacing: 8) {
                    ProgressCircleView(completed: completedCount, total: totalCount)
                        .frame(width: 40, height: 40)
                    
                    VStack(alignment: .leading, spacing: 0) {
                        Text("\(completedCount)/\(totalCount)")
                            .font(.subheadline.bold())
                        Text("Complete")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            Divider()
            
            // Sections
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if !morningTasks.isEmpty {
                        TaskSectionView(title: "🌅 Morning", tasks: morningTasks)
                    }
                    
                    if !afternoonTasks.isEmpty {
                        TaskSectionView(title: "☀️ Afternoon", tasks: afternoonTasks)
                    }
                    
                    if !eveningTasks.isEmpty {
                        TaskSectionView(title: "🌙 Evening", tasks: eveningTasks)
                    }
                    
                    if !unscheduledTasks.isEmpty {
                        TaskSectionView(title: "📋 Anytime", tasks: unscheduledTasks)
                    }
                }
            }
            
            Spacer(minLength: 0)
        }
        .padding()
    }
    
    private var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMM d"
        return formatter.string(from: Date())
    }
}

struct TaskSectionView: View {
    let title: String
    let tasks: [WidgetTask]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.bold())
                .foregroundColor(.secondary)
            
            ForEach(tasks.prefix(3), id: \.id) { task in
                Link(destination: URL(string: "cosmiq://task/\(task.id)")!) {
                    TaskRowView(task: task)
                }
            }
        }
    }
}

// MARK: - Progress Circle

struct ProgressCircleView: View {
    let completed: Int
    let total: Int
    
    private var progress: Double {
        total > 0 ? Double(completed) / Double(total) : 0
    }
    
    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.gray.opacity(0.3), lineWidth: 4)
            
            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    progress >= 1.0 ? Color.green : Color.orange,
                    style: StrokeStyle(lineWidth: 4, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut, value: progress)
            
            Text("\(Int(progress * 100))%")
                .font(.system(size: 10, weight: .bold))
        }
        .frame(width: 50, height: 50)
    }
}
