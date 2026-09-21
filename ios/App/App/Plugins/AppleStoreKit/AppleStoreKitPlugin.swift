import Capacitor
import Foundation
import StoreKit
import UIKit

@objc(AppleStoreKitPlugin)
public final class AppleStoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleStoreKitPlugin"
    public let jsName = "AppleStoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "loadProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "currentEntitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentCodeRedemptionSheet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise)
    ]

    private var productsById: [String: Product] = [:]
    private var transactionUpdatesTask: Task<Void, Never>?
    private let iso8601 = ISO8601DateFormatter()

    public override func load() {
        transactionUpdatesTask = Task { [weak self] in
            for await result in StoreKit.Transaction.updates {
                guard let self else { return }
                guard case .verified(let transaction) = result else { continue }
                let payload = self.transactionPayload(transaction)
                await MainActor.run {
                    self.notifyListeners("transactionUpdated", data: payload)
                }
                await transaction.finish()
            }
        }
    }

    deinit {
        transactionUpdatesTask?.cancel()
    }

    @objc public func loadProducts(_ call: CAPPluginCall) {
        let productIds = call.getArray("productIds", String.self) ?? []
        guard !productIds.isEmpty else {
            call.reject("At least one Apple product identifier is required.")
            return
        }

        Task {
            do {
                let products = try await Product.products(for: productIds)
                products.forEach { productsById[$0.id] = $0 }
                let payloads = products
                    .sorted {
                        (productIds.firstIndex(of: $0.id) ?? Int.max) <
                            (productIds.firstIndex(of: $1.id) ?? Int.max)
                    }
                    .map(productPayload)
                call.resolve(["products": payloads])
            } catch {
                call.reject("Apple could not load subscription products.", nil, error)
            }
        }
    }

    @objc public func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId"), !productId.isEmpty else {
            call.reject("An Apple product identifier is required.")
            return
        }
        guard let tokenValue = call.getString("appAccountToken"),
              let appAccountToken = UUID(uuidString: tokenValue) else {
            call.reject("A valid app account token is required.")
            return
        }

        Task {
            do {
                let product: Product
                if let cached = productsById[productId] {
                    product = cached
                } else if let fetched = try await Product.products(for: [productId]).first {
                    productsById[productId] = fetched
                    product = fetched
                } else {
                    call.reject("Apple subscription product not found: \(productId)")
                    return
                }

                let result = try await product.purchase(options: [.appAccountToken(appAccountToken)])
                switch result {
                case .success(let verification):
                    let transaction = try verified(verification)
                    let payload = transactionPayload(transaction)
                    await transaction.finish()
                    call.resolve(["status": "purchased", "transaction": payload])
                case .userCancelled:
                    call.resolve(["status": "cancelled"])
                case .pending:
                    call.resolve(["status": "pending"])
                @unknown default:
                    call.reject("Apple returned an unknown purchase result.")
                }
            } catch {
                call.reject("Apple purchase failed.", nil, error)
            }
        }
    }

    @objc public func currentEntitlements(_ call: CAPPluginCall) {
        Task {
            call.resolve(["transactions": await entitlementPayloads()])
        }
    }

    @objc public func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                call.resolve(["transactions": await entitlementPayloads()])
            } catch {
                call.reject("Apple could not restore purchases.", nil, error)
            }
        }
    }

    @objc public func presentCodeRedemptionSheet(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            SKPaymentQueue.default().presentCodeRedemptionSheet()
            call.resolve(["presented": true])
        }
    }

    @objc public func manageSubscriptions(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive }) else {
                call.reject("Unable to find an active window for Apple subscription management.")
                return
            }

            do {
                try await AppStore.showManageSubscriptions(in: scene)
                call.resolve()
            } catch {
                call.reject("Apple could not open subscription management.", nil, error)
            }
        }
    }

    private func verified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let value):
            return value
        case .unverified(_, let error):
            throw error
        }
    }

    private func entitlementPayloads() async -> [[String: Any]] {
        var payloads: [[String: Any]] = []
        for await result in StoreKit.Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else { continue }
            guard transaction.revocationDate == nil else { continue }
            if let expirationDate = transaction.expirationDate, expirationDate <= Date() { continue }
            payloads.append(transactionPayload(transaction))
        }
        return payloads.sorted { left, right in
            (left["expirationDate"] as? String ?? "") > (right["expirationDate"] as? String ?? "")
        }
    }

    private func productPayload(_ product: Product) -> [String: Any] {
        var payload: [String: Any] = [
            "identifier": product.id,
            "displayName": product.displayName,
            "description": product.description,
            "displayPrice": product.displayPrice,
            "price": NSDecimalNumber(decimal: product.price).doubleValue,
            "type": String(describing: product.type)
        ]

        if let subscription = product.subscription {
            let period = subscription.subscriptionPeriod
            payload["subscriptionPeriodUnit"] = periodUnit(period.unit)
            payload["subscriptionPeriodValue"] = period.value

            if let offer = subscription.introductoryOffer {
                payload["introductoryOffer"] = [
                    "displayPrice": offer.displayPrice,
                    "price": NSDecimalNumber(decimal: offer.price).doubleValue,
                    "paymentMode": String(describing: offer.paymentMode),
                    "periodUnit": periodUnit(offer.period.unit),
                    "periodValue": offer.period.value
                ]
            }
        }

        return payload
    }

    private func periodUnit(_ unit: Product.SubscriptionPeriod.Unit) -> Int {
        switch unit {
        case .day: return 0
        case .week: return 1
        case .month: return 2
        case .year: return 3
        @unknown default: return -1
        }
    }

    private func transactionPayload(_ transaction: StoreKit.Transaction) -> [String: Any] {
        var payload: [String: Any] = [
            "transactionId": String(transaction.id),
            "originalTransactionId": String(transaction.originalID),
            "productId": transaction.productID,
            "purchaseDate": iso8601.string(from: transaction.purchaseDate),
            "isSandbox": String(describing: transaction.environment).lowercased() != "production",
            "isUpgraded": transaction.isUpgraded
        ]

        if let expirationDate = transaction.expirationDate {
            payload["expirationDate"] = iso8601.string(from: expirationDate)
        }
        if let revocationDate = transaction.revocationDate {
            payload["revocationDate"] = iso8601.string(from: revocationDate)
        }
        if let appAccountToken = transaction.appAccountToken {
            payload["appAccountToken"] = appAccountToken.uuidString.lowercased()
        }

        return payload
    }
}
