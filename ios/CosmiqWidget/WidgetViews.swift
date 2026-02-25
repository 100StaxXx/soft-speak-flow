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
    
    private var visibleTasks: [WidgetTask] {
        Array((entry.data?.tasks ?? []).prefix(4))
    }

    private var remainingTaskCount: Int {
        max((entry.data?.tasks.count ?? 0) - visibleTasks.count, 0)
    }

    private var progress: Double {
        guard totalCount > 0 else {
            return 0
        }
        return min(max(Double(completedCount) / Double(totalCount), 0), 1)
    }
    private var remainingCount: Int {
        max(totalCount - completedCount, 0)
    }

    private var progressSummaryText: String {
        guard totalCount > 0 else {
            return "No quests tracked"
        }
        return "\(completedCount)/\(totalCount) complete"
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("⚔️")
                    .font(.caption)
                Text("Today")
                    .font(.caption.bold())
                    .foregroundColor(.cosmicText)
                Spacer()
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Text(progressSummaryText)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(.cosmicSecondary)

                    Spacer()

                    if totalCount > 0 {
                        Text("\(remainingCount) left")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(.cosmicSecondary)
                    }
                }

                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.cosmicPurple.opacity(0.22))

                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: progress >= 1
                                    ? [.cosmicGold, .cosmicGold.opacity(0.8)]
                                    : [.cosmicPurple, .cosmicGold],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .scaleEffect(x: progress, y: 1, anchor: .leading)
                }
                .frame(height: 6)
            }
            
            if visibleTasks.isEmpty {
                Text("No quests today")
                    .font(.caption2)
                    .foregroundColor(.cosmicSecondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            } else {
                VStack(alignment: .leading, spacing: 3) {
                    ForEach(visibleTasks, id: \.id) { task in
                        CosmicTaskLinkRow(
                            task: task,
                            compact: true,
                            showsMainQuestBadge: false
                        )
                    }

                    if remainingTaskCount > 0 {
                        Text("+\(remainingTaskCount) more")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(.cosmicSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
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
                        CosmicTaskLinkRow(
                            task: task,
                            showsTime: true,
                            showsMainQuestBadge: false
                        )
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
                    Text("Progress")
                        .font(.caption2)
                        .foregroundColor(.cosmicSecondary)
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
                        Text("Progress")
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
                        CosmicTaskSection(
                            title: item.element.title,
                            tasks: item.element.tasks,
                            showsTime: true
                        )
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
    var showsTime: Bool = false
    var compact: Bool = false
    var showsMainQuestBadge: Bool = false
    
    var body: some View {
        HStack(spacing: compact ? 4 : 6) {
            // Cosmic checkbox
            ZStack {
                Circle()
                    .stroke(checkColor.opacity(0.5), lineWidth: 1.5)
                    .frame(width: compact ? 12 : 14, height: compact ? 12 : 14)
                
                if task.completed {
                    Circle()
                        .fill(checkColor)
                        .frame(width: compact ? 8 : 10, height: compact ? 8 : 10)
                    
                    Image(systemName: "checkmark")
                        .font(.system(size: compact ? 6 : 7, weight: .bold))
                        .foregroundColor(.cosmicBackground)
                }
            }

            if showsTime {
                Text(formattedTime)
                    .font(.system(size: compact ? 8 : 10, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .frame(width: compact ? 34 : 52, alignment: .leading)
                    .foregroundColor(.cosmicSecondary)
            }
            
            Text(task.text)
                .font(compact ? .system(size: 11) : .caption)
                .lineLimit(1)
                .truncationMode(.tail)
                .strikethrough(task.completed)
                .foregroundColor(task.completed ? .cosmicSecondary : .cosmicText)
                .frame(maxWidth: .infinity, alignment: .leading)
                .layoutPriority(1)
            
            if showsMainQuestBadge && task.isMainQuest && !compact {
                Text("⭐")
                    .font(.caption2)
            }
        }
    }
    
    private var checkColor: Color {
        if task.isMainQuest {
            return .cosmicGold
        }
        return task.completed ? .cosmicGreen : .cosmicPurple
    }

    private var formattedTime: String {
        WidgetTaskTimeFormatter.displayString(from: task.scheduledTime)
    }
}

// MARK: - Cosmic Task Section

struct CosmicTaskSection: View {
    let title: String
    let tasks: [WidgetTask]
    var showsTime: Bool = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.bold())
                .foregroundColor(.cosmicPurple)
            
            ForEach(tasks.prefix(3), id: \.id) { task in
                CosmicTaskLinkRow(task: task, showsTime: showsTime)
            }
        }
    }
}

struct CosmicTaskLinkRow: View {
    let task: WidgetTask
    var showsTime: Bool = false
    var compact: Bool = false
    var showsMainQuestBadge: Bool = false

    var body: some View {
        if let url = taskDeepLink(task.id) {
            Link(destination: url) {
                CosmicTaskRow(
                    task: task,
                    showsTime: showsTime,
                    compact: compact,
                    showsMainQuestBadge: showsMainQuestBadge
                )
            }
        } else {
            CosmicTaskRow(
                task: task,
                showsTime: showsTime,
                compact: compact,
                showsMainQuestBadge: showsMainQuestBadge
            )
        }
    }
}

// MARK: - Cosmic Progress Circle

struct CosmicProgressCircle: View {
    let completed: Int
    let total: Int
    var showsPercentage: Bool = true
    
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
            
            if showsPercentage {
                // Percentage text
                Text("\(Int(progress * 100))%")
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundColor(.cosmicText)
            }
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

private enum WidgetTaskTimeFormatter {
    static let displayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar.current
        formatter.locale = Locale.current
        formatter.timeZone = TimeZone.current
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

    static func displayString(from rawTime: String?) -> String {
        guard let rawTime else {
            return "Anytime"
        }

        let trimmed = rawTime.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return "Anytime"
        }

        let segments = trimmed.split(separator: ":")
        guard segments.count == 2 || segments.count == 3,
              let hour = Int(segments[0]),
              let minute = Int(segments[1]),
              (0...23).contains(hour),
              (0...59).contains(minute) else {
            return "Anytime"
        }

        let second: Int
        if segments.count == 3 {
            guard let parsedSecond = Int(segments[2]), (0...59).contains(parsedSecond) else {
                return "Anytime"
            }
            second = parsedSecond
        } else {
            second = 0
        }

        var components = DateComponents()
        components.calendar = Calendar.current
        components.timeZone = TimeZone.current
        components.year = 2000
        components.month = 1
        components.day = 1
        components.hour = hour
        components.minute = minute
        components.second = second

        guard let date = components.date else {
            return "Anytime"
        }

        return displayFormatter.string(from: date)
    }
}
