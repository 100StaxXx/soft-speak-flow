import Foundation
import Capacitor
import StoreKit

@objc(StoreKitPlugin)
public class StoreKitPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "StoreKitPlugin"
    public let jsName = "StoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchaseWithPromoOffer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentOfferCodeRedeemSheet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCurrentEntitlement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startTransactionListener", returnType: CAPPluginReturnPromise)
    ]

    private var transactionListenerTask: Task<Void, Never>?

    // MARK: - getProducts

    @objc func getProducts(_ call: CAPPluginCall) {
        guard let productIds = call.getArray("productIds", String.self), !productIds.isEmpty else {
            call.reject("productIds array is required")
            return
        }

        Task {
            do {
                let products = try await Product.products(for: Set(productIds))
                let result = products.map { product -> [String: Any] in
                    var dict: [String: Any] = [
                        "identifier": product.id,
                        "displayName": product.displayName,
                        "description": product.description,
                        "displayPrice": product.displayPrice,
                        "price": NSDecimalNumber(decimal: product.price).doubleValue,
                        "type": product.type.rawValue
                    ]
                    if let subscription = product.subscription {
                        dict["subscriptionPeriodUnit"] = self.subscriptionPeriodUnitValue(subscription.subscriptionPeriod.unit)
                        dict["subscriptionPeriodValue"] = subscription.subscriptionPeriod.value
                    }
                    return dict
                }
                call.resolve(["products": result])
            } catch {
                call.reject("Failed to load products: \(error.localizedDescription)")
            }
        }
    }

    private func subscriptionPeriodUnitValue(_ unit: Product.SubscriptionPeriod.Unit) -> Int {
        switch unit {
        case .day:
            return 0
        case .week:
            return 1
        case .month:
            return 2
        case .year:
            return 3
        @unknown default:
            return -1
        }
    }

    // MARK: - presentOfferCodeRedeemSheet

    @objc func presentOfferCodeRedeemSheet(_ call: CAPPluginCall) {
        let redemptionURLString = call.getString("redemptionURL")

        DispatchQueue.main.async {
            if #available(iOS 16.0, *) {
                guard let windowScene = UIApplication.shared.connectedScenes
                    .compactMap({ $0 as? UIWindowScene })
                    .first else {
                    if let redemptionURLString = redemptionURLString {
                        self.openRedemptionURL(redemptionURLString, call: call)
                    } else {
                        call.reject("No active window scene")
                    }
                    return
                }

                Task {
                    do {
                        try await AppStore.presentOfferCodeRedeemSheet(in: windowScene)
                        call.resolve(["status": "presented"])
                    } catch {
                        if let redemptionURLString = redemptionURLString {
                            self.openRedemptionURL(redemptionURLString, call: call)
                        } else {
                            call.reject("Failed to present offer code redemption: \(error.localizedDescription)")
                        }
                    }
                }
            } else if let redemptionURLString = redemptionURLString {
                self.openRedemptionURL(redemptionURLString, call: call)
            } else {
                call.reject("Offer code redemption requires iOS 16 or later")
            }
        }
    }

    // MARK: - purchase

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("productId is required")
            return
        }
        let appAccountToken = call.getString("appAccountToken")

        Task {
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    call.reject("Product not found: \(productId)")
                    return
                }

                var options: Set<Product.PurchaseOption> = []
                if let tokenString = appAccountToken, let token = UUID(uuidString: tokenString) {
                    options.insert(.appAccountToken(token))
                }

                let result = try await product.purchase(options: options)
                switch result {
                case .success(let verification):
                    let transaction = try self.checkVerified(verification)
                    await transaction.finish()
                    call.resolve(self.transactionToDict(transaction))

                case .userCancelled:
                    call.resolve(["cancelled": true])

                case .pending:
                    call.resolve(["pending": true])

                @unknown default:
                    call.reject("Unknown purchase result")
                }
            } catch {
                call.reject("Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - purchaseWithPromoOffer

    @objc func purchaseWithPromoOffer(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("productId is required")
            return
        }
        guard let offerID = call.getString("offerID") else {
            call.reject("offerID is required")
            return
        }
        guard let keyID = call.getString("keyID") else {
            call.reject("keyID is required")
            return
        }
        guard let nonceString = call.getString("nonce"), let nonce = UUID(uuidString: nonceString) else {
            call.reject("nonce (UUID string) is required")
            return
        }
        guard let signature = call.getString("signature"),
              let signatureData = Data(base64Encoded: signature) else {
            call.reject("signature (base64) is required")
            return
        }
        guard let timestamp = call.getInt("timestamp") else {
            call.reject("timestamp is required")
            return
        }
        let appAccountToken = call.getString("appAccountToken")

        Task {
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    call.reject("Product not found: \(productId)")
                    return
                }

                var options: Set<Product.PurchaseOption> = []
                if let tokenString = appAccountToken, let token = UUID(uuidString: tokenString) {
                    options.insert(.appAccountToken(token))
                }

                options.insert(.promotionalOffer(
                    offerID: offerID,
                    keyID: keyID,
                    nonce: nonce,
                    signature: signatureData,
                    timestamp: timestamp
                ))

                let result = try await product.purchase(options: options)
                switch result {
                case .success(let verification):
                    let transaction = try self.checkVerified(verification)
                    await transaction.finish()
                    call.resolve(self.transactionToDict(transaction))

                case .userCancelled:
                    call.resolve(["cancelled": true])

                case .pending:
                    call.resolve(["pending": true])

                @unknown default:
                    call.reject("Unknown purchase result")
                }
            } catch {
                call.reject("Purchase with promo offer failed: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - restorePurchases

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                let entitlement = await self.findCurrentEntitlement()
                if let entitlement = entitlement {
                    call.resolve(["restored": true, "entitlement": entitlement])
                } else {
                    call.resolve(["restored": true, "entitlement": NSNull()])
                }
            } catch {
                call.reject("Restore failed: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - getCurrentEntitlement

    @objc func getCurrentEntitlement(_ call: CAPPluginCall) {
        Task {
            let entitlement = await self.findCurrentEntitlement()
            if let entitlement = entitlement {
                call.resolve(["entitlement": entitlement])
            } else {
                call.resolve(["entitlement": NSNull()])
            }
        }
    }

    // MARK: - manageSubscriptions

    @objc func manageSubscriptions(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let windowScene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first else {
                call.reject("No active window scene")
                return
            }

            Task {
                do {
                    try await AppStore.showManageSubscriptions(in: windowScene)
                    call.resolve()
                } catch {
                    call.reject("Failed to open subscription management: \(error.localizedDescription)")
                }
            }
        }
    }

    // MARK: - startTransactionListener

    @objc func startTransactionListener(_ call: CAPPluginCall) {
        if transactionListenerTask != nil {
            call.resolve(["started": true])
            return
        }

        transactionListenerTask = Task.detached { [weak self] in
            for await result in Transaction.updates {
                guard let self = self else { return }
                do {
                    let transaction = try self.checkVerified(result)
                    await transaction.finish()
                    let dict = self.transactionToDict(transaction)
                    self.notifyListeners("transactionUpdate", data: dict)
                } catch {
                    print("[StoreKitPlugin] Transaction update verification failed: \(error)")
                }
            }
        }
        call.resolve(["started": true])
    }

    // MARK: - Helpers

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified(_, let error):
            throw error
        case .verified(let value):
            return value
        }
    }

    private func transactionToDict(_ transaction: Transaction) -> [String: Any] {
        var dict: [String: Any] = [
            "transactionId": String(transaction.id),
            "originalTransactionId": String(transaction.originalID),
            "productId": transaction.productID,
            "purchaseDate": self.isoString(from: transaction.purchaseDate)
        ]
        if let expirationDate = transaction.expirationDate {
            dict["expirationDate"] = self.isoString(from: expirationDate)
        }
        if let revocationDate = transaction.revocationDate {
            dict["revocationDate"] = self.isoString(from: revocationDate)
        }
        if let appAccountToken = transaction.appAccountToken {
            dict["appAccountToken"] = appAccountToken.uuidString
        }
        if #available(iOS 17.2, *), let offerID = transaction.offerID {
            dict["offerIdentifier"] = offerID
        }
        if #available(iOS 17.2, *), let offerType = transaction.offerType {
            dict["offerType"] = offerType.rawValue
        }
        dict["isUpgraded"] = transaction.isUpgraded
        return dict
    }

    private func openRedemptionURL(_ redemptionURLString: String, call: CAPPluginCall) {
        let sanitized = redemptionURLString.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: sanitized) else {
            call.reject("Invalid redemption URL")
            return
        }

        UIApplication.shared.open(url, options: [:]) { success in
            if success {
                call.resolve(["status": "opened_url"])
            } else {
                call.reject("Failed to open redemption URL")
            }
        }
    }

    private func findCurrentEntitlement() async -> [String: Any]? {
        for await result in Transaction.currentEntitlements {
            do {
                let transaction = try checkVerified(result)
                if transaction.productType == .autoRenewable,
                   transaction.revocationDate == nil {
                    if let expirationDate = transaction.expirationDate, expirationDate > Date() {
                        return transactionToDict(transaction)
                    }
                }
            } catch {
                print("[StoreKitPlugin] Entitlement verification failed: \(error)")
            }
        }
        return nil
    }

    private func isoString(from date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    deinit {
        transactionListenerTask?.cancel()
    }
}
