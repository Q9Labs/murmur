package expo.modules.murmuraudio

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.AudioEffect
import android.media.audiofx.AutomaticGainControl
import android.media.audiofx.NoiseSuppressor
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.net.Uri
import android.media.projection.MediaProjectionManager
import com.google.android.gms.tasks.Tasks
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.max
import kotlin.math.sqrt

private const val MURMUR_SAMPLE_RATE = 24_000
private const val MURMUR_FRAME_BYTES = 960
private const val MURMUR_FRAME_DURATION_MS = 20
private const val MURMUR_MAX_CAPTURE_DURATION_MS = 300_000L
private const val DEVICE_PLAYBACK_PERMISSION_REQUEST_CODE = 41_271
private const val OVERLAY_PERMISSION_REQUEST_CODE = 41_272

class MurmurAudioModule : Module(), MurmurCaptureListener {
  @Volatile private var activityForeground = true
  @Volatile private var captureActive = false
  @Volatile private var playbackActive = false
  private var recorder: AudioRecord? = null
  private var captureThread: Thread? = null
  private var audioTrack: AudioTrack? = null
  private var echoCanceler: AcousticEchoCanceler? = null
  private var noiseSuppressor: NoiseSuppressor? = null
  private var gainControl: AutomaticGainControl? = null
  private val droppedFrames = AtomicInteger(0)
  private val eventSeq = AtomicInteger(0)
  private val captureReadErrors = AtomicInteger(0)
  private val captureFramesEmitted = AtomicLong(0)
  private val captureBytesEmitted = AtomicLong(0)
  private val playbackChunksReceived = AtomicLong(0)
  private val playbackBytesRequested = AtomicLong(0)
  private val playbackBytesWritten = AtomicLong(0)
  private val playbackWriteErrors = AtomicInteger(0)
  private val playbackShortWrites = AtomicInteger(0)
  @Volatile private var lastCaptureFrameAtMs: Long? = null
  @Volatile private var lastCaptureFrameRms: Double? = null
  @Volatile private var lastEchoCancelerState: Map<String, Boolean>? = null
  @Volatile private var lastGainControlState: Map<String, Boolean>? = null
  @Volatile private var lastNoiseSuppressorState: Map<String, Boolean>? = null
  @Volatile private var lastOutputRoute = "unknown"
  @Volatile private var lastPlaybackChunkRms: Double? = null
  @Volatile private var lastPlaybackWriteCompletedAtMs: Long? = null
  @Volatile private var lastPlaybackUnderrunCount = 0
  private var audioGenerationId = 0
  private var playbackQueuedMs = 0
  private var playbackEndsAtMs = 0L
  private var playbackIdleGeneration = 0
  private val mainHandler = Handler(Looper.getMainLooper())
  private val captureDeadline = Runnable {
    if (captureActive || pendingCaptureStart != null) {
      stopCaptureSync("capture_deadline")
      clearPlaybackSync("capture_deadline")
    }
  }
  @Volatile private var captureSource = CAPTURE_SOURCE_MICROPHONE
  @Volatile private var projectionResultData: Intent? = null
  @Volatile private var projectionResultCode = Activity.RESULT_CANCELED
  @Volatile private var pendingProjectionPermission: Promise? = null
  @Volatile private var pendingOverlayPermission: Promise? = null
  @Volatile private var pendingCaptureStart: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("MurmurAudio")
    Events("onAudioFrame", "onAudioState")

    OnCreate {
      MurmurCaptureBridge.attach(this@MurmurAudioModule)
    }

    AsyncFunction("requestMicrophonePermission") {
      hasRecordAudioPermission()
    }

    AsyncFunction("getCaptureCapabilities") {
      captureCapabilities()
    }

    AsyncFunction("requestDevicePlaybackPermission") { promise: Promise ->
      requestDevicePlaybackPermission(promise)
    }

    AsyncFunction("requestOverlayPermission") { promise: Promise ->
      requestOverlayPermission(promise)
    }

    AsyncFunction("getAudioState") {
      statePayload("get_audio_state")
    }

    AsyncFunction("startCapture") { source: String, promise: Promise ->
      startCapture(source, promise)
    }

    AsyncFunction("stopCapture") { reason: String? ->
      stopCaptureSync(reason ?: "stop_capture")
      statePayload(reason ?: "stop_capture")
    }

    AsyncFunction("startPlayback") {
      startPlaybackSync()
      statePayload("playback_started")
    }

