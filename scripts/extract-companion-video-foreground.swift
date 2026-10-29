import AVFoundation
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

// Offline prototype: original frames and timing are preserved. No motion is synthesized.
let args = CommandLine.arguments
guard args.count == 3 else { fatalError("Usage: extract-video input.mp4 output-directory") }
let output = URL(fileURLWithPath: args[2], isDirectory: true)
if FileManager.default.fileExists(atPath: output.path),
   !(try FileManager.default.contentsOfDirectory(atPath: output.path)).isEmpty {
  fatalError("Output directory must be empty; existing frames are never overwritten")
}
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let asset = AVURLAsset(url: URL(fileURLWithPath: args[1]))
let track = asset.tracks(withMediaType: .video)[0]
let reader = try AVAssetReader(asset: asset)
let trackOutput = AVAssetReaderTrackOutput(track: track, outputSettings: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
])
reader.add(trackOutput)
guard reader.startReading() else { fatalError("Cannot decode video") }
let context = CIContext()
var index = 0
while let sample = trackOutput.copyNextSampleBuffer() {
  try autoreleasepool {
    guard let buffer = CMSampleBufferGetImageBuffer(sample) else { fatalError("Missing frame") }
    let handler = VNImageRequestHandler(cvPixelBuffer: buffer, options: [:])
    let request = VNGenerateForegroundInstanceMaskRequest()
    request.usesCPUOnly = true
    try handler.perform([request])
    guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
      fatalError("No foreground in frame \(index)")
    }
    let masked = try observation.generateMaskedImage(ofInstances: observation.allInstances, from: handler, croppedToInstancesExtent: false)
    let ci = CIImage(cvPixelBuffer: masked)
    guard let image = context.createCGImage(ci, from: ci.extent) else { fatalError("Render failed") }
    let path = output.appendingPathComponent(String(format: "%04d.png", index))
    guard let destination = CGImageDestinationCreateWithURL(path as CFURL, UTType.png.identifier as CFString, 1, nil) else { fatalError("Cannot save frame") }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { fatalError("Write failed") }
  }
  index += 1
  if index % 12 == 0 { print("Extracted \(index) frames"); fflush(stdout) }
}
guard reader.status == .completed else { fatalError("Incomplete decode") }
print("Complete: \(index) frames")
