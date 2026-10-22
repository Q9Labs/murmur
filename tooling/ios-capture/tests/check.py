#!/usr/bin/env python3
"""Exercise the production graph/state payload with AVFoundation and a hardware seam."""
# cspell:words xcrun swiftc iphonesimulator
import json
import os
import pathlib
import subprocess
import sys
import tempfile

root = pathlib.Path(__file__).resolve().parents[3]
module = 'apps/mobile/modules/murmur-audio/ios/MurmurAudioModule.swift'
helper = root / 'apps/mobile/modules/murmur-audio/ios/MurmurCaptureFormat.swift'
source = (root / module).read_text()
if len(sys.argv) == 3 and sys.argv[1] == '--baseline':
    source = subprocess.check_output(['git', 'show', f'{sys.argv[2]}:{module}'], cwd=root, text=True)
method = source.split('  private func configureAndStartCaptureEngine() throws {', 1)[1]
method = method.split('\n  private func stopCaptureSync', 1)[0]
state = source.split('  private func statePayload(reason: String) -> [String: Any] {', 1)[1]
state = state.split('\n  private func nextEventSeq', 1)[0]
start = source.split('  private func startCaptureSync(source: String, maxSessionSeconds: Int) throws {', 1)[1].split('\n  private func configureAndStartCaptureEngine', 1)[0]
reset = source.split('  private func resetCaptureEngine() {', 1)[1].split('\n  private func clearCaptureBufferSync', 1)[0]
production_method = method
method = '    let session = TestSession()\n    let inputNode = captureEngine.inputNode' + method.split('    let inputNode = captureEngine.inputNode', 1)[1]
prefix = '''import AVFoundation
private let murmurSampleRate = 24000.0
enum TestPortType: String { case builtInMic, bluetoothHFP, bluetoothLE, headsetMic, usbAudio }
struct TestPort { let portType: TestPortType }
struct TestRoute { let inputs: [TestPort] = [] }
struct TestSession { let currentRoute = TestRoute() }
final class CaptureHarness {
  let captureEngine = AVAudioEngine()
  var converter: AVAudioConverter?
  var captureFailure: MurmurCaptureFailure?
  var audioGenerationId = 1, droppedFrames = 0, playbackQueuedMs = 0
  var captureActive = false, playbackActive = false, captureSource = "microphone"
  var captureDeadline: DispatchWorkItem?
  func clearCaptureBufferSync() {}
  func scheduleCaptureDeadline(maxSessionSeconds: Int) {}
  func emitState(reason: String) {}
  let pcmFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 24000, channels: 1, interleaved: true)!
  func currentRoute() -> String { "unknown" }
  func nextEventSeq() -> Int { 1 }
  func handleInput(buffer: AVAudioPCMBuffer) {}
  func configureAndStartCaptureEngine() throws {
'''
lifecycle_methods = '\n  func startCaptureSync(source: String, maxSessionSeconds: Int) throws {' + start + '\n  func resetCaptureEngine() {' + reset
state_method = '\n  func statePayload(reason: String) -> [String: Any] {' + state
manual_test = '''
let harness = CaptureHarness()
try harness.captureEngine.enableManualRenderingMode(.offline, format: AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1)!, maximumFrameCount: 960)
do {
  try harness.configureAndStartCaptureEngine()
  fatalError("Unavailable capture input must not start")
} catch {
  precondition(!harness.captureEngine.isRunning)
  print("PASS real AVFoundation offline graph rejects unavailable input")
}
'''
seam = '''
final class TestInputNode {
  var isVoiceProcessingEnabled = true
  var hardware = AVAudioFormat(standardFormatWithSampleRate: 0, channels: 1)!
  var output = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1)!
  var tapped = false
  var hardwareReads = 0
  func inputFormat(forBus: Int) -> AVAudioFormat { hardwareReads += 1; return hardware }
  func outputFormat(forBus: Int) -> AVAudioFormat { output }
  func setVoiceProcessingEnabled(_ enabled: Bool) throws { isVoiceProcessingEnabled = enabled }
  func removeTap(onBus: Int) { tapped = false }
  func installTap(onBus: Int, bufferSize: Int, format: AVAudioFormat?, block: @escaping (AVAudioPCMBuffer, AVAudioTime) -> Void) { tapped = true }
}
final class TestEngine {
  let inputNode = TestInputNode()
  var isRunning = false
  func stop() { isRunning = false }
  func reset() {}
  func prepare() {}
  func start() throws { isRunning = true }
}
'''
hardware_test = '''
for (rate, channels) in [(0.0, AVAudioChannelCount(1)), (48000.0, AVAudioChannelCount(0))] {
  let harness = CaptureHarness()
  harness.captureEngine.inputNode.hardware = AVAudioFormat(standardFormatWithSampleRate: rate, channels: channels)!
  // Output stays populated and voice processing is already enabled.
  do {
    try harness.startCaptureSync(source: "microphone", maxSessionSeconds: 60)
    fatalError("Unavailable hardware with populated output must not install a tap")
  } catch {
    precondition(!harness.captureEngine.inputNode.tapped && !harness.captureEngine.isRunning && harness.converter == nil)
    precondition(harness.captureEngine.inputNode.hardwareReads == 2, "Both retries must check hardware")
  }
  if rate == 0 {
    let data = try JSONSerialization.data(withJSONObject: harness.statePayload(reason: "get_audio_state"), options: [.sortedKeys])
    print("BRIDGE_JSON:" + String(data: data, encoding: .utf8)!)
  }
  harness.captureEngine.inputNode.hardware = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1)!
  try harness.startCaptureSync(source: "microphone", maxSessionSeconds: 60)
  precondition(harness.captureFailure == nil && harness.captureActive, "Success must clear stale diagnostics")
}
let invalidOutput = CaptureHarness()
invalidOutput.captureEngine.inputNode.hardware = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1)!
invalidOutput.captureEngine.inputNode.output = AVAudioFormat(standardFormatWithSampleRate: 0, channels: 1)!
do {
  try invalidOutput.configureAndStartCaptureEngine()
  fatalError("Invalid negotiated output must not install a tap")
} catch { precondition(!invalidOutput.captureEngine.inputNode.tapped) }
let valid = CaptureHarness()
valid.captureEngine.inputNode.hardware = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1)!
try valid.configureAndStartCaptureEngine()
precondition(valid.captureEngine.inputNode.tapped && valid.captureEngine.isRunning && valid.converter != nil)
print("PASS hardware unavailable/populated output, invalid output, and available-input setup")
'''
with tempfile.TemporaryDirectory(prefix='murmur-ios-capture-') as directory:
    directory = pathlib.Path(directory)
    main = directory / 'main.swift'
    ios_source = directory / 'Capture.swift'
    ios_source.write_text(prefix + production_method + lifecycle_methods + state_method + '\n}')
    sdk = subprocess.check_output(['xcrun', '--sdk', 'iphonesimulator', '--show-sdk-path'], text=True).strip()
    subprocess.run(['xcrun', 'swiftc', '-typecheck', '-parse-as-library', '-sdk', sdk,
                    '-target', 'arm64-apple-ios15.1-simulator', str(ios_source), str(helper)], check=True, timeout=30)
    binary = directory / 'capture-test'
    for test_prefix, test in [(prefix, manual_test), (seam + prefix.replace('AVAudioEngine()', 'TestEngine()'), hardware_test)]:
        main.write_text(test_prefix + method + lifecycle_methods + state_method + '\n}\n' + test)
        subprocess.run(['xcrun', 'swiftc', str(main), str(helper), '-o', str(binary)], check=True, timeout=30)
        result = subprocess.run([str(binary)], text=True, stdout=subprocess.PIPE, timeout=30)
        print(result.stdout, end='')
        if result.returncode:
            sys.exit(1)
        for line in result.stdout.splitlines():
            if line.startswith('BRIDGE_JSON:'):
                payload = json.loads(line.removeprefix('BRIDGE_JSON:'))
                expected = json.loads((root / 'tooling/ios-capture/tests/capture-failure.json').read_text())
                assert payload == expected, 'Native getAudioState serialization differs from JS test fixture'
                if os.environ.get('MURMUR_CAPTURE_BRIDGE_PATH'):
                    pathlib.Path(os.environ['MURMUR_CAPTURE_BRIDGE_PATH']).write_text(json.dumps(payload, indent=2) + '\n')
                print('PASS actual native state payload matches reporting fixture')
    subprocess.run(['xcrun', 'swiftc', str(helper), str(root / 'tooling/ios-capture/tests/main.swift'), '-o', str(binary)], check=True, timeout=30)
    subprocess.run([str(binary)], check=True, timeout=30)
