import AVFoundation

func murmurRequireCaptureInput(_ input: AVAudioFormat) throws {
  // A disconnected input can report a zero-rate or zero-channel format. Passing
  // that to installTap raises an Objective-C exception, not a Swift Error.
  guard input.sampleRate.isFinite, input.sampleRate > 0, input.channelCount > 0 else {
    throw NSError(domain: "MurmurAudio", code: 2, userInfo: [
      NSLocalizedDescriptionKey: "capture_input_unavailable"
    ])
  }
}

func murmurCaptureConverter(from input: AVAudioFormat, to output: AVAudioFormat) throws -> AVAudioConverter {
  try murmurRequireCaptureInput(input)
  guard let converter = AVAudioConverter(from: input, to: output) else {
    throw NSError(domain: "MurmurAudio", code: 3, userInfo: [
      NSLocalizedDescriptionKey: "capture_converter_unavailable"
    ])
  }
  return converter
}

// Only this closed payload crosses getAudioState. Never serialize NSError.userInfo
// or port names, which can contain user or device content.
enum MurmurCaptureStep: String {
  case session_category, session_sample_rate, session_buffer_duration, session_activation
  case voice_processing, hardware_input, input_format, install_tap, engine_start
}

enum MurmurCaptureRoute: String {
  case none, built_in, bluetooth, wired, usb, other
}

struct MurmurCaptureFailure {
  let step: MurmurCaptureStep
  let hardware: AVAudioFormat?
  let output: AVAudioFormat?
  let route: MurmurCaptureRoute
  let voiceProcessing: Bool
  let error: NSError

  private func finiteRate(_ format: AVAudioFormat?) -> Double {
    guard let format, format.sampleRate.isFinite else { return 0 }
    return format.sampleRate
  }

  var payload: [String: Any] {
    let domain: String
    switch error.domain {
    case "MurmurAudio": domain = "murmur"
    case "com.apple.coreaudio.avfaudio": domain = "avfaudio"
    case NSOSStatusErrorDomain: domain = "osstatus"
    default: domain = "other"
    }
    return [
      "step": step.rawValue,
      "hardware_rate": finiteRate(hardware),
      "hardware_channels": hardware?.channelCount ?? 0,
      "output_rate": finiteRate(output),
      "output_channels": output?.channelCount ?? 0,
      "route": route.rawValue,
      "voice_processing": voiceProcessing,
      "error_domain": domain,
      "error_code": error.code
    ]
  }
}
