import SwiftUI
import WidgetKit

// MARK: - Small Widget View

struct SmallWidgetView: View {
    let entry: TaskEntry
    
    private var completedCount: Int {
        entry.data?.totalAllCompleted ?? 0
    }
    
    private var totalCount: Int {
        entry.data?.totalAllCount ?? 0
    }
    
    private var questCount: Int {
        entry.data?.totalCount ?? 0
    }
    
    private var ritualCount: Int {
        entry.data?.ritualCount ?? 0
    }
    
    var body: some View {
        VStack(spacing: 6) {
            // Header with extra top breathing room
            HStack {
                Text("⚔️")
                    .font(.caption)
                Text("Today")
                    .font(.caption.bold())
                    .foregroundColor(.cosmicText)
                Spacer()
            }
            .padding(.top, 4)
            
            Spacer()
            
            // Central progress circle
            CosmicProgressCircle(
                completed: completedCount,
                total: totalCount
            )
            .frame(width: 60, height: 60)
            
            // Combined count with quest/ritual breakdown
            VStack(spacing: 2) {
                Text("\(completedCount)/\(totalCount)")
                    .font(.subheadline.bold())
                    .foregroundColor(.cosmicGold)
                
                if ritualCount > 0 {
                    Text("\(questCount)Q • \(ritualCount)R")
                        .font(.system(size: 10))
                        .foregroundColor(.cosmicSecondary)
                } else if questCount > 0 {
                    Text("\(questCount) quests")
                        .font(.caption2)
                        .foregroundColor(.cosmicSecondary)
                } else {
                    Text("No tasks")
                        .font(.caption2)
                        .foregroundColor(.cosmicSecondary)
                }
            }
            
            Spacer()
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }
}

// MARK: - Medium Widget View

struct MediumWidgetView: View {
    let entry: TaskEntry
    
    private var completedCount: Int {
        entry.data?.totalAllCompleted ?? 0
    }
    
    private var totalCount: Int {
        entry.data?.totalAllCount ?? 0
    }
    
    private var questCount: Int {
        entry.data?.totalCount ?? 0
    }
    
    private var ritualCount: Int {
        entry.data?.ritualCount ?? 0
    }
    
    var body: some View {
        HStack(spacing: 16) {
            // Left side - tasks
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("⚔️")
                        .font(.subheadline)
                    Text("Today's Quests")
                        .font(.subheadline.bold())
                        .foregroundColor(.cosmicText)
                    Spacer()
                }
                
                if let tasks = entry.data?.tasks.prefix(4), !tasks.isEmpty {
                    ForEach(Array(tasks), id: \.id) { task in
                        CosmicTaskLinkRow(task: task)
                    }
                } else {
                    CosmicEmptyState()
                }
                
                Spacer(minLength: 0)
            }
            
            // Right side - progress
            VStack(spacing: 8) {
                CosmicProgressCircle(
                    completed: completedCount,
                    total: totalCount
                )
                .frame(width: 56, height: 56)
                
                VStack(spacing: 2) {
                    Text("\(completedCount)/\(totalCount)")
                        .font(.caption.bold())
                        .foregroundColor(.cosmicGold)
                    if ritualCount > 0 {
                        Text("\(questCount)Q • \(ritualCount)R")
                            .font(.system(size: 10))
                            .foregroundColor(.cosmicSecondary)
                    } else {
                        Text("Done")
                            .font(.caption2)
                            .foregroundColor(.cosmicSecondary)
                    }
                }
            }
            .frame(width: 70)
        }
        .padding()
    }
}

// MARK: - Large Widget View

struct LargeWidgetView: View {
    let entry: TaskEntry
    
    private var completedCount: Int {
        entry.data?.totalAllCompleted ?? 0
    }
    
    private var totalCount: Int {
        entry.data?.totalAllCount ?? 0
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

    private var sectionedTasks: [(title: String, tasks: [WidgetTask])] {
        [
            (title: "🌅 Morning", tasks: morningTasks),
            (title: "☀️ Afternoon", tasks: afternoonTasks),
            (title: "🌙 Evening", tasks: eveningTasks),
            (title: "📋 Anytime", tasks: unscheduledTasks)
        ]
    }

    private var visibleSections: [(title: String, tasks: [WidgetTask])] {
        sectionedTasks
            .filter { !$0.tasks.isEmpty }
            .prefix(3)
            .map { section in
                (title: section.title, tasks: Array(section.tasks.prefix(2)))
            }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header with progress
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text("⚔️")
                            .font(.headline)
                        Text("Daily Quests")
                            .font(.headline.bold())
                            .foregroundColor(.cosmicText)
                    }
                    Text(formattedDate)
                        .font(.caption)
                        .foregroundColor(.cosmicSecondary)
                }
                
                Spacer()
                
