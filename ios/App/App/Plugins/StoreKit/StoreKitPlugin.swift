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
                        dict["subscriptionPeriodUnit"] = subscription.subscriptionPeriod.unit.rawValue
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
        dict["isUpgraded"] = transaction.isUpgraded
        return dict
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
