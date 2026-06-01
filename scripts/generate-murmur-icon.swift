import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

func fail(_ message: String) -> Never {
  fputs("\(message)\n", stderr)
  exit(1)
}

func setFill(_ context: CGContext, hex: Int) {
  context.setFillColor(
    red: CGFloat((hex >> 16) & 0xff) / 255.0,
    green: CGFloat((hex >> 8) & 0xff) / 255.0,
    blue: CGFloat(hex & 0xff) / 255.0,
    alpha: 1
  )
}

func setStroke(_ context: CGContext, hex: Int) {
  context.setStrokeColor(
    red: CGFloat((hex >> 16) & 0xff) / 255.0,
    green: CGFloat((hex >> 8) & 0xff) / 255.0,
    blue: CGFloat(hex & 0xff) / 255.0,
    alpha: 1
  )
}

func addWave(_ context: CGContext, startY: CGFloat, firstControlDeltaY: CGFloat) {
  let start = CGPoint(x: 244, y: startY)
  let control1 = CGPoint(x: 314, y: startY)
  let control2 = CGPoint(x: 314, y: startY + firstControlDeltaY)
  let end1 = CGPoint(x: 384, y: startY + firstControlDeltaY)
  let control3 = CGPoint(x: 454, y: startY + firstControlDeltaY)
  let control4 = CGPoint(x: 454, y: startY)
  let end2 = CGPoint(x: 524, y: startY)
  let control5 = CGPoint(x: 594, y: startY)
  let control6 = CGPoint(x: 594, y: startY + firstControlDeltaY)
  let end3 = CGPoint(x: 664, y: startY + firstControlDeltaY)
  let control7 = CGPoint(x: 734, y: startY + firstControlDeltaY)
  let control8 = CGPoint(x: 734, y: startY)
  let end4 = CGPoint(x: 804, y: startY)

  context.beginPath()
  context.move(to: start)
  context.addCurve(to: end1, control1: control1, control2: control2)
  context.addCurve(to: end2, control1: control3, control2: control4)
  context.addCurve(to: end3, control1: control5, control2: control6)
  context.addCurve(to: end4, control1: control7, control2: control8)
  context.strokePath()
}

var outputPaths: [String] = []
var requestedSize = 1024
var iterator = CommandLine.arguments.dropFirst().makeIterator()

while let argument = iterator.next() {
  if argument == "--size" {
    guard let sizeValue = iterator.next(), let parsedSize = Int(sizeValue), parsedSize > 0 else {
      fail("Expected a positive integer after --size")
    }
    requestedSize = parsedSize
  } else {
    outputPaths.append(argument)
  }
}

guard !outputPaths.isEmpty else {
  fail("Usage: swift scripts/generate-murmur-icon.swift [--size 1024] <output.png> [more-output.png...]")
}

let canonicalSize = CGFloat(1024)
let size = requestedSize
let scale = CGFloat(size) / canonicalSize
let colorSpace = CGColorSpaceCreateDeviceRGB()

for outputPath in outputPaths {
  guard let context = CGContext(
    data: nil,
    width: size,
    height: size,
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
  ) else {
    fail("Could not create icon context")
  }

  setFill(context, hex: 0x191714)
  context.fill(CGRect(x: 0, y: 0, width: size, height: size))

  context.scaleBy(x: scale, y: scale)
  context.setLineWidth(74)
  context.setLineCap(.round)

  setStroke(context, hex: 0xf8f4ed)
  addWave(context, startY: 570, firstControlDeltaY: -116)

  setStroke(context, hex: 0xdce8e1)
  addWave(context, startY: 434, firstControlDeltaY: 116)

  guard let image = context.makeImage() else {
    fail("Could not create icon image")
  }

  let outputURL = URL(fileURLWithPath: outputPath)
  guard let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    fail("Could not open output path: \(outputPath)")
  }

  CGImageDestinationAddImage(destination, image, nil)
  guard CGImageDestinationFinalize(destination) else {
    fail("Could not write icon: \(outputPath)")
  }
}
