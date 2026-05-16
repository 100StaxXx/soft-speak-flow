import Foundation
import Capacitor
import GooglePlaces

@objc(NativePlacesAutocompletePlugin)
public class NativePlacesAutocompletePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativePlacesAutocompletePlugin"
    public let jsName = "NativePlacesAutocomplete"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "beginSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fetchSuggestions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resolveSuggestion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getOpenSourceLicenseInfo", returnType: CAPPluginReturnPromise)
    ]

    private let sessionQueue = DispatchQueue(label: "com.cosmiq.nativePlacesAutocomplete.sessions")
    private var sessionTokens: [String: GMSAutocompleteSessionToken] = [:]

    @objc public func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": GooglePlacesConfiguration.configuredAPIKey() != nil])
    }

    @objc public func beginSession(_ call: CAPPluginCall) {
        guard GooglePlacesConfiguration.provideAPIKeyIfAvailable() != nil else {
            call.reject("Google Places iOS API key is not configured")
            return
        }

        let sessionId = UUID().uuidString
        let token = GMSAutocompleteSessionToken()
        sessionQueue.sync {
            sessionTokens[sessionId] = token
        }

        call.resolve(["sessionId": sessionId])
    }

    @objc public func fetchSuggestions(_ call: CAPPluginCall) {
        guard let placesClient = Self.placesClient() else {
            call.reject("Google Places iOS API key is not configured")
            return
        }
        guard let sessionId = call.getString("sessionId"),
              let token = token(for: sessionId) else {
            call.reject("sessionId is required")
            return
        }

        let input = (call.getString("input") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard input.count >= 2 else {
            call.resolve(["suggestions": []])
            return
        }

        let request = GMSAutocompleteRequest(query: input)
        request.sessionToken = token

        placesClient.fetchAutocompleteSuggestions(from: request) { results, error in
            if let error = error {
                call.reject("Failed to fetch Places suggestions", nil, error)
                return
            }

            let suggestions = (results ?? []).compactMap { suggestion -> [String: String]? in
                guard let placeSuggestion = suggestion.placeSuggestion else {
                    return nil
                }

                let placeId = placeSuggestion.placeID.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !placeId.isEmpty else {
                    return nil
                }

                let primaryText = placeSuggestion.attributedPrimaryText.string.trimmingCharacters(in: .whitespacesAndNewlines)
                let secondaryText = placeSuggestion.attributedSecondaryText?.string.trimmingCharacters(in: .whitespacesAndNewlines)
                let fullText = placeSuggestion.attributedFullText.string.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !primaryText.isEmpty || !fullText.isEmpty else {
                    return nil
                }

                var item: [String: String] = [
                    "placeId": placeId,
                    "primaryText": primaryText.isEmpty ? fullText : primaryText,
                    "fullText": fullText.isEmpty ? primaryText : fullText
                ]
                if let secondaryText, !secondaryText.isEmpty {
                    item["secondaryText"] = secondaryText
                }
                return item
            }

            call.resolve(["suggestions": suggestions])
        }
    }

    @objc public func resolveSuggestion(_ call: CAPPluginCall) {
        guard let placesClient = Self.placesClient() else {
            call.reject("Google Places iOS API key is not configured")
            return
        }
        guard let sessionId = call.getString("sessionId"),
              let token = token(for: sessionId) else {
            call.reject("sessionId is required")
            return
        }
        guard let placeId = call.getString("placeId"), !placeId.isEmpty else {
            call.reject("placeId is required")
            return
        }

        let placeProperties = [
            GMSPlaceProperty.name.rawValue,
            GMSPlaceProperty.placeID.rawValue,
            GMSPlaceProperty.formattedAddress.rawValue
        ]
        let request = GMSFetchPlaceRequest(
            placeID: placeId,
            placeProperties: placeProperties,
            sessionToken: token
        )

        placesClient.fetchPlace(with: request) { place, error in
            if let error = error {
                call.reject("Failed to resolve Places suggestion", nil, error)
                return
            }
            guard let place else {
                call.reject("Place not found")
                return
            }

            let location = (place.formattedAddress ?? place.name ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !location.isEmpty else {
                call.reject("Resolved place did not include a usable location")
                return
            }

            call.resolve([
                "location": location,
                "placeId": place.placeID ?? placeId
            ])
        }
    }

    @objc public func endSession(_ call: CAPPluginCall) {
        guard let sessionId = call.getString("sessionId") else {
            call.resolve(["success": false])
            return
        }

        _ = sessionQueue.sync {
            sessionTokens.removeValue(forKey: sessionId)
        }
        call.resolve(["success": true])
    }

    @objc public func getOpenSourceLicenseInfo(_ call: CAPPluginCall) {
        guard GooglePlacesConfiguration.provideAPIKeyIfAvailable() != nil else {
            call.resolve(["licenseInfo": ""])
            return
        }
        call.resolve(["licenseInfo": GMSPlacesClient.openSourceLicenseInfo()])
    }

    private func token(for sessionId: String) -> GMSAutocompleteSessionToken? {
        sessionQueue.sync {
            sessionTokens[sessionId]
        }
    }

    private static func placesClient() -> GMSPlacesClient? {
        guard GooglePlacesConfiguration.provideAPIKeyIfAvailable() != nil else {
            return nil
        }
        return GMSPlacesClient.shared()
    }
}
