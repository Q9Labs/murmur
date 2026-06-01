import AVFoundation
import CryptoKit
import DeviceCheck
import ExpoModulesCore

private let murmurSampleRate = 16_000.0
private let murmurFrameBytes = 640
private let murmurFrameDurationMs = 20
private let murmurAppAttestKeyId = "murmur.app_attest.key_id.v1"

public class MurmurAudioModule: Module {
  private let captureEngine = AVAudioEngine()
  private let playbackEngine = AVAudioEngine()
  private let playerNode = AVAudioPlayerNode()
  private let audioQueue = DispatchQueue(label: "murmur.audio.native")
  private var converter: AVAudioConverter?
  private var captureBuffer = Data()
  private var captureActive = false
  private var playbackActive = false
  private var playbackQueuedMs = 0
  private var playbackGeneration = 0
  private var droppedFrames = 0
  private var eventSeq = 0
  private var audioGenerationId = 0
  private let pcmFormat = AVAudioFormat(
    commonFormat: .pcmFormatInt16,
    sampleRate: murmurSampleRate,
    channels: 1,
    interleaved: true
  )!

  public func definition() -> ModuleDefinition {
    Name("MurmurAudio")
    Events("onAudioFrame", "onAudioState")

    AsyncFunction("requestMicrophonePermission") { (promise: Promise) in
      AVAudioSession.sharedInstance().requestRecordPermission { granted in
        promise.resolve(granted)
      }
    }

    AsyncFunction("getAudioState") {
      return self.statePayload(reason: "get_audio_state")
    }

    AsyncFunction("startCapture") {
      try self.startCaptureSync()
      return self.statePayload(reason: "capture_started")
    }.runOnQueue(.main)

    AsyncFunction("stopCapture") { (reason: String?) in
      self.stopCaptureSync(reason: reason ?? "stop_capture")
      return self.statePayload(reason: reason ?? "stop_capture")
    }.runOnQueue(.main)

    AsyncFunction("startPlayback") {
      try self.startPlaybackSync()
      return self.statePayload(reason: "playback_started")
    }.runOnQueue(.main)

    AsyncFunction("enqueuePcm16") { (data: Data) in
      try self.enqueuePlayback(data: data)
      return self.statePayload(reason: "playback_enqueued")
    }.runOnQueue(.main)

    AsyncFunction("clearPlayback") { (reason: String?) in
      self.clearPlaybackSync(reason: reason ?? "clear_playback")
      return self.statePayload(reason: reason ?? "clear_playback")
    }.runOnQueue(.main)

    AsyncFunction("requestPlayIntegrityToken") { (nonce: String, promise: Promise) in
      self.requestAppAttestToken(nonce: nonce, promise: promise)
    }

    OnAppEntersBackground {
      self.emitState(reason: "app_background_preserved")
    }

    OnDestroy {
      self.stopCaptureSync(reason: "module_destroy")
      self.clearPlaybackSync(reason: "module_destroy")
    }
  }

  private func startCaptureSync() throws {
    if captureActive {
      return
    }

    let session = AVAudioSession.sharedInstance()
    try session.setCategory(
      .playAndRecord,
      mode: .voiceChat,
      options: [.allowBluetooth, .allowBluetoothA2DP, .defaultToSpeaker]
    )
    try session.setPreferredSampleRate(48_000)
    try session.setPreferredIOBufferDuration(0.02)
    try session.setActive(true)

    audioGenerationId += 1
    droppedFrames = 0
    captureBuffer.removeAll(keepingCapacity: true)

    let inputNode = captureEngine.inputNode
    let inputFormat = inputNode.outputFormat(forBus: 0)
    converter = AVAudioConverter(from: inputFormat, to: pcmFormat)

    if inputNode.isVoiceProcessingEnabled == false {
      try? inputNode.setVoiceProcessingEnabled(true)
    }

    inputNode.removeTap(onBus: 0)
    inputNode.installTap(onBus: 0, bufferSize: 960, format: inputFormat) { [weak self] buffer, _ in
      self?.handleInput(buffer: buffer)
    }

    captureEngine.prepare()
    try captureEngine.start()
    captureActive = true
    emitState(reason: "capture_started")
  }

  private func stopCaptureSync(reason: String) {
    if captureActive {
      captureEngine.inputNode.removeTap(onBus: 0)
      captureEngine.stop()
    }
    captureBuffer.removeAll(keepingCapacity: true)
    converter = nil
    captureActive = false
    emitState(reason: reason)
  }

