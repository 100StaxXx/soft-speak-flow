import Foundation
import Capacitor
import EventKit

@objc(NativeCalendarPlugin)
public class NativeCalendarPlugin: CAPPlugin, CAPBridgedPlugin {
    // CAPBridgedPlugin conformance
    public let identifier = "NativeCalendarPlugin"
    public let jsName = "NativeCalendar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listCalendars", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listEvents", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestReminderPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listReminderLists", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listReminders", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getReminder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateReminder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "findOrCreateReminder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createOrUpdateEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteEvent", returnType: CAPPluginReturnPromise)
    ]

    private let eventStore = EKEventStore()
    private var reminderExportsInFlight = Set<String>()

    private func eventIdentity(_ event: EKEvent) -> String {
        let base = event.eventIdentifier ?? event.calendarItemIdentifier
        return event.hasRecurrenceRules ? "\(base)::cosmiq-occurrence::\(Int64(event.startDate.timeIntervalSince1970 * 1000))" : base
    }

    private func resolveEvent(_ identity: String) -> EKEvent? {
        let parts = identity.components(separatedBy: "::cosmiq-occurrence::")
        guard let base = eventStore.event(withIdentifier: parts[0]) else { return nil }
        guard parts.count == 2, let milliseconds = Double(parts[1]) else { return base }
        let start = Date(timeIntervalSince1970: milliseconds / 1000)
        let predicate = eventStore.predicateForEvents(withStart: start.addingTimeInterval(-1), end: start.addingTimeInterval(1), calendars: [base.calendar])
        return eventStore.events(matching: predicate).first { $0.eventIdentifier == base.eventIdentifier && abs($0.startDate.timeIntervalSince(start)) < 1 }
    }

    // MARK: - Helpers
    private func hasCalendarAccess() -> Bool {
        let status = EKEventStore.authorizationStatus(for: .event)
        if #available(iOS 17.0, *) {
            return status == .authorized || status == .fullAccess
        } else {
            return status == .authorized
        }
    }

    private func parseIsoDate(_ value: String) -> Date? {
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractionalFormatter.date(from: value) {
            return date
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }

    private func modificationToken(_ date: Date?) -> String {
        // Keep the full timestamp precision; second-only dates can miss rapid edits.
        return date.map { String($0.timeIntervalSince1970) } ?? ""
    }

    // MARK: - Plugin Methods
    private func hasReminderAccess() -> Bool {
        let status = EKEventStore.authorizationStatus(for: .reminder)
        if #available(iOS 17.0, *) { return status == .fullAccess || status == .authorized }
        return status == .authorized
    }

    @objc public func requestReminderPermissions(_ call: CAPPluginCall) {
        let completion: (Bool, Error?) -> Void = { granted, error in
            if let error = error { call.reject("Reminder access failed", nil, error) }
            else { call.resolve(["granted": granted]) }
        }
        if #available(iOS 17.0, *) { eventStore.requestFullAccessToReminders(completion: completion) }
        else { eventStore.requestAccess(to: .reminder, completion: completion) }
    }

    private func reminderPayload(_ reminder: EKReminder) -> [String: Any] {
        var result: [String: Any] = ["id": reminder.calendarItemIdentifier,
            "listId": reminder.calendar.calendarIdentifier, "title": reminder.title ?? "Untitled",
            "notes": reminder.notes ?? "", "completed": reminder.isCompleted,
            "etag": modificationToken(reminder.lastModifiedDate)]
        if let due = reminder.dueDateComponents, let year = due.year, let month = due.month, let day = due.day {
            result["dueDate"] = String(format: "%04d-%02d-%02d", year, month, day)
        } else { result["dueDate"] = NSNull() }
        return result
    }

    @objc public func listReminderLists(_ call: CAPPluginCall) {
        guard hasReminderAccess() else { call.reject("Approve Reminders access first"); return }
        call.resolve(["lists": eventStore.calendars(for: .reminder).map { ["id": $0.calendarIdentifier, "title": $0.title,
            "readOnly": !$0.allowsContentModifications] as [String: Any] }])
    }

    @objc public func listReminders(_ call: CAPPluginCall) {
        guard hasReminderAccess() else { call.reject("Approve Reminders access first"); return }
        guard let id = call.getString("listId"), let calendar = eventStore.calendar(withIdentifier: id) else { call.reject("Choose a reminder list"); return }
        let predicate = eventStore.predicateForReminders(in: [calendar])
        eventStore.fetchReminders(matching: predicate) { reminders in
            call.resolve(["tasks": (reminders ?? []).map { self.reminderPayload($0) }])
        }
    }

    @objc public func getReminder(_ call: CAPPluginCall) {
        guard hasReminderAccess() else { call.reject("Approve Reminders access first"); return }
        guard let id = call.getString("id") else { call.reject("Reminder id required"); return }
        let reminder = eventStore.calendarItem(withIdentifier: id) as? EKReminder
        call.resolve(["task": reminder.map { reminderPayload($0) } ?? NSNull() as Any])
    }

    @objc public func findOrCreateReminder(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.hasReminderAccess() else { call.reject("Approve Reminders access first"); return }
            guard let intent = call.getString("intentId"), UUID(uuidString: intent) != nil,
                  let listId = call.getString("listId"), let calendar = self.eventStore.calendar(withIdentifier: listId),
                  calendar.allowedEntityTypes.contains(.reminder) else { call.reject("Choose a reminder list"); return }
            guard !self.reminderExportsInFlight.contains(intent) else { call.reject("This reminder is already being checked. Try again shortly."); return }
            self.reminderExportsInFlight.insert(intent)
            let marker = "cosmiq://task-export/\(intent.lowercased())"
            let predicate = self.eventStore.predicateForReminders(in: [calendar])
            self.eventStore.fetchReminders(matching: predicate) { reminders in
                DispatchQueue.main.async {
                    defer { self.reminderExportsInFlight.remove(intent) }
                    guard self.hasReminderAccess(), let reminders = reminders else { call.reject("Could not check Reminders. No new copy was sent."); return }
                    let matches = reminders.filter { $0.url?.absoluteString == marker }
                    guard matches.count <= 1 else { call.reject("Multiple matching reminders exist. Review them in Reminders first."); return }
                    if let existing = matches.first { call.resolve(["task": self.reminderPayload(existing)]); return }
                    guard call.getBool("createIfMissing") == true else { call.resolve(["task": NSNull()]); return }
                    guard calendar.allowsContentModifications else { call.reject("This reminder list is read-only"); return }
                    guard let title = call.getString("title"), !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                          title.count <= 1024, let completed = call.getBool("completed") else { call.reject("Valid task details are required"); return }
                    var dueComponents: DateComponents? = nil
                    if let due = call.getString("dueDate") {
                        let parts = due.split(separator: "-").compactMap { Int($0) }
                        guard parts.count == 3, due.range(of: "^\\d{4}-\\d{2}-\\d{2}$", options: .regularExpression) != nil else { call.reject("Invalid due date"); return }
                        let gregorian = Calendar(identifier: .gregorian)
                        let components = DateComponents(calendar: gregorian, year: parts[0], month: parts[1], day: parts[2])
                        guard let date = gregorian.date(from: components), gregorian.component(.year, from: date) == parts[0],
                              gregorian.component(.month, from: date) == parts[1], gregorian.component(.day, from: date) == parts[2]
                            else { call.reject("Invalid due date"); return }
                        dueComponents = components
                    }
                    let reminder = EKReminder(eventStore: self.eventStore)
                    reminder.calendar = calendar
                    reminder.title = title
                    reminder.notes = call.getString("notes")
                    reminder.dueDateComponents = dueComponents
                    reminder.isCompleted = completed
                    reminder.url = URL(string: marker)
                    do {
                        try self.eventStore.save(reminder, commit: true)
                        call.resolve(["task": self.reminderPayload(reminder)])
                    } catch { call.reject("Sending could not be confirmed. Check status before trying again.", nil, error) }
                }
            }
        }
    }

    @objc public func updateReminder(_ call: CAPPluginCall) {
        guard hasReminderAccess() else { call.reject("Approve Reminders access first"); return }
        guard let id = call.getString("id"), let reminder = eventStore.calendarItem(withIdentifier: id) as? EKReminder else { call.reject("Reminder is missing. Your quest is retained."); return }
        guard reminder.calendar.allowsContentModifications else { call.reject("This reminder list is read-only"); return }
        let actual = modificationToken(reminder.lastModifiedDate)
        guard let etag = call.getString("etag"), !etag.isEmpty, etag == actual else { call.reject("Reminder changed elsewhere. Refresh and retry."); return }
        guard let title = call.getString("title"), !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { call.reject("Title is required"); return }
        var dueComponents: DateComponents? = nil
        if let due = call.getString("dueDate") {
            let parts = due.split(separator: "-").compactMap { Int($0) }
            guard parts.count == 3, due.range(of: "^\\d{4}-\\d{2}-\\d{2}$", options: .regularExpression) != nil else { call.reject("Invalid due date"); return }
            let calendar = Calendar(identifier: .gregorian)
            let components = DateComponents(calendar: calendar, year: parts[0], month: parts[1], day: parts[2])
            guard let date = calendar.date(from: components), calendar.component(.year, from: date) == parts[0],
                  calendar.component(.month, from: date) == parts[1], calendar.component(.day, from: date) == parts[2]
                else { call.reject("Invalid due date"); return }
            dueComponents = components
        }
        guard let completed = call.getBool("completed") else { call.reject("Completion state is required"); return }
        // Validate every field before changing the EventKit object.
        reminder.title = title
        reminder.isCompleted = completed
        reminder.dueDateComponents = dueComponents
        do { try eventStore.save(reminder, commit: true); call.resolve() }
        catch { call.reject("Could not update reminder", nil, error) }
    }

    @objc public func getEvent(_ call: CAPPluginCall) {
        guard hasCalendarAccess() else { call.reject("Calendar access not granted"); return }
        guard let id = call.getString("eventId") else { call.reject("eventId is required"); return }
        guard let event = resolveEvent(id) else { call.resolve(["event": NSNull()]); return }
        let iso = ISO8601DateFormatter()
        let dateOnly = DateFormatter()
        dateOnly.calendar = Calendar(identifier: .gregorian)
        dateOnly.locale = Locale(identifier: "en_US_POSIX")
        dateOnly.timeZone = event.timeZone ?? .current
        dateOnly.dateFormat = "yyyy-MM-dd"
        call.resolve(["event": ["id": id, "title": event.title ?? "Busy",
            "startDate": event.isAllDay ? dateOnly.string(from: event.startDate) : iso.string(from: event.startDate),
            "endDate": event.isAllDay ? dateOnly.string(from: event.endDate) : iso.string(from: event.endDate),
            "isAllDay": event.isAllDay, "calendarId": event.calendar.calendarIdentifier,
            "calendarName": event.calendar.title, "location": event.location ?? "",
            "notes": event.notes ?? "", "isRecurring": event.hasRecurrenceRules,
            "modifiedAt": modificationToken(event.lastModifiedDate)]])
    }

    @objc public func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    @objc public override func requestPermissions(_ call: CAPPluginCall) {
        if #available(iOS 17.0, *) {
            eventStore.requestFullAccessToEvents { granted, error in
                if let error = error {
                    call.reject("Calendar permission request failed", nil, error)
                    return
                }
                call.resolve(["granted": granted])
            }
        } else {
            eventStore.requestAccess(to: .event) { granted, error in
                if let error = error {
                    call.reject("Calendar permission request failed", nil, error)
                    return
                }
                call.resolve(["granted": granted])
            }
        }
    }

    @objc public func listCalendars(_ call: CAPPluginCall) {
        guard hasCalendarAccess() else {
            call.resolve(["calendars": []])
            return
        }

        let defaultId = eventStore.defaultCalendarForNewEvents?.calendarIdentifier
        let calendars = eventStore.calendars(for: .event).map { calendar in
            return [
                "id": calendar.calendarIdentifier,
                "title": calendar.title,
                "readOnly": !calendar.allowsContentModifications,
                "isPrimary": calendar.calendarIdentifier == defaultId
            ] as [String : Any]
        }

        call.resolve(["calendars": calendars])
    }

    @objc public func listEvents(_ call: CAPPluginCall) {
        guard hasCalendarAccess() else {
            call.reject("Calendar access not granted")
            return
        }

        guard let calendarId = call.getString("calendarId"),
              let startDateString = call.getString("startDate"),
              let endDateString = call.getString("endDate") else {
            call.reject("calendarId, startDate, and endDate are required")
            return
        }

        guard let calendar = eventStore.calendar(withIdentifier: calendarId) else {
            call.reject("Calendar not found")
            return
        }

        guard let startDate = parseIsoDate(startDateString),
              let endDate = parseIsoDate(endDateString),
              endDate > startDate else {
            call.reject("Invalid calendar event range")
            return
        }

        let predicate = eventStore.predicateForEvents(
            withStart: startDate,
            end: endDate,
            calendars: [calendar]
        )
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let events = eventStore.events(matching: predicate).map { event in
            let dayFormatter = DateFormatter()
            dayFormatter.locale = Locale(identifier: "en_US_POSIX")
            dayFormatter.calendar = Calendar(identifier: .gregorian)
            dayFormatter.timeZone = event.timeZone ?? TimeZone.current
            dayFormatter.dateFormat = "yyyy-MM-dd"
            var payload = [
                "id": eventIdentity(event),
                "title": event.title ?? "Busy",
                "startDate": event.isAllDay ? dayFormatter.string(from: event.startDate) : formatter.string(from: event.startDate),
                "endDate": event.isAllDay ? dayFormatter.string(from: event.endDate) : formatter.string(from: event.endDate),
                "isAllDay": event.isAllDay,
                "calendarId": calendar.calendarIdentifier,
                "calendarName": calendar.title,
                "isRecurring": event.hasRecurrenceRules,
                "notes": event.notes ?? ""
            ] as [String : Any]

            if let location = event.location {
                payload["location"] = location
            }
            if let htmlLink = event.url?.absoluteString {
                payload["htmlLink"] = htmlLink
            }

            return payload
        }

        call.resolve(["events": events])
    }

    @objc public func createOrUpdateEvent(_ call: CAPPluginCall) {
        guard hasCalendarAccess() else {
            call.reject("Calendar access not granted")
            return
        }

        guard let calendarId = call.getString("calendarId"),
              let title = call.getString("title"),
              let startDateString = call.getString("startDate"),
              let endDateString = call.getString("endDate") else {
            call.reject("calendarId, title, startDate, and endDate are required")
            return
        }

        guard let calendar = eventStore.calendar(withIdentifier: calendarId) else {
            call.reject("Calendar not found")
            return
        }

        guard let startDate = parseIsoDate(startDateString),
              let endDate = parseIsoDate(endDateString) else {
            call.reject("Invalid startDate or endDate format")
            return
        }

        guard calendar.allowsContentModifications else {
            call.reject("This calendar is read-only. Choose a writable calendar in Preferences.")
            return
        }

        let event: EKEvent
        if let eventId = call.getString("eventId") {
            guard let existing = resolveEvent(eventId) else {
                call.reject("The original event is missing. The quest has been kept."); return
            }
            if let expected = call.getString("expectedModifiedAt") {
                guard !expected.isEmpty, modificationToken(existing.lastModifiedDate) == expected else {
                    call.reject("This event changed elsewhere. Refresh before syncing."); return
                }
            }
            event = existing
        } else {
            event = EKEvent(eventStore: eventStore)
        }

        event.calendar = calendar
        event.title = title
        event.startDate = startDate
        event.endDate = endDate
        event.isAllDay = call.getBool("isAllDay") ?? false
        event.location = call.getString("location")
        event.notes = call.getString("notes")

        // Recurrence is set only for a new series. Updates target one occurrence and
        // preserve the series/alarms unless a caller explicitly edits those fields.
        if call.getString("eventId") == nil, let recurrence = call.getObject("recurrence") {
            let name = recurrence["frequency"] as? String ?? ""
            let frequency: EKRecurrenceFrequency
            switch name { case "daily": frequency = .daily; case "weekly": frequency = .weekly;
            case "monthly": frequency = .monthly; case "yearly": frequency = .yearly;
            default: call.reject("Unsupported repeat pattern"); return }
            let weekdays = (recurrence["weekdays"] as? [Int] ?? []).compactMap { value -> EKRecurrenceDayOfWeek? in
                guard (0...6).contains(value), let day = EKWeekday(rawValue: value + 1) else { return nil }
                return EKRecurrenceDayOfWeek(day)
            }
            let monthDays = (recurrence["monthDays"] as? [Int] ?? []).filter { (1...31).contains($0) }.map { NSNumber(value: $0) }
            event.recurrenceRules = [EKRecurrenceRule(recurrenceWith: frequency, interval: 1,
                daysOfTheWeek: weekdays.isEmpty ? nil : weekdays, daysOfTheMonth: monthDays.isEmpty ? nil : monthDays,
                monthsOfTheYear: nil, weeksOfTheYear: nil, daysOfTheYear: nil, setPositions: nil, end: nil)]
        }
        if let minutes = call.getInt("reminderMinutes"), (0...10080).contains(minutes) {
            event.alarms = [EKAlarm(relativeOffset: -Double(minutes * 60))]
        }

        do {
            try eventStore.save(event, span: .thisEvent, commit: true)
            call.resolve(["eventId": eventIdentity(event)])
        } catch {
            call.reject("Failed to save calendar event", nil, error)
        }
    }

    @objc public func deleteEvent(_ call: CAPPluginCall) {
        guard let eventId = call.getString("eventId") else {
            call.reject("eventId is required")
            return
        }

        guard let event = resolveEvent(eventId) else {
            call.resolve(["success": true])
            return
        }

        do {
            try eventStore.remove(event, span: .thisEvent, commit: true)
            call.resolve(["success": true])
        } catch {
            call.reject("Failed to delete calendar event", nil, error)
        }
    }
}
