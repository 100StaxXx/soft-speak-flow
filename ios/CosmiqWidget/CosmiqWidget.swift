import WidgetKit
import SwiftUI

// MARK: - Cosmic Color Palette

extension Color {
    static let cosmicBackground = Color(red: 0.05, green: 0.02, blue: 0.15)
    static let cosmicBackgroundEnd = Color(red: 0.08, green: 0.04, blue: 0.20)
    static let cosmicPurple = Color(red: 0.55, green: 0.36, blue: 0.95)
    static let cosmicGold = Color(red: 0.95, green: 0.75, blue: 0.30)
    static let cosmicText = Color.white
    static let cosmicSecondary = Color.white.opacity(0.6)
    static let cosmicGreen = Color(red: 0.4, green: 0.9, blue: 0.5)
}

// MARK: - Cosmic Background Gradient

struct CosmicGradientBackground: View {
    var body: some View {
        LinearGradient(
            colors: [
                Color.cosmicBackground,
                Color.cosmicBackgroundEnd
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

/// Timeline entry containing task data for a specific point in time
struct TaskEntry: TimelineEntry {
    let date: Date
    let data: WidgetTaskData?
}

/// Timeline provider that supplies widget content
struct Provider: TimelineProvider {
    
    func placeholder(in context: Context) -> TaskEntry {
        TaskEntry(date: Date(), data: WidgetDataManager.shared.getPlaceholderData())
    }

    func getSnapshot(in context: Context, completion: @escaping (TaskEntry) -> ()) {
        let data = WidgetDataManager.shared.loadData() ?? WidgetDataManager.shared.getPlaceholderData()
        completion(TaskEntry(date: Date(), data: data))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TaskEntry>) -> ()) {
        let data = WidgetDataManager.shared.loadData()
        let entry = TaskEntry(date: Date(), data: data)
        
        // Refresh every 15 minutes to stay current
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

/// Main widget definition
@main
struct CosmiqWidget: Widget {
    let kind: String = "CosmiqWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            if #available(iOS 17.0, *) {
                CosmiqWidgetEntryView(entry: entry)
                    .containerBackground(for: .widget) {
                        CosmicGradientBackground()
                    }
            } else {
                CosmiqWidgetEntryView(entry: entry)
                    .padding()
                    .background(CosmicGradientBackground())
            }
        }
        .configurationDisplayName("Cosmiq Quests")
        .description("View your daily quests and track progress.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

/// Entry view that selects the appropriate widget size
struct CosmiqWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: Provider.Entry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(entry: entry)
        case .systemMedium:
            MediumWidgetView(entry: entry)
        case .systemLarge:
            LargeWidgetView(entry: entry)
        default:
            SmallWidgetView(entry: entry)
        }
    }
}

// MARK: - Preview Provider

struct CosmiqWidget_Previews: PreviewProvider {
    static var previews: some View {
        let entry = TaskEntry(date: Date(), data: WidgetDataManager.shared.getPlaceholderData())
        
        Group {
            CosmiqWidgetEntryView(entry: entry)
                .previewContext(WidgetPreviewContext(family: .systemSmall))
                .previewDisplayName("Small")
            
            CosmiqWidgetEntryView(entry: entry)
                .previewContext(WidgetPreviewContext(family: .systemMedium))
                .previewDisplayName("Medium")
            
            CosmiqWidgetEntryView(entry: entry)
                .previewContext(WidgetPreviewContext(family: .systemLarge))
                .previewDisplayName("Large")
        }
    }
}
