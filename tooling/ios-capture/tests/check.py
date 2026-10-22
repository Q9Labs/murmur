#!/usr/bin/env python3
"""Run the production capture graph against macOS AVFoundation without a mic.

Only AVAudioSession is replaced (it is iOS-only). This checks the no-input native
failure, not a physical iPhone route transition. Pass --baseline REF to compare.
"""
# cspell:words xcrun swiftc iphonesimulator
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
production_method = method
# Session activation needs an iPhone. Keep the actual graph setup unchanged.
method = '    let session = TestSession()\n    let inputNode = captureEngine.inputNode' + method.split('    let inputNode = captureEngine.inputNode', 1)[1]
prefix = '''import AVFoundation
struct TestPort { let portType: TestPortType }
struct TestPortType { let rawValue: String }
struct TestRoute { let inputs: [TestPort] = [] }
struct TestSession { let currentRoute = TestRoute() }
final class CaptureHarness {
  let captureEngine = AVAudioEngine()
  var converter: AVAudioConverter?
  let pcmFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 24000, channels: 1, interleaved: true)!
  func handleInput(buffer: AVAudioPCMBuffer) {}
  func configure() throws {
'''
suffix = '''
}
let harness = CaptureHarness()
// Manual mode has no hardware input and does not support voice processing.
// The old path swallowed that error then reached Apple's invalid-format API.
try harness.captureEngine.enableManualRenderingMode(.offline, format: AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1)!, maximumFrameCount: 960)
do {
  try harness.configure()
  fatalError("Unavailable capture input must not start")
} catch {
  precondition(!harness.captureEngine.isRunning)
  print("PASS native capture rejects unavailable input without abort: \\(error)")
}
'''
with tempfile.TemporaryDirectory(prefix='murmur-ios-capture-') as directory:
    directory = pathlib.Path(directory)
    main = directory / 'main.swift'
    # Check the actual iOS session and graph APIs without an app build or device.
    ios_source = directory / 'Capture.swift'
    ios_source.write_text(prefix + production_method + '\n}')
    sdk = subprocess.check_output(['xcrun', '--sdk', 'iphonesimulator', '--show-sdk-path'], text=True).strip()
    ios_sources = [str(ios_source)] + ([str(helper)] if helper.exists() else [])
    subprocess.run(['xcrun', 'swiftc', '-typecheck', '-parse-as-library', '-sdk', sdk,
                    '-target', 'arm64-apple-ios15.1-simulator', *ios_sources], check=True, timeout=30)
    main.write_text(prefix + method + suffix)
    sources = [str(main)]
    if helper.exists():
        sources.append(str(helper))
    binary = directory / 'capture-test'
    subprocess.run(['xcrun', 'swiftc', *sources, '-o', str(binary)], check=True, timeout=30)
    result = subprocess.run([str(binary)], timeout=30)
    if result.returncode:
        sys.exit(1)
    if len(sys.argv) == 1:
        subprocess.run(['xcrun', 'swiftc', str(helper), str(root / 'tooling/ios-capture/tests/main.swift'), '-o', str(binary)], check=True, timeout=30)
        subprocess.run([str(binary)], check=True, timeout=30)
