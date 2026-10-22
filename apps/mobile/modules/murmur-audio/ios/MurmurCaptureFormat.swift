import AVFoundation

func murmurCaptureConverter(from input: AVAudioFormat, to output: AVAudioFormat) throws -> AVAudioConverter {
  // A disconnected input can report a zero-rate or zero-channel format. Passing
  // that to installTap raises an Objective-C exception, not a Swift Error.
  guard input.sampleRate.isFinite, input.sampleRate > 0, input.channelCount > 0 else {
    throw NSError(domain: "MurmurAudio", code: 2, userInfo: [
      NSLocalizedDescriptionKey: "capture_input_unavailable"
    ])
  }
  guard let converter = AVAudioConverter(from: input, to: output) else {
    throw NSError(domain: "MurmurAudio", code: 3, userInfo: [
      NSLocalizedDescriptionKey: "capture_converter_unavailable"
    ])
  }
  return converter
}
