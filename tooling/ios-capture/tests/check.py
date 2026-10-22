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
method = method.replace('AVAudioSession.sharedInstance()', 'TestSession.sharedInstance()')
prefix = '''import AVFoundation
private let murmurSampleRate = 24000.0
enum TestPortType: String { case builtInMic, bluetoothHFP, bluetoothLE, headsetMic, usbAudio }
struct TestPort { let portType: TestPortType }
struct TestRoute { let inputs: [TestPort] = [] }
enum TestSessionOperation: String, CaseIterable {
  case session_category, session_sample_rate, session_buffer_duration, session_activation
}
final class TestSession {
  enum Category { case playAndRecord }
  enum Mode { case voiceChat }
  enum Option { case allowBluetooth, allowBluetoothA2DP, defaultToSpeaker }
  static let shared = TestSession()
  static func sharedInstance() -> TestSession { shared }
  let currentRoute = TestRoute()
  var failure: TestSessionOperation?
  var failureAttempt: Int?
  var attempt = 0
  var calls: [TestSessionOperation] = []
  func check(_ operation: TestSessionOperation) throws {
    if operation == .session_category { attempt += 1 }
    calls.append(operation)
    if operation == failure && (failureAttempt == nil || failureAttempt == attempt) {
      throw NSError(domain: NSOSStatusErrorDomain, code: -50,
        userInfo: [NSLocalizedDescriptionKey: "private platform error", "port_name": "private device"])
    }
  }
  func setCategory(_ category: Category, mode: Mode, options: [Option]) throws { try check(.session_category) }
  func setPreferredSampleRate(_ rate: Double) throws { try check(.session_sample_rate) }
  func setPreferredIOBufferDuration(_ duration: Double) throws { try check(.session_buffer_duration) }
  func setActive(_ active: Bool) throws { try check(.session_activation) }
}
final class CaptureHarness {
  let captureEngine = AVAudioEngine()
  var converter: AVAudioConverter?
  var captureFailure: MurmurCaptureFailure?
  var captureInputNode: AVAudioInputNode?
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
  private let node = TestInputNode()
  var inputNodeReads = 0, graphOperations = 0
  var inputNode: TestInputNode { inputNodeReads += 1; return node }
  var isRunning = false
  func stop() { graphOperations += 1; isRunning = false }
  func reset() { graphOperations += 1 }
  func prepare() { graphOperations += 1 }
  func start() throws { graphOperations += 1; isRunning = true }
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
session_test = """
if CommandLine.arguments.count > 1 {
  let operation = TestSessionOperation(rawValue: CommandLine.arguments[1])!
  let afterGraphFailure = CommandLine.arguments.count > 2
  TestSession.shared.failure = operation
  TestSession.shared.failureAttempt = afterGraphFailure ? 2 : nil
  let harness = CaptureHarness()
  do {
    try harness.startCaptureSync(source: "microphone", maxSessionSeconds: 60)
    fatalError("Session setup failure must not start capture")
  } catch {
    let state = harness.statePayload(reason: "get_audio_state")
    let payload = state["capture_failure"] as? [String: Any]
    precondition(payload?["step"] as? String == operation.rawValue,
      "Session failure must retain latest diagnostics: " + operation.rawValue)
    precondition(harness.captureEngine.inputNodeReads == (afterGraphFailure ? 1 : 0),
      "Session failure must not access an uninitialized input node")
    precondition(harness.captureEngine.graphOperations == (afterGraphFailure ? 3 : 0),
      "Session failure must not access an uninitialized graph")
    precondition(!harness.captureEngine.isRunning && !harness.captureActive && harness.converter == nil)
    let operations = TestSessionOperation.allCases
    let throughFailure = Array(operations.prefix(through: operations.firstIndex(of: operation)!))
    precondition(TestSession.shared.calls == (afterGraphFailure ? operations : throughFailure) + throughFailure)
    let data = try JSONSerialization.data(withJSONObject: state, options: [.sortedKeys])
    print("SESSION_BRIDGE_JSON:" + String(data: data, encoding: .utf8)!)
    print("PASS session failure " + operation.rawValue + (afterGraphFailure ? " after graph failure" : " on both attempts"))
  }
  TestSession.shared.failure = nil
  harness.captureEngine.inputNode.hardware = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1)!
  try harness.startCaptureSync(source: "microphone", maxSessionSeconds: 60)
  precondition(harness.captureActive && harness.statePayload(reason: "get_audio_state")["capture_failure"] == nil)
} else {
""" + hardware_test + "\n}"
with tempfile.TemporaryDirectory(prefix='murmur-ios-capture-') as directory:
    directory = pathlib.Path(directory)
    main = directory / 'main.swift'
    ios_source = directory / 'Capture.swift'
    ios_source.write_text(prefix + production_method + lifecycle_methods + state_method + '\n}')
    sdk = subprocess.check_output(['xcrun', '--sdk', 'iphonesimulator', '--show-sdk-path'], text=True).strip()
    subprocess.run(['xcrun', 'swiftc', '-typecheck', '-parse-as-library', '-sdk', sdk,
                    '-target', 'arm64-apple-ios15.1-simulator', str(ios_source), str(helper)], check=True, timeout=30)
    binary = directory / 'capture-test'
    for test_prefix, test in [(prefix, manual_test), (seam + prefix.replace('AVAudioEngine()', 'TestEngine()').replace('AVAudioInputNode?', 'TestInputNode?'), session_test)]:
        runtime_method = method if test_prefix == prefix else method.replace('AVAudioInputNode?', 'TestInputNode?')
        main.write_text(test_prefix + runtime_method + lifecycle_methods + state_method + '\n}\n' + test)
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
    failures = 0
    bridge_states = []
    expected_states = json.loads((root / 'tooling/ios-capture/tests/session-failures.json').read_text())
    for expected in expected_states:
        step = expected['capture_failure']['step']
        for scenario in [[], ['after_graph_failure']]:
            print('CHECK session operation ' + step + (' after graph failure' if scenario else ' on both attempts'), flush=True)
            result = subprocess.run([str(binary), step, *scenario], text=True, stdout=subprocess.PIPE, timeout=30)
            print(result.stdout, end='')
            if result.returncode:
                failures += 1
                continue
            lines = [line for line in result.stdout.splitlines() if line.startswith('SESSION_BRIDGE_JSON:')]
            assert len(lines) == 1, 'Expected actual native session-failure state'
            payload = json.loads(lines[0].removeprefix('SESSION_BRIDGE_JSON:'))
            assert payload == expected, 'Native session state differs from reporting fixture'
            assert 'private' not in json.dumps(payload), 'Native state leaked platform error content'
            bridge_states.append(payload)
    if failures:
        print(f'FAIL {failures} session operation/scenario regressions', flush=True)
        sys.exit(1)
    if os.environ.get('MURMUR_SESSION_BRIDGE_PATH'):
        pathlib.Path(os.environ['MURMUR_SESSION_BRIDGE_PATH']).write_text(json.dumps(bridge_states, indent=2) + '\n')
    print('PASS all four session operations on both retries and after a graph failure; native serialization matches reporting fixtures')
    subprocess.run(['xcrun', 'swiftc', str(helper), str(root / 'tooling/ios-capture/tests/main.swift'), '-o', str(binary)], check=True, timeout=30)
    subprocess.run([str(binary)], check=True, timeout=30)
