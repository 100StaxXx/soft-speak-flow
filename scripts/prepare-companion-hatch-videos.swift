import AVFoundation
import CoreGraphics
import Foundation

struct HatchVideoSpec {
  let sourceName: String
  let outputName: String
  let centeredCrop: Bool
}

let outputSize = CGSize(width: 1172, height: 1764)

let specs: [HatchVideoSpec] = [
  .init(sourceName: "HatchFireKitsune.mp4", outputName: "hatch__fox__fire__center-crop.mp4", centeredCrop: true),
  .init(sourceName: "HatchIceKitsune.mp4", outputName: "hatch__fox__ice.mp4", centeredCrop: false),
  .init(sourceName: "HatchNatureKitsune.mp4", outputName: "hatch__fox__nature.mp4", centeredCrop: false),
  .init(sourceName: "HatchFirePhoenix.mp4", outputName: "hatch__phoenix__fire.mp4", centeredCrop: false),
  .init(sourceName: "HatchIcePhoenix.mp4", outputName: "hatch__phoenix__ice.mp4", centeredCrop: false),
  .init(sourceName: "HatchNaturePhoenix.mp4", outputName: "hatch__phoenix__nature.mp4", centeredCrop: false),
  .init(sourceName: "HatchFireLeviathan.mp4", outputName: "hatch__leviathan__fire.mp4", centeredCrop: false),
  .init(sourceName: "HatchIceLeviathan.mp4", outputName: "hatch__leviathan__ice.mp4", centeredCrop: false),
  .init(sourceName: "HatchNatureLeviathan.mp4", outputName: "hatch__leviathan__nature.mp4", centeredCrop: false),
]

enum PreparationError: Error {
  case missingVideoTrack(URL)
  case exportSessionUnavailable(URL)
  case exportFailed(URL, String)
}

func parseArg(_ name: String, defaultValue: String) -> String {
  let args = CommandLine.arguments
  guard let index = args.firstIndex(of: name), index + 1 < args.count else {
    return defaultValue
  }

  return args[index + 1]
}

func makeCenteredCropTransform(
  naturalSize: CGSize,
  preferredTransform: CGAffineTransform,
  renderSize: CGSize,
) -> CGAffineTransform {
  let transformedBounds = CGRect(origin: .zero, size: naturalSize).applying(preferredTransform)
  let normalizedSize = CGSize(
    width: abs(transformedBounds.width),
    height: abs(transformedBounds.height),
  )

  let scale = max(renderSize.width / normalizedSize.width, renderSize.height / normalizedSize.height)
  let scaledSize = CGSize(width: normalizedSize.width * scale, height: normalizedSize.height * scale)
  let offsetX = (renderSize.width - scaledSize.width) / 2
  let offsetY = (renderSize.height - scaledSize.height) / 2

  return preferredTransform
    .concatenating(CGAffineTransform(translationX: -transformedBounds.origin.x, y: -transformedBounds.origin.y))
    .concatenating(CGAffineTransform(scaleX: scale, y: scale))
    .concatenating(CGAffineTransform(translationX: offsetX, y: offsetY))
}

func exportCenteredCropVideo(sourceURL: URL, outputURL: URL, renderSize: CGSize) async throws {
  let asset = AVURLAsset(url: sourceURL)
  let videoTracks = try await asset.loadTracks(withMediaType: .video)
  guard let videoTrack = videoTracks.first else {
    throw PreparationError.missingVideoTrack(sourceURL)
  }

  let naturalSize = try await videoTrack.load(.naturalSize)
  let preferredTransform = try await videoTrack.load(.preferredTransform)
  let duration = try await asset.load(.duration)

  guard let exportSession = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetHighestQuality) else {
    throw PreparationError.exportSessionUnavailable(sourceURL)
  }

  let instruction = AVMutableVideoCompositionInstruction()
  instruction.timeRange = CMTimeRange(start: .zero, duration: duration)

  let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTrack)
  layerInstruction.setTransform(
    makeCenteredCropTransform(
      naturalSize: naturalSize,
      preferredTransform: preferredTransform,
      renderSize: renderSize,
    ),
    at: .zero,
  )
  instruction.layerInstructions = [layerInstruction]

  let videoComposition = AVMutableVideoComposition()
  videoComposition.instructions = [instruction]
  videoComposition.renderSize = renderSize
  videoComposition.frameDuration = CMTime(value: 1, timescale: 30)

  exportSession.outputURL = outputURL
  exportSession.outputFileType = .mp4
  exportSession.videoComposition = videoComposition
  exportSession.shouldOptimizeForNetworkUse = true

  try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
    exportSession.exportAsynchronously {
      switch exportSession.status {
      case .completed:
        continuation.resume()
      case .failed, .cancelled:
        let message = exportSession.error?.localizedDescription ?? "unknown export failure"
        continuation.resume(throwing: PreparationError.exportFailed(sourceURL, message))
      default:
        let message = exportSession.error?.localizedDescription ?? "unexpected export status"
        continuation.resume(throwing: PreparationError.exportFailed(sourceURL, message))
      }
    }
  }
}

@main
struct Main {
  static func main() async throws {
    let fileManager = FileManager.default
    let sourceDir = URL(fileURLWithPath: parseArg("--source", defaultValue: "/Users/macbookair/Documents/HatchAnimation"), isDirectory: true)
    let outputDir = URL(fileURLWithPath: parseArg("--output", defaultValue: "\(fileManager.currentDirectoryPath)/public/companion-hatch-videos"), isDirectory: true)

    try fileManager.createDirectory(at: outputDir, withIntermediateDirectories: true)

    for spec in specs {
      let sourceURL = sourceDir.appendingPathComponent(spec.sourceName)
      let outputURL = outputDir.appendingPathComponent(spec.outputName)

      if fileManager.fileExists(atPath: outputURL.path) {
        try fileManager.removeItem(at: outputURL)
      }

      if spec.centeredCrop {
        try await exportCenteredCropVideo(sourceURL: sourceURL, outputURL: outputURL, renderSize: outputSize)
      } else {
        try fileManager.copyItem(at: sourceURL, to: outputURL)
      }

      print("Prepared \(spec.outputName)")
    }
  }
}
