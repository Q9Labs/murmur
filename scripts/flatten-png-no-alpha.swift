import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct HexColor {
  let red: CGFloat
  let green: CGFloat
  let blue: CGFloat
}

func fail(_ message: String) -> Never {
  fputs("\(message)\n", stderr)
  exit(1)
}

func parseHexColor(_ value: String) -> HexColor {
  let trimmed = value.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
  guard trimmed.count == 6, let raw = Int(trimmed, radix: 16) else {
    fail("Expected background color like #191714")
  }

  return HexColor(
    red: CGFloat((raw >> 16) & 0xff) / 255.0,
    green: CGFloat((raw >> 8) & 0xff) / 255.0,
    blue: CGFloat(raw & 0xff) / 255.0
  )
}

let args = CommandLine.arguments
guard args.count == 4 else {
  fail("Usage: swift scripts/flatten-png-no-alpha.swift <input.png> <output.png> <background-hex>")
}

let inputURL = URL(fileURLWithPath: args[1])
let outputURL = URL(fileURLWithPath: args[2])
let background = parseHexColor(args[3])

guard let source = CGImageSourceCreateWithURL(inputURL as CFURL, nil),
      let inputImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
  fail("Could not read image: \(inputURL.path)")
}

let colorSpace = CGColorSpaceCreateDeviceRGB()
guard let context = CGContext(
  data: nil,
  width: inputImage.width,
  height: inputImage.height,
  bitsPerComponent: 8,
  bytesPerRow: 0,
  space: colorSpace,
  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
) else {
  fail("Could not create RGB image context")
}

context.setFillColor(red: background.red, green: background.green, blue: background.blue, alpha: 1)
context.fill(CGRect(x: 0, y: 0, width: inputImage.width, height: inputImage.height))
context.draw(inputImage, in: CGRect(x: 0, y: 0, width: inputImage.width, height: inputImage.height))

guard let outputImage = context.makeImage(),
      let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.png.identifier as CFString, 1, nil) else {
  fail("Could not create output image: \(outputURL.path)")
}

CGImageDestinationAddImage(destination, outputImage, nil)
guard CGImageDestinationFinalize(destination) else {
  fail("Could not write output image: \(outputURL.path)")
}
