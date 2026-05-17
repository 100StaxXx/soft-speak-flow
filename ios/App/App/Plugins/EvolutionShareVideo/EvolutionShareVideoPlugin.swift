import AVFoundation
import Capacitor
import Foundation
import QuartzCore
import UIKit

@objc(EvolutionShareVideoPlugin)
public class EvolutionShareVideoPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EvolutionShareVideoPlugin"
    public let jsName = "EvolutionShareVideo"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "renderEvolutionShareVideo", returnType: CAPPluginReturnPromise)
    ]

    @objc func renderEvolutionShareVideo(_ call: CAPPluginCall) {
        guard let sourceVideoUrl = call.getString("sourceVideoUrl")?.trimmingCharacters(in: .whitespacesAndNewlines),
              !sourceVideoUrl.isEmpty else {
            call.reject("sourceVideoUrl is required")
            return
        }

        let template = call.getString("template") ?? "aesthetic-reveal"
        guard template == "aesthetic-reveal" else {
            call.reject("Unsupported evolution share template")
            return
        }

        let stage = max(0, call.getInt("stage") ?? 0)
        let companionName = call.getString("companionName")?.trimmingCharacters(in: .whitespacesAndNewlines)

        Task {
            do {
                let renderer = EvolutionShareVideoRenderer(
                    sourceVideoUrl: sourceVideoUrl,
                    stage: stage,
                    companionName: companionName?.isEmpty == false ? companionName : nil
                )
                let result = try await renderer.render()
                await MainActor.run {
                    call.resolve(result)
                }
            } catch {
                await MainActor.run {
                    call.reject("Failed to render evolution share video: \(error.localizedDescription)")
                }
            }
        }
    }
}

private final class EvolutionShareVideoRenderer {
    private let sourceVideoUrl: String
    private let stage: Int
    private let companionName: String?
    private let renderSize = CGSize(width: 1080, height: 1920)

    init(sourceVideoUrl: String, stage: Int, companionName: String?) {
        self.sourceVideoUrl = sourceVideoUrl
        self.stage = stage
        self.companionName = companionName
    }

    func render() async throws -> [String: Any] {
        let sourceURL = try await localMediaURL(for: sourceVideoUrl, fallbackExtension: "mp4")
        let asset = AVURLAsset(url: sourceURL)
        let duration = try await asset.load(.duration)
        let videoTracks = try await asset.loadTracks(withMediaType: .video)

        guard let sourceVideoTrack = videoTracks.first else {
            throw NSError(domain: "EvolutionShareVideo", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Source video has no video track"
            ])
        }