  private func startPlaybackSync() throws {
    if playbackActive {
      return
    }

    let session = AVAudioSession.sharedInstance()
    try session.setCategory(
      .playAndRecord,
      mode: .voiceChat,
      options: [.allowBluetooth, .allowBluetoothA2DP, .defaultToSpeaker]
    )
    try session.setActive(true)

    if playerNode.engine == nil {
      playbackEngine.attach(playerNode)
      playbackEngine.connect(playerNode, to: playbackEngine.mainMixerNode, format: pcmFormat)
    }
    playbackEngine.prepare()
    try playbackEngine.start()
    playerNode.play()
    playbackActive = true
    playbackGeneration += 1
    emitState(reason: "playback_started")
  }

  private func enqueuePlayback(data: Data) throws {
    if !playbackActive {
      try startPlaybackSync()
    }
    guard data.count > 0, data.count % 2 == 0 else {
      return
    }

    let frameCount = AVAudioFrameCount(data.count / 2)
    guard let buffer = AVAudioPCMBuffer(pcmFormat: pcmFormat, frameCapacity: frameCount) else {
      return
    }
    buffer.frameLength = frameCount
    let audioBuffer = buffer.audioBufferList.pointee.mBuffers
    if let target = audioBuffer.mData {
      data.copyBytes(to: target.assumingMemoryBound(to: UInt8.self), count: data.count)
    }

    let queuedMs = Int(Double(frameCount) / murmurSampleRate * 1000.0)
    playbackQueuedMs += queuedMs
    let generation = playbackGeneration
    playerNode.scheduleBuffer(buffer) { [weak self] in
      DispatchQueue.main.async {
        guard let self else {
          return
        }
        if generation != self.playbackGeneration {
          return
        }
        self.playbackQueuedMs = max(0, self.playbackQueuedMs - queuedMs)
        if self.playbackQueuedMs == 0 {
          self.finishPlaybackSync(reason: "playback_finished")
          return
        }
        self.emitState(reason: "playback_buffer_complete")
      }
    }
    emitState(reason: "playback_enqueued")
  }

  private func clearPlaybackSync(reason: String) {
    playbackGeneration += 1
    playerNode.stop()
    playbackEngine.stop()
    playbackQueuedMs = 0
    playbackActive = false
    emitState(reason: reason)
  }

  private func finishPlaybackSync(reason: String) {
    playbackGeneration += 1
    playerNode.stop()
    playbackEngine.stop()
    playbackQueuedMs = 0
    playbackActive = false
    emitState(reason: reason)
  }

  private func requestAppAttestToken(nonce: String, promise: Promise) {
    guard nonce.count >= 16 else {
      promise.resolve([
        "available": false,
        "platform": "ios",
        "provider": "app_attest",
        "reason": "nonce_too_short"
      ] as [String: Any])
      return
    }

    let service = DCAppAttestService.shared
    guard service.isSupported else {
      promise.resolve([
        "available": false,
        "platform": "ios",
        "provider": "app_attest",
        "reason": "app_attest_unsupported"
      ] as [String: Any])
      return
    }

    let clientDataHash = Data(SHA256.hash(data: Data(nonce.utf8)))
    if let keyId = UserDefaults.standard.string(forKey: murmurAppAttestKeyId) {
      service.generateAssertion(keyId, clientDataHash: clientDataHash) { assertion, error in
        if let assertion {
          promise.resolve([
            "available": true,
            "kind": "assertion",
            "key_id": keyId,
            "nonce": nonce,
            "platform": "ios",
            "provider": "app_attest",
            "token": assertion.base64EncodedString()
          ] as [String: Any])
          return
        }

        UserDefaults.standard.removeObject(forKey: murmurAppAttestKeyId)
        self.generateAndAttestAppAttestKey(
          clientDataHash: clientDataHash,
          nonce: nonce,
          promise: promise,
          previousError: error
        )
      }
      return
    }

    generateAndAttestAppAttestKey(
      clientDataHash: clientDataHash,
      nonce: nonce,
      promise: promise,
      previousError: nil
    )
  }

