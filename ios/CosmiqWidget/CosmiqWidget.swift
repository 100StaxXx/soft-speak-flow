import WidgetKit
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

// MARK: - Product Color Palette

extension Color {
    // These names remain stable because older widget code references them.
#if COSMIQ_PRODUCT
    static let cosmicBackground = Color(red: 0.03, green: 0.06, blue: 0.12)
    static let cosmicPurple = Color(red: 0.55, green: 0.34, blue: 0.96)
    static let cosmicGold = Color(red: 0.98, green: 0.64, blue: 0.19)
    static let cosmicText = Color(red: 0.97, green: 0.98, blue: 1.0)
    static let cosmicSecondary = Color(red: 0.72, green: 0.76, blue: 0.88).opacity(0.82)
    static let cosmicGreen = Color(red: 0.20, green: 0.82, blue: 0.68)
    static let profileWidgetBase = Color(red: 0.03, green: 0.05, blue: 0.11)
    static let profileWidgetMid = Color(red: 0.12, green: 0.06, blue: 0.25)
    static let profileWidgetEdge = Color(red: 0.03, green: 0.25, blue: 0.35)
    static let profileWidgetHighlight = Color(red: 0.57, green: 0.91, blue: 0.95)
    static let profileWidgetGlow = Color(red: 0.55, green: 0.34, blue: 0.96)
#else
    static let cosmicBackground = Color(red: 0.09, green: 0.20, blue: 0.12)
    static let cosmicPurple = Color(red: 0.45, green: 0.65, blue: 0.46)
    static let cosmicGold = Color(red: 0.84, green: 0.70, blue: 0.36)
    static let cosmicText = Color(red: 0.98, green: 0.97, blue: 0.92)
    static let cosmicSecondary = Color(red: 0.90, green: 0.92, blue: 0.86).opacity(0.78)
    static let cosmicGreen = Color(red: 0.58, green: 0.75, blue: 0.57)
    static let profileWidgetBase = Color(red: 0.08, green: 0.18, blue: 0.11)
    static let profileWidgetMid = Color(red: 0.12, green: 0.28, blue: 0.16)
    static let profileWidgetEdge = Color(red: 0.21, green: 0.39, blue: 0.23)
    static let profileWidgetHighlight = Color(red: 0.93, green: 0.84, blue: 0.58)
    static let profileWidgetGlow = Color(red: 0.46, green: 0.66, blue: 0.46)
#endif
}

// MARK: - Widget Background

struct ProfileWidgetFallbackBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    .profileWidgetBase,
                    .profileWidgetMid,
                    .profileWidgetEdge
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            RadialGradient(
                colors: [
                    .profileWidgetHighlight.opacity(0.16),
                    .clear
                ],
                center: .topLeading,
                startRadius: 0,
                endRadius: 180
            )

            RadialGradient(
                colors: [
                    .profileWidgetGlow.opacity(0.22),
                    .clear
                ],
                center: UnitPoint(x: 0.86, y: 0.82),
                startRadius: 0,
                endRadius: 210
            )
        }
    }
}

struct ProfileWidgetBackground: View {
    let entry: TaskEntry

    var body: some View {
        ZStack {
            ProfileWidgetFallbackBackground()

            LinearGradient(
                colors: [
                    Color.black.opacity(0.18),
                    Color.black.opacity(0.06),
                    Color.black.opacity(0.52)
                ],
                startPoint: .top,
                endPoint: .bottom
            )

            RadialGradient(
                colors: [
                    Color.white.opacity(0.08),
                    .clear
                ],
                center: .top,
                startRadius: 0,
                endRadius: 180
            )

            RadialGradient(
                colors: [
                    .profileWidgetGlow.opacity(0.18),
                    .clear
                ],
                center: UnitPoint(x: 0.84, y: 0.80),
                startRadius: 0,
                endRadius: 200
            )
        }
        .clipped()
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
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(15 * 60)
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
                        ProfileWidgetBackground(entry: entry)
                    }
            } else {
                CosmiqWidgetEntryView(entry: entry)
                    .padding()
                    .background(ProfileWidgetBackground(entry: entry))
            }
        }
        .configurationDisplayName(NativeProduct.widgetDisplayName)
        .description(NativeProduct.widgetDescription)
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