        let composition = AVMutableComposition()
        guard let compositionVideoTrack = composition.addMutableTrack(
            withMediaType: .video,
            preferredTrackID: kCMPersistentTrackID_Invalid
        ) else {
            throw NSError(domain: "EvolutionShareVideo", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Unable to create video composition track"
            ])
        }

        try compositionVideoTrack.insertTimeRange(
            CMTimeRange(start: .zero, duration: duration),
            of: sourceVideoTrack,
            at: .zero
        )

        let audioTracks = try await asset.loadTracks(withMediaType: .audio)
        if let sourceAudioTrack = audioTracks.first,
           let compositionAudioTrack = composition.addMutableTrack(
               withMediaType: .audio,
               preferredTrackID: kCMPersistentTrackID_Invalid
           ) {
            try? compositionAudioTrack.insertTimeRange(
                CMTimeRange(start: .zero, duration: duration),
                of: sourceAudioTrack,
                at: .zero
            )
        }

        let videoComposition = try await buildVideoComposition(
            sourceVideoTrack: sourceVideoTrack,
            compositionVideoTrack: compositionVideoTrack,
            duration: duration
        )
        let filename = "cosmiq-evolution-stage-\(stage)-\(Int(Date().timeIntervalSince1970)).mp4"
        let outputURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)

        if FileManager.default.fileExists(atPath: outputURL.path) {
            try FileManager.default.removeItem(at: outputURL)
        }

        guard let exportSession = AVAssetExportSession(
            asset: composition,
            presetName: AVAssetExportPresetHighestQuality
        ) else {
            throw NSError(domain: "EvolutionShareVideo", code: 3, userInfo: [
                NSLocalizedDescriptionKey: "Unable to create video export session"
            ])
        }

        exportSession.outputURL = outputURL
        exportSession.outputFileType = .mp4
        exportSession.shouldOptimizeForNetworkUse = true
        exportSession.videoComposition = videoComposition

        try await export(exportSession)

        return [
            "uri": outputURL.absoluteString,
            "filename": filename,
            "mimeType": "video/mp4",
            "width": Int(renderSize.width),
            "height": Int(renderSize.height),
            "durationMs": Int(CMTimeGetSeconds(duration) * 1000)
        ]
    }

    private func buildVideoComposition(
        sourceVideoTrack: AVAssetTrack,
        compositionVideoTrack: AVCompositionTrack,
        duration: CMTime
    ) async throws -> AVMutableVideoComposition {
        let naturalSize = try await sourceVideoTrack.load(.naturalSize)
        let preferredTransform = try await sourceVideoTrack.load(.preferredTransform)
        let targetRect = CGRect(x: 72, y: 318, width: 936, height: 1184)

        let videoComposition = AVMutableVideoComposition()
        videoComposition.renderSize = renderSize
        videoComposition.frameDuration = CMTime(value: 1, timescale: 30)

        let instruction = AVMutableVideoCompositionInstruction()
        instruction.timeRange = CMTimeRange(start: .zero, duration: duration)

        let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: compositionVideoTrack)
        layerInstruction.setTransform(
            fittedTransform(
                naturalSize: naturalSize,
                preferredTransform: preferredTransform,
                targetRect: targetRect
            ),
            at: .zero
        )
        instruction.layerInstructions = [layerInstruction]
        videoComposition.instructions = [instruction]

        videoComposition.animationTool = buildAnimationTool(duration: duration, targetRect: targetRect)
        return videoComposition
    }

    private func buildAnimationTool(duration: CMTime, targetRect: CGRect) -> AVVideoCompositionCoreAnimationTool {
        let parentLayer = CALayer()
        let videoLayer = CALayer()
        parentLayer.frame = CGRect(origin: .zero, size: renderSize)
        videoLayer.frame = CGRect(origin: .zero, size: renderSize)
        parentLayer.addSublayer(videoLayer)

        let fullFrame = CGRect(origin: .zero, size: renderSize)
        let wash = CAGradientLayer()
        wash.frame = fullFrame
        wash.colors = [
            UIColor(red: 0.05, green: 0.07, blue: 0.14, alpha: 0.54).cgColor,
            UIColor.clear.cgColor,
            UIColor(red: 0.01, green: 0.012, blue: 0.025, alpha: 0.88).cgColor
        ]
        wash.locations = [0, 0.42, 1]
        parentLayer.addSublayer(wash)

        let frameLayer = CALayer()
        frameLayer.frame = targetRect
        frameLayer.borderColor = UIColor.white.withAlphaComponent(0.18).cgColor
        frameLayer.borderWidth = 2
        frameLayer.cornerRadius = 36
        parentLayer.addSublayer(frameLayer)

        let brandLayer = textLayer(
            text: "COSMIQ",
            frame: CGRect(x: 80, y: 130, width: 920, height: 54),
            fontSize: 36,
            weight: .semibold,
            color: UIColor.white.withAlphaComponent(0.74),
            alignment: .center,
            tracking: 7
        )
        parentLayer.addSublayer(brandLayer)

        let stageLayer = textLayer(
            text: "STAGE \(stage) EVOLUTION",
            frame: CGRect(x: 90, y: 212, width: 900, height: 92),
            fontSize: 54,
            weight: .bold,
            color: .white,
            alignment: .center,
            tracking: 1.5
        )
        parentLayer.addSublayer(stageLayer)

        if let companionName {
            let nameLayer = textLayer(
                text: companionName,
                frame: CGRect(x: 110, y: 1476, width: 860, height: 70),
                fontSize: 40,
                weight: .semibold,
                color: UIColor.white.withAlphaComponent(0.92),
                alignment: .center,
                tracking: 0
            )
            parentLayer.addSublayer(nameLayer)
        }

        let captionLayer = textLayer(
            text: "EVOLUTION REVEAL",
            frame: CGRect(x: 120, y: 1582, width: 840, height: 46),
            fontSize: 26,
            weight: .semibold,
            color: UIColor.white.withAlphaComponent(0.66),
            alignment: .center,
            tracking: 4
        )
        parentLayer.addSublayer(captionLayer)

        let pulse = CABasicAnimation(keyPath: "opacity")
        pulse.fromValue = 0.74
        pulse.toValue = 1
        pulse.duration = min(max(CMTimeGetSeconds(duration) / 2, 1.2), 2.4)
        pulse.autoreverses = true
        pulse.repeatCount = .greatestFiniteMagnitude
        frameLayer.add(pulse, forKey: "shareFramePulse")

        return AVVideoCompositionCoreAnimationTool(postProcessingAsVideoLayer: videoLayer, in: parentLayer)
    }

    private func fittedTransform(
        naturalSize: CGSize,
        preferredTransform: CGAffineTransform,
        targetRect: CGRect
    ) -> CGAffineTransform {
        let transformedRect = CGRect(origin: .zero, size: naturalSize).applying(preferredTransform)
        let orientedSize = CGSize(width: abs(transformedRect.width), height: abs(transformedRect.height))
        let scale = min(targetRect.width / orientedSize.width, targetRect.height / orientedSize.height)
        let scaledSize = CGSize(width: orientedSize.width * scale, height: orientedSize.height * scale)
        let centeredOrigin = CGPoint(
            x: targetRect.minX + (targetRect.width - scaledSize.width) / 2,
            y: targetRect.minY + (targetRect.height - scaledSize.height) / 2
        )

        return preferredTransform
            .concatenating(CGAffineTransform(translationX: -transformedRect.minX, y: -transformedRect.minY))
            .concatenating(CGAffineTransform(scaleX: scale, y: scale))
            .concatenating(CGAffineTransform(translationX: centeredOrigin.x, y: centeredOrigin.y))
    }

    private func textLayer(
        text: String,
        frame: CGRect,
        fontSize: CGFloat,
        weight: UIFont.Weight,
        color: UIColor,
        alignment: CATextLayerAlignmentMode,
        tracking: Double
    ) -> CATextLayer {
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.alignment = .center

        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: fontSize, weight: weight),
            .foregroundColor: color,
            .paragraphStyle: paragraphStyle,
            .kern: tracking
        ]

        let layer = CATextLayer()
        layer.frame = frame
        layer.contentsScale = UIScreen.main.scale
        layer.alignmentMode = alignment
        layer.isWrapped = true
        layer.truncationMode = .end
        layer.string = NSAttributedString(string: text, attributes: attributes)
        return layer
    }

    private func localMediaURL(for rawValue: String, fallbackExtension: String) async throws -> URL {
        if let url = URL(string: rawValue), url.isFileURL {
            return url
        }

        if let url = URL(string: rawValue),
           let scheme = url.scheme?.lowercased(),
           scheme == "http" || scheme == "https" {
            let (downloadedURL, _) = try await URLSession.shared.download(from: url)
            let fileExtension = url.pathExtension.isEmpty ? fallbackExtension : url.pathExtension
            let destination = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension(fileExtension)

            if FileManager.default.fileExists(atPath: destination.path) {
                try FileManager.default.removeItem(at: destination)
            }
            try FileManager.default.moveItem(at: downloadedURL, to: destination)
            return destination
        }

        return URL(fileURLWithPath: rawValue)
    }

    private func export(_ exportSession: AVAssetExportSession) async throws {
        try await withCheckedThrowingContinuation { continuation in
            exportSession.exportAsynchronously {
                switch exportSession.status {
                case .completed:
                    continuation.resume()
                case .failed, .cancelled:
                    continuation.resume(throwing: exportSession.error ?? NSError(
                        domain: "EvolutionShareVideo",
                        code: 4,
                        userInfo: [NSLocalizedDescriptionKey: "Video export failed"]
                    ))
                default:
                    continuation.resume(throwing: NSError(
                        domain: "EvolutionShareVideo",
                        code: 5,
                        userInfo: [NSLocalizedDescriptionKey: "Video export ended with status \(exportSession.status.rawValue)"]
                    ))
                }
            }
        }
    }
}