    AsyncFunction("enqueuePcm16") { data: ByteArray ->
      enqueuePcm16(data)
      statePayload("playback_enqueued")
    }

    AsyncFunction("clearPlayback") { reason: String? ->
      clearPlaybackSync(reason ?: "clear_playback")
      statePayload(reason ?: "clear_playback")
    }

    AsyncFunction("updateOverlayCaption") { caption: String, rtl: Boolean ->
      MurmurCaptureBridge.updateOverlayCaption(caption, rtl)
    }

    AsyncFunction("requestPlayIntegrityToken") { nonce: String ->
      requestPlayIntegrityTokenSync(nonce)
    }

    OnActivityEntersBackground {
      if (pendingProjectionPermission != null) {
        emitState("activity_background_capture_permission")
        return@OnActivityEntersBackground
      }
      activityForeground = false
      stopCaptureSync("activity_background")
      clearPlaybackSync("activity_background")
    }

    OnActivityEntersForeground {
      activityForeground = true
      resolveOverlayPermissionIfReady()
      emitState("activity_foreground")
    }

    OnActivityResult { _, payload ->
      handleActivityResult(payload.requestCode, payload.resultCode, payload.data)
    }

    OnDestroy {
      pendingCaptureStart?.reject("E_CAPTURE_DESTROYED", "Audio module was destroyed", null)
      pendingCaptureStart = null
      pendingProjectionPermission?.resolve(false)
      pendingProjectionPermission = null
      pendingOverlayPermission?.resolve(false)
      pendingOverlayPermission = null
      projectionResultData = null
      stopCaptureSync("module_destroy")
      clearPlaybackSync("module_destroy")
      MurmurCaptureBridge.detach(this@MurmurAudioModule)
    }
  }

  private fun startCapture(source: String, promise: Promise) {
    if (source != CAPTURE_SOURCE_MICROPHONE && source != CAPTURE_SOURCE_DEVICE_PLAYBACK) {
      throw IllegalArgumentException("Unknown capture source: $source")
    }
    if (!activityForeground) {
      promise.reject("E_CAPTURE_BACKGROUND", "Audio capture requires the foreground", null)
      return
    }
    if (captureActive) {
      promise.resolve(statePayload("capture_already_active"))
      return
    }
    if (!hasRecordAudioPermission()) {
      promise.reject("E_RECORD_AUDIO", "RECORD_AUDIO permission is not granted", null)
      return
    }
    if (playbackActive) {
      clearPlaybackSync("capture_restart")
    }

    captureSource = source
    if (source == CAPTURE_SOURCE_DEVICE_PLAYBACK) {
      startDevicePlaybackCapture(promise)
      return
    }

    try {
      startMicrophoneCapture()
      scheduleCaptureDeadline()
      promise.resolve(statePayload("capture_started"))
    } catch (error: Throwable) {
      promise.reject("E_CAPTURE_START_FAILED", error.message ?: "Microphone capture failed", error)
    }
  }

  private fun startDevicePlaybackCapture(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      promise.reject("E_DEVICE_PLAYBACK_UNSUPPORTED", "Device playback capture requires Android 10", null)
      return
    }
    val projectionData = projectionResultData
    if (projectionData == null) {
      promise.reject("E_DEVICE_PLAYBACK_PERMISSION", "Device playback permission is not granted", null)
      return
    }
    if (pendingCaptureStart != null) {
      promise.reject("E_CAPTURE_BUSY", "A capture start is already pending", null)
      return
    }

    val projectionCode = projectionResultCode
    projectionResultData = null
    projectionResultCode = Activity.RESULT_CANCELED
    pendingCaptureStart = promise
    resetCaptureDiagnostics(CAPTURE_SOURCE_DEVICE_PLAYBACK)
    scheduleCaptureDeadline()
    try {
      startForegroundCaptureService(
        CAPTURE_SOURCE_DEVICE_PLAYBACK,
        projectionCode,
        projectionData
      )
      mainHandler.postDelayed({
        if (pendingCaptureStart === promise) {
          pendingCaptureStart = null
          captureActive = false
          mainHandler.removeCallbacks(captureDeadline)
          stopForegroundCaptureService("capture_start_timeout")
          promise.reject("E_CAPTURE_START_TIMEOUT", "Device playback capture did not start", null)
          emitState("capture_start_timeout")
        }
      }, 10_000)
    } catch (error: Throwable) {
      pendingCaptureStart = null
      mainHandler.removeCallbacks(captureDeadline)
      promise.reject("E_CAPTURE_START_FAILED", error.message ?: "Device playback capture failed", error)
    }
  }

  private fun startMicrophoneCapture() {
    val minBuffer = max(
      AudioRecord.getMinBufferSize(
        MURMUR_SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT
      ),
      MURMUR_FRAME_BYTES * 8
    )

    val record = AudioRecord.Builder()
      .setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
      .setAudioFormat(
        AudioFormat.Builder()
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
          .setSampleRate(MURMUR_SAMPLE_RATE)
          .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
          .build()
      )
      .setBufferSizeInBytes(minBuffer)
      .build()

    if (record.state != AudioRecord.STATE_INITIALIZED) {
      record.release()
      throw IllegalStateException("AudioRecord failed to initialize")
    }

    resetCaptureDiagnostics(CAPTURE_SOURCE_MICROPHONE)
    startForegroundCaptureService(CAPTURE_SOURCE_MICROPHONE)
    recorder = record
    enableAudioEffects(record.audioSessionId)
    try {
      record.startRecording()
      captureActive = true
      captureThread = Thread({ captureLoop(record) }, "murmur-audio-capture").also { it.start() }
      emitState("capture_started")
    } catch (error: RuntimeException) {
      releaseAudioEffects()
      recorder = null
      record.release()
      stopForegroundCaptureService("capture_start_failed")
      throw error
    }
  }

  private fun resetCaptureDiagnostics(source: String) {
    captureSource = source
    audioGenerationId += 1
    droppedFrames.set(0)
    captureReadErrors.set(0)
    captureFramesEmitted.set(0)
    captureBytesEmitted.set(0)
    playbackChunksReceived.set(0)
    playbackBytesRequested.set(0)
    playbackBytesWritten.set(0)
    playbackWriteErrors.set(0)
    playbackShortWrites.set(0)
    lastCaptureFrameAtMs = null
    lastCaptureFrameRms = null
    lastEchoCancelerState = null
    lastGainControlState = null
    lastNoiseSuppressorState = null
    lastOutputRoute = "unknown"
    lastPlaybackChunkRms = null
    lastPlaybackWriteCompletedAtMs = null
    lastPlaybackUnderrunCount = 0
  }

  private fun captureLoop(record: AudioRecord) {
    val frame = ByteArray(MURMUR_FRAME_BYTES)
    while (captureActive) {
      var offset = 0
      while (offset < frame.size && captureActive) {
        val read = record.read(frame, offset, frame.size - offset)
        if (read > 0) {
          offset += read
        } else {
          captureReadErrors.incrementAndGet()
          droppedFrames.incrementAndGet()
          captureActive = false
          break
        }
      }
      if (offset == frame.size && captureActive) {
        emitFrame(frame.copyOf())
      }
    }
    if (recorder === record && !captureActive) {
      mainHandler.post {
        if (recorder === record && !captureActive) {
          stopCaptureSync("capture_read_failed")
        }
      }
    }
  }

  private fun stopCaptureSync(reason: String) {
    mainHandler.removeCallbacks(captureDeadline)
    if (captureSource == CAPTURE_SOURCE_DEVICE_PLAYBACK) {
      projectionResultData = null
      pendingCaptureStart?.reject("E_CAPTURE_STOPPED", "Capture stopped before startup completed", null)
      pendingCaptureStart = null
      captureActive = false
      stopForegroundCaptureService(reason)
      emitState(reason)
      return
    }
    captureActive = false
    try {
      recorder?.stop()
    } catch (_: IllegalStateException) {
    }
    captureThread?.join(250)
    captureThread = null
    recorder?.release()
    recorder = null
    releaseAudioEffects()
    stopForegroundCaptureService(reason)
    emitState(reason)
  }

  private fun startPlaybackSync() {
    if (playbackActive) return
    val minBuffer = max(
      AudioTrack.getMinBufferSize(
        MURMUR_SAMPLE_RATE,
        AudioFormat.CHANNEL_OUT_MONO,
        AudioFormat.ENCODING_PCM_16BIT
      ),
      MURMUR_FRAME_BYTES * 10
    )

    audioTrack = AudioTrack.Builder()
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build()
      )
      .setAudioFormat(
        AudioFormat.Builder()
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
          .setSampleRate(MURMUR_SAMPLE_RATE)
          .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
          .build()
      )
      .setBufferSizeInBytes(minBuffer)
      .setTransferMode(AudioTrack.MODE_STREAM)
      .build()

    audioTrack?.play()
    playbackActive = true
    emitState("playback_started")
  }

  private fun enqueuePcm16(data: ByteArray) {
    if (data.isEmpty()) return
    if (!playbackActive) startPlaybackSync()
    playbackChunksReceived.incrementAndGet()
    playbackBytesRequested.addAndGet(data.size.toLong())
    val track = audioTrack ?: throw IllegalStateException("AudioTrack is not available")
    var totalWritten = 0
    while (totalWritten < data.size) {
      val written = track.write(data, totalWritten, data.size - totalWritten)
      if (written <= 0) {
        playbackWriteErrors.incrementAndGet()
        clearPlaybackSync("playback_write_failed")
        throw IllegalStateException("AudioTrack write failed: $written")
      }
      playbackBytesWritten.addAndGet(written.toLong())
      totalWritten += written
      if (totalWritten < data.size) {
        playbackShortWrites.incrementAndGet()
      }
    }
    val queuedMs = totalWritten / 2 * 1000 / MURMUR_SAMPLE_RATE
    lastPlaybackChunkRms = rms(data)
    lastPlaybackWriteCompletedAtMs = System.currentTimeMillis()
    schedulePlaybackIdle(queuedMs)
    emitState("playback_enqueued")
  }

  private fun clearPlaybackSync(reason: String) {
    playbackIdleGeneration += 1
    rememberPlaybackState()
    try {
      audioTrack?.pause()
      audioTrack?.flush()
    } catch (_: IllegalStateException) {
    }
    audioTrack?.release()
    audioTrack = null
    playbackQueuedMs = 0
    playbackEndsAtMs = 0L
    playbackActive = false
    emitState(reason)
  }

  private fun schedulePlaybackIdle(queuedMs: Int) {
    val nowMs = SystemClock.elapsedRealtime()
    val playbackStartAtMs = max(nowMs, playbackEndsAtMs)
    playbackEndsAtMs = playbackStartAtMs + queuedMs
    playbackQueuedMs = max(0, (playbackEndsAtMs - nowMs).toInt())
    val generation = ++playbackIdleGeneration
    val delayMs = max(80L, playbackEndsAtMs - nowMs + 120L)
    mainHandler.postDelayed({
      if (generation == playbackIdleGeneration && playbackActive && SystemClock.elapsedRealtime() >= playbackEndsAtMs) {
        finishPlaybackSync("playback_finished")
      }
    }, delayMs)
  }

  private fun finishPlaybackSync(reason: String) {
    rememberPlaybackState()
    try {
      audioTrack?.pause()
      audioTrack?.flush()
    } catch (_: IllegalStateException) {
    }
    audioTrack?.release()
    audioTrack = null
    playbackQueuedMs = 0
    playbackEndsAtMs = 0L
    playbackActive = false
    emitState(reason)
  }

  private fun enableAudioEffects(audioSessionId: Int) {
    if (AcousticEchoCanceler.isAvailable()) {
      echoCanceler = AcousticEchoCanceler.create(audioSessionId)?.also { it.enabled = true }
    }
    if (NoiseSuppressor.isAvailable()) {
      noiseSuppressor = NoiseSuppressor.create(audioSessionId)?.also { it.enabled = true }
    }
    if (AutomaticGainControl.isAvailable()) {
      gainControl = AutomaticGainControl.create(audioSessionId)?.also { it.enabled = true }
    }
  }

  private fun releaseAudioEffects() {
    lastEchoCancelerState = currentAudioEffectState(
      AcousticEchoCanceler.isAvailable(),
      echoCanceler
    )
    lastNoiseSuppressorState = currentAudioEffectState(
      NoiseSuppressor.isAvailable(),
      noiseSuppressor
    )
    lastGainControlState = currentAudioEffectState(
      AutomaticGainControl.isAvailable(),
      gainControl
    )
    echoCanceler?.release()
    noiseSuppressor?.release()
    gainControl?.release()
    echoCanceler = null
    noiseSuppressor = null
    gainControl = null
  }

  private fun emitFrame(data: ByteArray, source: String = captureSource) {
    val frameAtMs = System.currentTimeMillis()
    val frameRms = rms(data)
    captureFramesEmitted.incrementAndGet()
    captureBytesEmitted.addAndGet(data.size.toLong())
    lastCaptureFrameAtMs = frameAtMs
    lastCaptureFrameRms = frameRms
    sendEvent(
      "onAudioFrame",
      mapOf(
        "audio_generation_id" to audioGenerationId,
        "capture_source" to source,
        "data" to data,
        "duration_ms" to MURMUR_FRAME_DURATION_MS,
        "event_seq" to nextEventSeq(),
        "rms" to frameRms,
        "sample_rate" to MURMUR_SAMPLE_RATE,
        "timestamp_ms" to frameAtMs
      )
    )
  }

  private fun emitState(reason: String) {
    sendEvent("onAudioState", statePayload(reason))
  }

  private fun statePayload(reason: String): Map<String, Any> =
    mapOf(
      "android" to androidDiagnostics(),
      "audio_generation_id" to audioGenerationId,
      "capture_active" to captureActive,
      "capture_source" to captureSource,
      "dropped_frames" to droppedFrames.get(),
      "event_seq" to nextEventSeq(),
      "playback_active" to playbackActive,
      "playback_queued_ms" to playbackQueuedMs,
      "reason" to reason,
      "route" to "android",
      "sample_rate" to MURMUR_SAMPLE_RATE
    )

  private fun nextEventSeq(): Int {
    return eventSeq.incrementAndGet()
  }

  private fun androidDiagnostics(): Map<String, Any?> {
    val context = appContext.reactContext
    val audioManager = context?.getSystemService(AudioManager::class.java)
    val captureDiagnostics = context?.let { MurmurCaptureBridge.diagnostics(it) } ?: emptyMap()
    return mapOf(
      "acoustic_echo_canceler" to currentAudioEffectState(
        AcousticEchoCanceler.isAvailable(),
        echoCanceler,
        lastEchoCancelerState
      ),
      "audio_mode" to audioManager?.mode,
      "audio_source" to if (captureSource == CAPTURE_SOURCE_DEVICE_PLAYBACK) {
        "audio_playback_capture"
      } else {
        "voice_recognition"
      },
      "automatic_gain_control" to currentAudioEffectState(
        AutomaticGainControl.isAvailable(),
        gainControl,
        lastGainControlState
      ),
      "capture_bytes_emitted_native" to captureBytesEmitted.get(),
      "capture_frames_emitted_native" to captureFramesEmitted.get(),
      "capture_read_errors" to captureReadErrors.get(),
      "last_capture_frame_at_ms" to lastCaptureFrameAtMs,
      "last_capture_frame_rms" to lastCaptureFrameRms,
      "last_playback_chunk_rms" to lastPlaybackChunkRms,
      "last_playback_write_completed_at_ms" to lastPlaybackWriteCompletedAtMs,
      "noise_suppressor" to currentAudioEffectState(
        NoiseSuppressor.isAvailable(),
        noiseSuppressor,
        lastNoiseSuppressorState
      ),
      "output_route" to (audioTrack?.let { outputRoute(it.routedDevice) } ?: lastOutputRoute),
      "playback_bytes_requested" to playbackBytesRequested.get(),
      "playback_bytes_written" to playbackBytesWritten.get(),
      "playback_chunks_received" to playbackChunksReceived.get(),
      "playback_short_writes" to playbackShortWrites.get(),
      "playback_underrun_count" to (audioTrack?.underrunCount ?: lastPlaybackUnderrunCount),
      "playback_usage" to "media",
      "playback_write_errors" to playbackWriteErrors.get(),
      "projection_active" to (captureDiagnostics["projection_active"] ?: false),
      "overlay_visible" to (captureDiagnostics["overlay_visible"] ?: false),
      "overlay_permission_granted" to (captureDiagnostics["overlay_permission_granted"] ?: false),
      "sdk_int" to Build.VERSION.SDK_INT
    )
  }

  private fun audioEffectState(
    available: Boolean,
    enabled: Boolean?,
    hasControl: Boolean?
  ): Map<String, Boolean> = mapOf(
    "available" to available,
    "created" to (enabled != null),
    "enabled" to (enabled ?: false),
    "has_control" to (hasControl ?: false)
  )

  private fun currentAudioEffectState(
    available: Boolean,
    effect: AudioEffect?,
    previous: Map<String, Boolean>? = null
  ): Map<String, Boolean> = if (effect == null) {
    previous ?: audioEffectState(available, null, null)
  } else {
    audioEffectState(available, effect.enabled, effect.hasControl())
  }

  private fun rememberPlaybackState() {
    val track = audioTrack ?: return
    lastOutputRoute = outputRoute(track.routedDevice)
    lastPlaybackUnderrunCount = track.underrunCount
  }

  private fun outputRoute(device: AudioDeviceInfo?): String = when (device?.type) {
    AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "built_in_earpiece"
    AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "built_in_speaker"
    AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "bluetooth_a2dp"
    AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "bluetooth_sco"
    AudioDeviceInfo.TYPE_USB_DEVICE -> "usb_device"
    AudioDeviceInfo.TYPE_USB_HEADSET -> "usb_headset"
    AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "wired_headphones"
    AudioDeviceInfo.TYPE_WIRED_HEADSET -> "wired_headset"
    null -> "unknown"
    else -> "type_${device.type}"
  }

  private fun hasRecordAudioPermission(): Boolean {
    val context = appContext.reactContext ?: return false
    return context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
  }

  private fun startForegroundCaptureService(
    source: String,
    projectionCode: Int = Activity.RESULT_CANCELED,
    projectionData: Intent? = null
  ) {
    val context = appContext.reactContext
      ?: throw IllegalStateException("React context is unavailable")
    val intent = Intent(context, MurmurForegroundService::class.java).apply {
      putExtra(MURMUR_CAPTURE_SOURCE_EXTRA, source)
      if (source == CAPTURE_SOURCE_DEVICE_PLAYBACK) {
        putExtra(MURMUR_CAPTURE_PROJECTION_CODE_EXTRA, projectionCode)
        putExtra(MURMUR_CAPTURE_PROJECTION_DATA_EXTRA, projectionData)
      }
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent)
      return
    }
    context.startService(intent)
  }

  private fun stopForegroundCaptureService(reason: String = "capture_stop") {
    val context = appContext.reactContext ?: return
    val serviceWillStopItself = MurmurCaptureBridge.stopCapture(reason)
    if (!serviceWillStopItself) {
      context.stopService(Intent(context, MurmurForegroundService::class.java))
    }
  }

  private fun captureCapabilities(): Map<String, Boolean> {
    val context = appContext.reactContext
    val microphoneSupported = context?.packageManager?.hasSystemFeature(PackageManager.FEATURE_MICROPHONE) == true
    val overlaySupported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
    val overlayGranted = overlaySupported && context?.let { MurmurOverlayController.hasPermission(it) } == true
    return mapOf(
      "microphone_supported" to microphoneSupported,
      "device_playback_supported" to (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q),
      "floating_overlay_supported" to overlaySupported,
      "overlay_permission_granted" to overlayGranted
    )
  }

  private fun requestDevicePlaybackPermission(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      promise.resolve(false)
      return
    }
    val activity = appContext.currentActivity
    val context = appContext.reactContext
    if (activity == null || context == null) {
      promise.resolve(false)
      return
    }
    val manager = context.getSystemService(MediaProjectionManager::class.java)
    if (manager == null) {
      promise.resolve(false)
      return
    }
    pendingProjectionPermission?.resolve(false)
    pendingProjectionPermission = promise
    projectionResultData = null
    projectionResultCode = Activity.RESULT_CANCELED
    try {
      activity.startActivityForResult(
        manager.createScreenCaptureIntent(),
        DEVICE_PLAYBACK_PERMISSION_REQUEST_CODE
      )
    } catch (error: Throwable) {
      pendingProjectionPermission = null
      promise.reject("E_DEVICE_PLAYBACK_PERMISSION", error.message ?: "Unable to request device playback permission", error)
    }
  }

  private fun requestOverlayPermission(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      promise.resolve(false)
      return
    }
    val context = appContext.reactContext
    if (context == null) {
      promise.resolve(false)
      return
    }
    if (MurmurOverlayController.hasPermission(context)) {
      promise.resolve(true)
      return
    }
    val activity = appContext.currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    pendingOverlayPermission?.resolve(false)
    pendingOverlayPermission = promise
    try {
      activity.startActivityForResult(
        Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${context.packageName}")
        ),
        OVERLAY_PERMISSION_REQUEST_CODE
      )
    } catch (error: Throwable) {
      pendingOverlayPermission = null
      promise.reject("E_OVERLAY_PERMISSION", error.message ?: "Unable to request overlay permission", error)
    }
  }

  private fun handleActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    when (requestCode) {
      DEVICE_PLAYBACK_PERMISSION_REQUEST_CODE -> {
        val promise = pendingProjectionPermission
        pendingProjectionPermission = null
        if (resultCode == Activity.RESULT_OK && data != null) {
          projectionResultCode = resultCode
          projectionResultData = data
          promise?.resolve(true)
        } else {
          projectionResultCode = Activity.RESULT_CANCELED
          projectionResultData = null
          promise?.resolve(false)
        }
      }
      OVERLAY_PERMISSION_REQUEST_CODE -> {
        resolveOverlayPermissionIfReady()
      }
    }
  }

  private fun resolveOverlayPermissionIfReady() {
    val promise = pendingOverlayPermission ?: return
    val context = appContext.reactContext ?: return
    val granted = MurmurOverlayController.hasPermission(context)
    pendingOverlayPermission = null
    promise.resolve(granted)
  }

  override fun onServiceCaptureStarted(source: String) {
    if (!activityForeground) {
      pendingCaptureStart?.reject(
        "E_CAPTURE_BACKGROUND",
        "Audio capture cannot start in the background",
        null
      )
      pendingCaptureStart = null
      captureActive = false
      stopForegroundCaptureService("activity_background")
      emitState("activity_background")
      return
    }
    captureSource = source
    captureActive = true
    val promise = pendingCaptureStart
    pendingCaptureStart = null
    emitState("capture_started")
    promise?.resolve(statePayload("capture_started"))
  }

  private fun scheduleCaptureDeadline() {
    mainHandler.removeCallbacks(captureDeadline)
    mainHandler.postDelayed(captureDeadline, MURMUR_MAX_CAPTURE_DURATION_MS)
  }

  override fun onServiceCaptureFrame(source: String, data: ByteArray) {
    if (!captureActive) return
    emitFrame(data, source)
  }

  override fun onServiceCaptureStopped(source: String, reason: String) {
    mainHandler.removeCallbacks(captureDeadline)
    projectionResultData = null
    if (source == CAPTURE_SOURCE_MICROPHONE) {
      captureActive = false
      try {
        recorder?.stop()
      } catch (_: IllegalStateException) {
      }
      captureThread?.join(250)
      captureThread = null
      recorder?.release()
      recorder = null
      releaseAudioEffects()
      emitState(reason)
      return
    }
    captureActive = false
    if (pendingCaptureStart != null) {
      pendingCaptureStart?.reject("E_CAPTURE_START_FAILED", reason, null)
      pendingCaptureStart = null
    }
    emitState(reason)
  }

  override fun onServiceCaptureError(source: String, reason: String, error: Throwable?) {
    mainHandler.removeCallbacks(captureDeadline)
    projectionResultData = null
    captureActive = false
    pendingCaptureStart?.reject(
      "E_CAPTURE_START_FAILED",
      error?.message ?: reason,
      error
    )
    pendingCaptureStart = null
    emitState(reason)
  }

  private fun requestPlayIntegrityTokenSync(nonce: String): Map<String, Any> {
    val context = appContext.reactContext
      ?: return mapOf(
        "available" to false,
        "platform" to "android",
        "reason" to "missing_react_context"
      )
    if (nonce.length < 16) {
      return mapOf(
        "available" to false,
        "platform" to "android",
        "reason" to "nonce_too_short"
      )
    }

    return try {
      val manager = IntegrityManagerFactory.create(context)
      val request = IntegrityTokenRequest.builder()
        .setNonce(nonce)
        .build()
      val response = Tasks.await(manager.requestIntegrityToken(request), 10, TimeUnit.SECONDS)
      mapOf(
        "available" to true,
        "platform" to "android",
        "provider" to "play_integrity",
        "token" to response.token()
      )
    } catch (error: Exception) {
      mapOf(
        "available" to false,
        "platform" to "android",
        "provider" to "play_integrity",
        "reason" to (error.message ?: error.javaClass.simpleName)
      )
    }
  }

  private fun rms(data: ByteArray): Double {
    if (data.isEmpty()) return 0.0
    var index = 0
    var sum = 0.0
    var count = 0
    while (index + 1 < data.size) {
      val low = data[index].toInt() and 0xff
      val high = data[index + 1].toInt()
      val sample = ((high shl 8) or low).toShort().toDouble() / Short.MAX_VALUE.toDouble()
      sum += sample * sample
      count += 1
      index += 2
    }
    return if (count == 0) 0.0 else sqrt(sum / count.toDouble())
  }
}
