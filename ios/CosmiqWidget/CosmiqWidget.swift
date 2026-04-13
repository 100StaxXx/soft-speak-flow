import WidgetKit
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

// MARK: - Cosmic Color Palette

extension Color {
    static let cosmicBackground = Color(red: 0.05, green: 0.02, blue: 0.15)
    static let cosmicPurple = Color(red: 0.55, green: 0.36, blue: 0.95)
    static let cosmicGold = Color(red: 0.95, green: 0.75, blue: 0.30)
    static let cosmicText = Color.white
    static let cosmicSecondary = Color.white.opacity(0.72)
    static let cosmicGreen = Color(red: 0.4, green: 0.9, blue: 0.5)
    static let profileWidgetBase = Color(red: 0.08, green: 0.10, blue: 0.14)
    static let profileWidgetMid = Color(red: 0.12, green: 0.15, blue: 0.20)
    static let profileWidgetEdge = Color(red: 0.18, green: 0.22, blue: 0.28)
    static let profileWidgetHighlight = Color(red: 0.75, green: 0.83, blue: 0.88)
    static let profileWidgetGlow = Color(red: 0.30, green: 0.43, blue: 0.50)
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
            if let wallpaperImage {
                Image(uiImage: wallpaperImage)
                    .resizable()
                    .scaledToFill()
            } else {
                ProfileWidgetFallbackBackground()
            }

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

    private var wallpaperImage: UIImage? {
        guard
            let fileURL = WidgetDataManager.shared.profileWallpaperFileURL(
                for: entry.data?.profileWallpaperRelativePath
            )
        else {
            return nil
        }

        return UIImage(contentsOfFile: fileURL.path)
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
