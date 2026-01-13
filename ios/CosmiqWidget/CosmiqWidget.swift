import WidgetKit
import SwiftUI

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
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                CosmiqWidgetEntryView(entry: entry)
                    .padding()
                    .background(Color(UIColor.systemBackground))
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