                HStack(spacing: 8) {
                    CosmicProgressCircle(completed: completedCount, total: totalCount)
                        .frame(width: 40, height: 40)
                    
                    VStack(alignment: .leading, spacing: 0) {
                        Text("\(completedCount)/\(totalCount)")
                            .font(.subheadline.bold())
                            .foregroundColor(.cosmicGold)
                        Text("Complete")
                            .font(.caption2)
                            .foregroundColor(.cosmicSecondary)
                    }
                }
            }
            
            // Divider with glow
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [.cosmicPurple.opacity(0.3), .cosmicPurple.opacity(0.6), .cosmicPurple.opacity(0.3)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(height: 1)
            
            // Sections (capped for deterministic WidgetKit layout)
            VStack(alignment: .leading, spacing: 10) {
                if visibleSections.isEmpty {
                    CosmicEmptyState()
                        .frame(maxWidth: .infinity)
                } else {
                    ForEach(Array(visibleSections.enumerated()), id: \.offset) { item in
                        CosmicTaskSection(title: item.element.title, tasks: item.element.tasks)
                    }
                }
            }
            
            Spacer(minLength: 0)
        }
        .padding()
    }
    
    private var formattedDate: String {
        Self.headerDateFormatter.string(from: Date())
    }

    private static let headerDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar.current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "EEEE, MMM d"
        return formatter
    }()
}

// MARK: - Cosmic Task Row

struct CosmicTaskRow: View {
    let task: WidgetTask
    
    var body: some View {
        HStack(spacing: 6) {
            // Cosmic checkbox
            ZStack {
                Circle()
                    .stroke(checkColor.opacity(0.5), lineWidth: 1.5)
                    .frame(width: 14, height: 14)
                
                if task.completed {
                    Circle()
                        .fill(checkColor)
                        .frame(width: 10, height: 10)
                    
                    Image(systemName: "checkmark")
                        .font(.system(size: 7, weight: .bold))
                        .foregroundColor(.cosmicBackground)
                }
            }
            
            Text(task.text)
                .font(.caption)
                .lineLimit(1)
                .strikethrough(task.completed)
                .foregroundColor(task.completed ? .cosmicSecondary : .cosmicText)
            
            if task.isMainQuest {
                Text("⭐")
                    .font(.caption2)
            }
            
            Spacer()
            
            Text("+\(task.xpReward)")
                .font(.caption)
                .foregroundColor(.cosmicGold)
        }
    }
    
    private var checkColor: Color {
        if task.isMainQuest {
            return .cosmicGold
        }
        return task.completed ? .cosmicGreen : .cosmicPurple
    }
}

// MARK: - Cosmic Task Section

struct CosmicTaskSection: View {
    let title: String
    let tasks: [WidgetTask]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.bold())
                .foregroundColor(.cosmicPurple)
            
            ForEach(tasks.prefix(3), id: \.id) { task in
                CosmicTaskLinkRow(task: task)
            }
        }
    }
}

struct CosmicTaskLinkRow: View {
    let task: WidgetTask

    var body: some View {
        if let url = taskDeepLink(task.id) {
            Link(destination: url) {
                CosmicTaskRow(task: task)
            }
        } else {
            CosmicTaskRow(task: task)
        }
    }
}

// MARK: - Cosmic Progress Circle

struct CosmicProgressCircle: View {
    let completed: Int
    let total: Int
    
    private var progress: Double {
        total > 0 ? Double(completed) / Double(total) : 0
    }
    
    var body: some View {
        ZStack {
            // Background ring
            Circle()
                .stroke(Color.cosmicPurple.opacity(0.2), lineWidth: 4)
            
            // Progress ring with gradient
            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    AngularGradient(
                        colors: progress >= 1.0 
                            ? [.cosmicGold, .cosmicGold.opacity(0.8)]
                            : [.cosmicPurple, .cosmicGold],
                        center: .center,
                        startAngle: .degrees(-90),
                        endAngle: .degrees(270)
                    ),
                    style: StrokeStyle(lineWidth: 4, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
            
            // Percentage text
            Text("\(Int(progress * 100))%")
                .font(.system(size: 10, weight: .bold, design: .rounded))
                .foregroundColor(.cosmicText)
        }
    }
}

// MARK: - Cosmic Empty State

struct CosmicEmptyState: View {
    var body: some View {
        VStack(spacing: 4) {
            Text("✨")
                .font(.title2)
            Text("No quests today")
                .font(.caption)
                .foregroundColor(.cosmicSecondary)
        }
        .padding(.vertical, 8)
    }
}

private func taskDeepLink(_ taskId: String) -> URL? {
    guard let encodedTaskId = taskId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
          !encodedTaskId.isEmpty else {
        return nil
    }
    return URL(string: "cosmiq://task/\(encodedTaskId)")
}
