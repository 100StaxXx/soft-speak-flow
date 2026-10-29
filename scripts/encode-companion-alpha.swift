import AVFoundation
import CoreGraphics
import Foundation
import ImageIO
import VideoToolbox

// Encode an approved, straight-alpha sRGB PNG sequence through one explicit
// premultiplied BGRA path. Never guess the alpha association or color matrix.
let args = CommandLine.arguments
guard args.count == 3 else { fatalError("Usage: encode-companion-alpha frames-directory output.mov") }
let directory = URL(fileURLWithPath: args[1], isDirectory: true)
let destination = URL(fileURLWithPath: args[2])
guard !FileManager.default.fileExists(atPath: destination.path) else { fatalError("Output already exists") }
let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
  .filter { $0.pathExtension == "png" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
guard !files.isEmpty else { fatalError("No PNG frames") }
func loadImage(_ url: URL) -> CGImage {
  guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { fatalError("Cannot read frame") }
  return image
}
let first = loadImage(files[0])
let width = first.width, height = first.height
let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
let writer = try AVAssetWriter(outputURL: destination, fileType: .mov)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.hevcWithAlpha,
  AVVideoWidthKey: width, AVVideoHeightKey: height,
  AVVideoColorPropertiesKey: [
    AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
    AVVideoTransferFunctionKey: AVVideoTransferFunction_IEC_sRGB,
    AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
  ],
  AVVideoCompressionPropertiesKey: [
    AVVideoAverageBitRateKey: 4_000_000,
    AVVideoExpectedSourceFrameRateKey: 24,
    AVVideoMaxKeyFrameIntervalKey: 24,
    AVVideoAllowFrameReorderingKey: false,
    kVTCompressionPropertyKey_TargetQualityForAlpha as String: 1.0,
    kVTCompressionPropertyKey_AlphaChannelMode as String: kVTAlphaChannelMode_PremultipliedAlpha,
  ],
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
  kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height,
  kCVPixelBufferCGImageCompatibilityKey as String: true,
  kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
])
guard writer.canAdd(input) else { fatalError("HEVC alpha encoder unavailable") }
writer.add(input)
guard writer.startWriting() else { fatalError("Cannot start encoding: \(String(describing: writer.error))") }
writer.startSession(atSourceTime: .zero)
for (index, file) in files.enumerated() {
  autoreleasepool {
    let image = loadImage(file)
    guard image.width == width && image.height == height else { fatalError("Frame size changed") }
    var optional: CVPixelBuffer?
    guard let pool = adaptor.pixelBufferPool,
          CVPixelBufferPoolCreatePixelBuffer(nil, pool, &optional) == kCVReturnSuccess,
          let buffer = optional else { fatalError("Cannot allocate pixel buffer") }
    CVPixelBufferLockBaseAddress(buffer, [])
    guard let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height,
      bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer), space: srgb,
      bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)
      else { fatalError("Cannot create sRGB drawing context") }
    context.setBlendMode(.copy)
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    CVPixelBufferUnlockBaseAddress(buffer, [])
    CVBufferSetAttachment(buffer, kCVImageBufferCGColorSpaceKey, srgb, .shouldPropagate)
    CVBufferSetAttachment(buffer, kCVImageBufferAlphaChannelModeKey, kCVImageBufferAlphaChannelMode_PremultipliedAlpha, .shouldPropagate)
    let deadline = Date().addingTimeInterval(15)
    while !input.isReadyForMoreMediaData {
      guard writer.status == .writing && Date() < deadline else { fatalError("Encoder stalled") }
      Thread.sleep(forTimeInterval: 0.005)
    }
    guard adaptor.append(buffer, withPresentationTime: CMTime(value: Int64(index), timescale: 24)) else {
      fatalError("Cannot encode frame: \(String(describing: writer.error))")
    }
  }
}
writer.endSession(atSourceTime: CMTime(value: Int64(files.count), timescale: 24))
input.markAsFinished()
let finished = DispatchSemaphore(value: 0)
writer.finishWriting { finished.signal() }
guard finished.wait(timeout: .now() + 30) == .success, writer.status == .completed else {
  fatalError("Encoding failed: \(String(describing: writer.error))")
}
print("Encoded \(files.count) frames with explicit sRGB/BT.709 color and premultiplied alpha: \(destination.path)")
