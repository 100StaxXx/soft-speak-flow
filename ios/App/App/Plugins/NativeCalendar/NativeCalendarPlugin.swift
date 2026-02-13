import Foundation
import Capacitor
import EventKit

@objc(NativeCalendarPlugin)
public class NativeCalendarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeCalendarPlugin"
    public let jsName = "NativeCalendar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listCalendars", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createOrUpdateEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteEvent", returnType: CAPPluginReturnPromise)
    ]

    private let eventStore = EKEventStore()

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    @objc func requestPermissions(_ call: CAPPluginCall) {
        eventStore.requestAccess(to: .event) { granted, error in
            if let error = error {
                call.reject("Calendar permission request failed", nil, error)
                return
            }
            call.resolve(["granted": granted])
        }
    }

    @objc func listCalendars(_ call: CAPPluginCall) {
        let status = EKEventStore.authorizationStatus(for: .event)
        guard status == .authorized || status == .fullAccess else {
            call.resolve(["calendars": []])
            return
        }

        let calendars = eventStore.calendars(for: .event).map { calendar in
            return [
                "id": calendar.calendarIdentifier,
                "title": calendar.title,
                "isPrimary": calendar.source.sourceType == .calDAV && calendar.allowsContentModifications
            ] as [String : Any]
        }

        call.resolve(["calendars": calendars])
    }

    @objc func createOrUpdateEvent(_ call: CAPPluginCall) {
        let status = EKEventStore.authorizationStatus(for: .event)
        guard status == .authorized || status == .fullAccess else {
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

        let isoFormatter = ISO8601DateFormatter()
        guard let startDate = isoFormatter.date(from: startDateString),
              let endDate = isoFormatter.date(from: endDateString) else {
            call.reject("Invalid startDate or endDate format")
            return
        }

        let event: EKEvent
        if let eventId = call.getString("eventId"),
           let existing = eventStore.event(withIdentifier: eventId) {
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

        do {
            try eventStore.save(event, span: .thisEvent, commit: true)
            call.resolve(["eventId": event.eventIdentifier ?? ""])
        } catch {
            call.reject("Failed to save calendar event", nil, error)
        }
    }

    @objc func deleteEvent(_ call: CAPPluginCall) {
        guard let eventId = call.getString("eventId") else {
            call.reject("eventId is required")
            return
        }

        guard let event = eventStore.event(withIdentifier: eventId) else {
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
