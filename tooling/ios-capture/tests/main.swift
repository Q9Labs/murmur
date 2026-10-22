import AVFoundation

let output = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 24_000, channels: 1, interleaved: true)!
for (rate, channels) in [(0.0, AVAudioChannelCount(1)), (48_000.0, AVAudioChannelCount(0))] {
  let input = AVAudioFormat(standardFormatWithSampleRate: rate, channels: channels)!
  do {
    _ = try murmurCaptureConverter(from: input, to: output)
    fatalError("An unavailable input must not reach installTap")
  } catch {
    precondition((error as NSError).code == 2)
  }
}
for channels in [AVAudioChannelCount(1), 2] {
  let input = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: channels)!
  let converter = try murmurCaptureConverter(from: input, to: output)
  let buffer = AVAudioPCMBuffer(pcmFormat: input, frameCapacity: 960)!
  buffer.frameLength = 960
  for channel in 0..<Int(channels) {
    buffer.floatChannelData![channel].initialize(repeating: 0.25, count: 960)
  }
  let converted = AVAudioPCMBuffer(pcmFormat: output, frameCapacity: 512)!
  var supplied = false
  var error: NSError?
  converter.convert(to: converted, error: &error) { _, status in
    if supplied {
      status.pointee = .noDataNow
      return nil
    }
    supplied = true
    status.pointee = .haveData
    return buffer
  }
  precondition(error == nil && converted.frameLength > 0)
  precondition(converted.format.sampleRate == 24_000 && converted.format.channelCount == 1)
  precondition(converted.int16ChannelData![0][Int(converted.frameLength) - 1] > 0)
}
print("PASS native zero-rate/zero-channel rejection and mono/stereo PCM conversion")
