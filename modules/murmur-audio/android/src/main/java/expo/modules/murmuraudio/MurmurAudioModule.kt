package expo.modules.murmuraudio

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.AutomaticGainControl
import android.media.audiofx.NoiseSuppressor
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.google.android.gms.tasks.Tasks
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.sqrt

private const val MURMUR_SAMPLE_RATE = 16_000
private const val MURMUR_FRAME_BYTES = 640
private const val MURMUR_FRAME_DURATION_MS = 20

class MurmurAudioModule : Module() {
  @Volatile private var captureActive = false
  @Volatile private var playbackActive = false
  private var recorder: AudioRecord? = null
  private var captureThread: Thread? = null
  private var audioTrack: AudioTrack? = null
  private var echoCanceler: AcousticEchoCanceler? = null
  private var noiseSuppressor: NoiseSuppressor? = null
  private var gainControl: AutomaticGainControl? = null
  private var droppedFrames = 0
  private var eventSeq = 0
  private var audioGenerationId = 0
  private var playbackQueuedMs = 0
  private var playbackEndsAtMs = 0L
  private var playbackIdleGeneration = 0
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("MurmurAudio")
    Events("onAudioFrame", "onAudioState")

    AsyncFunction("requestMicrophonePermission") {
      hasRecordAudioPermission()
    }

    AsyncFunction("getAudioState") {
      statePayload("get_audio_state")
    }

    AsyncFunction("startCapture") {
      startCaptureSync()
      statePayload("capture_started")
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

    AsyncFunction("requestPlayIntegrityToken") { nonce: String ->
      requestPlayIntegrityTokenSync(nonce)
    }

    OnActivityEntersBackground {
      stopCaptureSync("activity_background")
      clearPlaybackSync("activity_background")
    }

    OnDestroy {
      stopCaptureSync("module_destroy")
      clearPlaybackSync("module_destroy")
    }
  }

  private fun startCaptureSync() {
    if (captureActive) return
    if (!hasRecordAudioPermission()) {
      throw SecurityException("RECORD_AUDIO permission is not granted")
    }

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

    audioGenerationId += 1
    droppedFrames = 0
    recorder = record
    enableAudioEffects(record.audioSessionId)
    record.startRecording()
    captureActive = true
    captureThread = Thread({ captureLoop(record) }, "murmur-audio-capture").also { it.start() }
    emitState("capture_started")
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
          droppedFrames += 1
          break
        }
      }
      if (offset == frame.size && captureActive) {
        emitFrame(frame.copyOf())
      }
    }
  }

  private fun stopCaptureSync(reason: String) {
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
    val queuedMs = data.size / 2 * 1000 / MURMUR_SAMPLE_RATE
    playbackQueuedMs += queuedMs
    val written = audioTrack?.write(data, 0, data.size) ?: 0
    if (written < 0) {
      droppedFrames += 1
    }
    schedulePlaybackIdle(queuedMs)
    emitState("playback_enqueued")
  }

  private fun clearPlaybackSync(reason: String) {
    playbackIdleGeneration += 1
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
    echoCanceler?.release()
    noiseSuppressor?.release()
    gainControl?.release()
    echoCanceler = null
    noiseSuppressor = null
    gainControl = null
  }

  private fun emitFrame(data: ByteArray) {
    sendEvent(
      "onAudioFrame",
      mapOf(
        "audio_generation_id" to audioGenerationId,
        "data" to data,
        "duration_ms" to MURMUR_FRAME_DURATION_MS,
        "event_seq" to nextEventSeq(),
        "rms" to rms(data),
        "sample_rate" to MURMUR_SAMPLE_RATE,
        "timestamp_ms" to System.currentTimeMillis()
      )
    )
  }

  private fun emitState(reason: String) {
    sendEvent("onAudioState", statePayload(reason))
  }

  private fun statePayload(reason: String): Map<String, Any> =
    mapOf(
      "audio_generation_id" to audioGenerationId,
      "capture_active" to captureActive,
      "dropped_frames" to droppedFrames,
      "event_seq" to nextEventSeq(),
      "playback_active" to playbackActive,
      "playback_queued_ms" to playbackQueuedMs,
      "reason" to reason,
      "route" to "android",
      "sample_rate" to MURMUR_SAMPLE_RATE
    )

  private fun nextEventSeq(): Int {
    eventSeq += 1
    return eventSeq
  }

  private fun hasRecordAudioPermission(): Boolean {
    val context = appContext.reactContext ?: return false
    return context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
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
