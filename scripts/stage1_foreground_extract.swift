import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

enum ExtractionMode: String {
  case foreground
  case saliency
}

enum ExtractError: Error, CustomStringConvertible {
  case usage
  case loadFailed(String)
  case noObservation
  case maskGenerationFailed
  case renderFailed
  case writeFailed(String)

  var description: String {
    switch self {
    case .usage:
      return "Usage: stage1_foreground_extract <input> <output> [foreground|saliency]"
    case .loadFailed(let path):
      return "Failed to load image: \(path)"
    case .noObservation:
      return "Vision did not return a foreground mask observation."
    case .maskGenerationFailed:
      return "Vision could not generate a masked foreground image."
    case .renderFailed:
      return "Failed to render the masked image."
    case .writeFailed(let path):
      return "Failed to write PNG: \(path)"
    }
  }
}

func loadCGImage(from path: String) throws -> CGImage {
  let url = URL(fileURLWithPath: path)
  guard
    let source = CGImageSourceCreateWithURL(url as CFURL, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else {
    throw ExtractError.loadFailed(path)
  }
  return image
}

func writePNG(_ image: CGImage, to path: String) throws {
  let url = URL(fileURLWithPath: path)
  guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    throw ExtractError.writeFailed(path)
  }

  CGImageDestinationAddImage(destination, image, nil)
  guard CGImageDestinationFinalize(destination) else {
    throw ExtractError.writeFailed(path)
  }
}

func renderPixelBuffer(_ pixelBuffer: CVPixelBuffer) throws -> CGImage {
  let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
  let context = CIContext(options: nil)
  guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else {
    throw ExtractError.renderFailed
  }
  return cgImage
}

do {
  let args = CommandLine.arguments.dropFirst()
  guard args.count == 2 || args.count == 3 else {
    throw ExtractError.usage
  }

  let inputPath = String(args[args.startIndex])
  let outputPath = String(args[args.index(after: args.startIndex)])
  let mode: ExtractionMode = {
    guard args.count == 3 else { return .foreground }
    return ExtractionMode(rawValue: String(args[args.index(args.startIndex, offsetBy: 2)])) ?? .foreground
  }()

  let sourceImage = try loadCGImage(from: inputPath)
  let handler = VNImageRequestHandler(cgImage: sourceImage, options: [:])

  let cgImage: CGImage
  switch mode {
  case .foreground:
    let request = VNGenerateForegroundInstanceMaskRequest()
    request.usesCPUOnly = true
    try handler.perform([request])

    guard let observation = request.results?.first else {
      throw ExtractError.noObservation
    }

    let maskedBuffer = try observation.generateMaskedImage(
      ofInstances: observation.allInstances,
      from: handler,
      croppedToInstancesExtent: false
    )
    cgImage = try renderPixelBuffer(maskedBuffer)
  case .saliency:
    let request = VNGenerateAttentionBasedSaliencyImageRequest()
    request.usesCPUOnly = true
    try handler.perform([request])

    guard let observation = request.results?.first else {
      throw ExtractError.noObservation
    }

    cgImage = try renderPixelBuffer(observation.pixelBuffer)
  }

  try writePNG(cgImage, to: outputPath)
  print(outputPath)
} catch {
  fputs("\(error)\n", stderr)
  exit(1)
}