  private func generateAndAttestAppAttestKey(
    clientDataHash: Data,
    nonce: String,
    promise: Promise,
    previousError: Error?
  ) {
    let service = DCAppAttestService.shared
    service.generateKey { keyId, keyError in
      guard let keyId else {
        promise.resolve([
          "available": false,
          "platform": "ios",
          "provider": "app_attest",
          "reason": keyError?.localizedDescription ?? previousError?.localizedDescription ?? "app_attest_key_failed"
        ] as [String: Any])
        return
      }

      service.attestKey(keyId, clientDataHash: clientDataHash) { attestation, attestError in
        guard let attestation else {
          promise.resolve([
            "available": false,
            "platform": "ios",
            "provider": "app_attest",
            "reason": attestError?.localizedDescription ?? previousError?.localizedDescription ?? "app_attest_attestation_failed"
          ] as [String: Any])
          return
        }

        UserDefaults.standard.set(keyId, forKey: murmurAppAttestKeyId)
        promise.resolve([
          "available": true,
          "kind": "attestation",
          "key_id": keyId,
          "nonce": nonce,
          "platform": "ios",
          "provider": "app_attest",
          "token": attestation.base64EncodedString()
        ] as [String: Any])
      }
    }
  }

  private func handleInput(buffer: AVAudioPCMBuffer) {
    guard let converter else {
      return
    }

    let outputCapacity = AVAudioFrameCount(
      max(1.0, Double(buffer.frameLength) * murmurSampleRate / buffer.format.sampleRate)
    )
    guard let converted = AVAudioPCMBuffer(pcmFormat: pcmFormat, frameCapacity: outputCapacity + 32) else {
      return
    }

    var usedInput = false
    var conversionError: NSError?
    converter.convert(to: converted, error: &conversionError) { _, status in
      if usedInput {
        status.pointee = .noDataNow
        return nil
      }
      usedInput = true
      status.pointee = .haveData
      return buffer
    }

    if conversionError != nil || converted.frameLength == 0 {
      droppedFrames += 1
      return
    }

    let audioBuffer = converted.audioBufferList.pointee.mBuffers
    guard let dataPointer = audioBuffer.mData else {
      return
    }

    audioQueue.async {
      self.captureBuffer.append(dataPointer.assumingMemoryBound(to: UInt8.self), count: Int(audioBuffer.mDataByteSize))
      while self.captureBuffer.count >= murmurFrameBytes {
        let frame = self.captureBuffer.prefix(murmurFrameBytes)
        self.captureBuffer.removeFirst(murmurFrameBytes)
        self.emitFrame(data: Data(frame))
      }
    }
  }

  private func emitFrame(data: Data) {
    let payload = [
      "audio_generation_id": audioGenerationId,
      "data": data,
      "duration_ms": murmurFrameDurationMs,
      "event_seq": nextEventSeq(),
      "rms": rms(data: data),
      "sample_rate": Int(murmurSampleRate),
      "timestamp_ms": Int(Date().timeIntervalSince1970 * 1000)
    ] as [String: Any]

    DispatchQueue.main.async {
      self.sendEvent("onAudioFrame", payload)
    }
  }

  private func emitState(reason: String) {
    let payload = statePayload(reason: reason)
    DispatchQueue.main.async {
      self.sendEvent("onAudioState", payload)
    }
  }

  private func statePayload(reason: String) -> [String: Any] {
    return [
      "audio_generation_id": audioGenerationId,
      "capture_active": captureActive,
      "dropped_frames": droppedFrames,
      "event_seq": nextEventSeq(),
      "playback_active": playbackActive,
      "playback_queued_ms": playbackQueuedMs,
      "reason": reason,
      "route": currentRoute(),
      "sample_rate": Int(murmurSampleRate)
    ]
  }

  private func nextEventSeq() -> Int {
    eventSeq += 1
    return eventSeq
  }

  private func currentRoute() -> String {
    let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
    if outputs.isEmpty {
      return "unknown"
    }
    return outputs.map { $0.portType.rawValue }.joined(separator: ",")
  }

  private func rms(data: Data) -> Double {
    if data.isEmpty {
      return 0
    }
    var sum = 0.0
    data.withUnsafeBytes { rawBuffer in
      let samples = rawBuffer.bindMemory(to: Int16.self)
      for sample in samples {
        let normalized = Double(sample) / Double(Int16.max)
        sum += normalized * normalized
      }
      if samples.count > 0 {
        sum /= Double(samples.count)
      }
    }
    return sqrt(sum)
  }
}
