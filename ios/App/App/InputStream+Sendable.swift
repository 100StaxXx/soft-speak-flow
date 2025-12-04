import Foundation

/// Treat `InputStream` as Sendable for Swift concurrency checks.
extension InputStream: @unchecked Sendable {}
