import SwiftUI
import WidgetKit

private let todayDeepLinkURL = URL(string: "\(NativeProduct.urlScheme)://today")!

private struct DailyPracticeWidgetContent: View {
    let entry: TaskEntry
    let family: WidgetFamily

    private var practice: WidgetTask? {
        entry.data?.tasks.first
    }

    private var isCompact: Bool {
        family == .systemSmall
    }

    private var practiceText: String {
        practice?.text ?? NativeProduct.emptyPrompt
    }

    private var statusText: String {
        guard let practice else { return "Ready when you are" }
        return practice.completed ? "Completed" : "Ready when you are"
    }

    var body: some View {
        Link(destination: todayDeepLinkURL) {
            VStack(alignment: .leading, spacing: isCompact ? 8 : 12) {
                HStack(spacing: 6) {
                    Text("✝︎")
                        .font(isCompact ? .caption : .subheadline)
                    Text(NativeProduct.dailyLabel)
                        .font(.system(size: isCompact ? 9 : 11, weight: .bold))
                        .tracking(1.1)
                        .foregroundColor(.cosmicSecondary)
                    Spacer(minLength: 0)
                }

                Text(practiceText)
                    .font(isCompact ? .system(size: 15, weight: .semibold) : .title3.weight(.semibold))
                    .foregroundColor(.cosmicText)
                    .lineLimit(isCompact ? 4 : 5)
                    .minimumScaleFactor(0.82)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Spacer(minLength: 0)

                HStack(spacing: 7) {
                    Image(systemName: practice?.completed == true ? "checkmark.circle.fill" : "leaf.fill")
                        .foregroundColor(practice?.completed == true ? .cosmicGold : .cosmicGreen)
                    Text(statusText)
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.cosmicSecondary)
                    Spacer(minLength: 0)
                    if !isCompact {
                        Text("Open \(NativeProduct.name)")
                            .font(.caption2.weight(.semibold))
                            .foregroundColor(.cosmicText)
                    }
                }
            }
            .padding(isCompact ? 4 : 8)
        }
    }
}

struct SmallWidgetView: View {
    let entry: TaskEntry

    var body: some View {
        DailyPracticeWidgetContent(entry: entry, family: .systemSmall)
    }
}

struct MediumWidgetView: View {
    let entry: TaskEntry

    var body: some View {
        DailyPracticeWidgetContent(entry: entry, family: .systemMedium)
    }
}

struct LargeWidgetView: View {
    let entry: TaskEntry

    var body: some View {
        DailyPracticeWidgetContent(entry: entry, family: .systemLarge)
    }
}
