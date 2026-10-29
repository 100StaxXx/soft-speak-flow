import AVFoundation
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

// Decode with Apple's actual alpha-aware path, not FFmpeg's opaque HEVC base
// layer. These samples are for poster matching and human edge/pose inspection.
let args = CommandLine.arguments
guard args.count == 3 || args.count == 4 else { fatalError("Usage: inspect-companion-alpha input.mov empty-output-directory [comma-separated-frame-indices]") }
let output = URL(fileURLWithPath: args[2], isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
guard try FileManager.default.contentsOfDirectory(atPath: output.path).isEmpty else { fatalError("Output must be empty") }
let asset = AVURLAsset(url: URL(fileURLWithPath: args[1]))
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero
let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
let indices = args.count == 4 ? args[3].split(separator: ",").map { Int($0)! } : [0, 24, 48, 72, 96]
for index in indices {
  let result = try await generator.image(at: CMTime(value: Int64(index), timescale: 24))
  let image = result.image
  let actual = result.actualTime
  guard abs(actual.seconds - Double(index) / 24) < 0.02 else { fatalError("Decoder did not return requested frame") }
  guard let context = CGContext(data: nil, width: image.width, height: image.height, bitsPerComponent: 8,
    bytesPerRow: image.width * 4, space: srgb,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue),
    let _ = context.data else { fatalError("Cannot create sRGB context") }
  context.setBlendMode(.copy)
  context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
  let target = output.appendingPathComponent(String(format: "%04d.png", index))
  guard let decoded = context.makeImage(),
    let writer = CGImageDestinationCreateWithURL(target as CFURL, UTType.png.identifier as CFString, 1, nil)
    else { fatalError("Cannot save decoded frame") }
  CGImageDestinationAddImage(writer, decoded, nil)
  guard CGImageDestinationFinalize(writer) else { fatalError("Cannot finalize decoded frame") }
  print("Decoded frame \(index) in sRGB, alpha info \(image.alphaInfo.rawValue)")
}
