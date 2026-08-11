package expo.modules.murmuraudio

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.annotation.RequiresApi

private const val MURMUR_CAPTURE_CHANNEL_ID = "murmur_live_capture"
private const val MURMUR_CAPTURE_NOTIFICATION_ID = 4127
private const val MURMUR_CAPTURE_STOP_ACTION = "expo.modules.murmuraudio.STOP_CAPTURE"
private const val MURMUR_CAPTURE_STOP_REQUEST_CODE = 4128

internal const val MURMUR_CAPTURE_SOURCE_EXTRA = "murmur_capture_source"
internal const val MURMUR_CAPTURE_PROJECTION_CODE_EXTRA = "murmur_projection_result_code"
internal const val MURMUR_CAPTURE_PROJECTION_DATA_EXTRA = "murmur_projection_result_data"

private const val MURMUR_SAMPLE_RATE = 24_000
private const val MURMUR_FRAME_BYTES = 960

class MurmurForegroundService : Service() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var source = CAPTURE_SOURCE_MICROPHONE
  @Volatile private var mediaProjection: MediaProjection? = null
  @Volatile private var recorder: AudioRecord? = null
  private var captureThread: Thread? = null
  @Volatile private var captureActive = false
  private var stopNotified = false
  private var screenOffRegistered = false
  private lateinit var overlayController: MurmurOverlayController

  private val projectionCallback = object : MediaProjection.Callback() {
    override fun onStop() {
      stopCaptureInternal("device_playback_capture_revoked")
      stopSelf()
    }
  }

  private val screenOffReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action == Intent.ACTION_SCREEN_OFF) {
        stopCaptureInternal("system_stop")
        stopSelf()
      }
    }
  }

  override fun onCreate() {
    super.onCreate()
    overlayController = MurmurOverlayController(this)
    MurmurCaptureBridge.attachService(this)
    ensureNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == MURMUR_CAPTURE_STOP_ACTION) {
      requestStop("notification_stop")
      return START_NOT_STICKY
    }
    if (captureActive) {
      return START_NOT_STICKY
    }

    source = intent?.getStringExtra(MURMUR_CAPTURE_SOURCE_EXTRA) ?: CAPTURE_SOURCE_MICROPHONE
    if (source != CAPTURE_SOURCE_MICROPHONE && source != CAPTURE_SOURCE_DEVICE_PLAYBACK) {
      reportStartupFailure(IllegalArgumentException("Unknown capture source: $source"))
      return START_NOT_STICKY
    }

    try {
      startForegroundForSource()
      if (source == CAPTURE_SOURCE_DEVICE_PLAYBACK) {
        startDevicePlaybackCapture(intent)
      }
    } catch (error: Throwable) {
      reportStartupFailure(error)
    }
    return START_NOT_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    stopCaptureInternal("task_removed")
    stopSelf()
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    stopCaptureInternal("service_destroy")
    MurmurCaptureBridge.detachService(this)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  fun requestStop(reason: String) {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      stopCaptureInternal(reason)
      stopSelf()
      return
    }
    mainHandler.post {
      stopCaptureInternal(reason)
      stopSelf()
    }
  }

  fun updateOverlayCaption(caption: String, rtl: Boolean): Map<String, Any?> {
    if (source != CAPTURE_SOURCE_DEVICE_PLAYBACK || !captureActive) {
      return overlayController.state(this) + ("caption_updated" to false)
    }
    overlayController.updateCaption(caption, rtl)
    return overlayController.state(this)
  }

  fun captureDiagnostics(context: Context): Map<String, Any?> {
    return mapOf(
      "overlay_permission_granted" to MurmurOverlayController.hasPermission(context),
      "overlay_visible" to if (source == CAPTURE_SOURCE_DEVICE_PLAYBACK) {
        overlayController.state(context)["overlay_visible"]
      } else {
        false
      },
      "projection_active" to (mediaProjection != null && captureActive)
    )
  }

  private fun startForegroundForSource() {
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val type = if (source == CAPTURE_SOURCE_DEVICE_PLAYBACK) {
        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
      } else {
        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
      }
      startForeground(MURMUR_CAPTURE_NOTIFICATION_ID, notification, type)
      return
    }
    startForeground(MURMUR_CAPTURE_NOTIFICATION_ID, notification)
  }

  @RequiresApi(Build.VERSION_CODES.Q)
  private fun startDevicePlaybackCapture(intent: Intent?) {
    val projectionResultCode = intent?.getIntExtra(
      MURMUR_CAPTURE_PROJECTION_CODE_EXTRA,
      Activity.RESULT_CANCELED
    ) ?: Activity.RESULT_CANCELED
    val projectionData = intent?.getParcelableExtra<Intent>(MURMUR_CAPTURE_PROJECTION_DATA_EXTRA)
      ?: throw IllegalStateException("MediaProjection approval data is missing")
    val manager = getSystemService(MediaProjectionManager::class.java)
      ?: throw IllegalStateException("MediaProjectionManager is unavailable")
    val projection = manager.getMediaProjection(projectionResultCode, projectionData)
      ?: throw IllegalStateException("MediaProjection could not be created")
    mediaProjection = projection
    projection.registerCallback(projectionCallback, mainHandler)

    val playbackConfig = AudioPlaybackCaptureConfiguration.Builder(projection)
      .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
      .addMatchingUsage(AudioAttributes.USAGE_GAME)
      .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
      .excludeUid(applicationInfo.uid)
      .build()
    val minBuffer = maxOf(
      AudioRecord.getMinBufferSize(
        MURMUR_SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT
      ),
      MURMUR_FRAME_BYTES * 8
    )
    val record = AudioRecord.Builder()
      .setAudioFormat(
        AudioFormat.Builder()
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
          .setSampleRate(MURMUR_SAMPLE_RATE)
          .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
          .build()
      )
      .setBufferSizeInBytes(minBuffer)
      .setAudioPlaybackCaptureConfig(playbackConfig)
      .build()
    if (record.state != AudioRecord.STATE_INITIALIZED) {
      record.release()
      throw IllegalStateException("Playback AudioRecord failed to initialize")
    }

    recorder = record
    try {
      record.startRecording()
      if (record.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
        throw IllegalStateException("Playback AudioRecord failed to start")
      }
      captureActive = true
      stopNotified = false
      registerScreenOffReceiver()
      overlayController.show()
      captureThread = Thread({ captureLoop(record) }, "murmur-device-playback-capture").also { it.start() }
      MurmurCaptureBridge.notifyCaptureStarted(source)
    } catch (error: Throwable) {
      record.release()
      recorder = null
      throw error
    }
  }

  private fun captureLoop(record: AudioRecord) {
    val frame = ByteArray(MURMUR_FRAME_BYTES)
    while (captureActive) {
      var offset = 0
      while (offset < frame.size && captureActive) {
        val read = try {
          record.read(frame, offset, frame.size - offset)
        } catch (error: Throwable) {
          if (captureActive) {
            reportCaptureError("capture_read_failed", error)
          }
          return
        }
        if (read <= 0) {
          if (captureActive) {
            reportCaptureError("capture_read_failed", IllegalStateException("AudioRecord read failed: $read"))
          }
          return
        }
        offset += read
      }
      if (offset == frame.size && captureActive) {
        MurmurCaptureBridge.notifyCaptureFrame(source, frame.copyOf())
      }
    }
  }

  private fun reportCaptureError(reason: String, error: Throwable) {
    MurmurCaptureBridge.notifyCaptureError(source, reason, error)
    stopCaptureInternal(reason)
    stopSelf()
  }

  private fun reportStartupFailure(error: Throwable) {
    val reason = "capture_start_failed"
    MurmurCaptureBridge.notifyCaptureError(source, reason, error)
    stopCaptureInternal(reason)
    stopSelf()
  }

  private fun stopCaptureInternal(reason: String) {
    captureActive = false
    overlayController.hide()
    unregisterScreenOffReceiver()
    try {
      recorder?.stop()
    } catch (_: IllegalStateException) {
    }
    recorder?.release()
    recorder = null
    val thread = captureThread
    captureThread = null
    if (thread != null && thread !== Thread.currentThread()) {
      thread.join(250)
    }
    val projection = mediaProjection
    mediaProjection = null
    projection?.let {
      try {
        it.unregisterCallback(projectionCallback)
      } catch (_: RuntimeException) {
      }
      it.stop()
    }
    if (!stopNotified) {
      stopNotified = true
      MurmurCaptureBridge.notifyCaptureStopped(source, reason)
    }
  }

  private fun registerScreenOffReceiver() {
    if (screenOffRegistered) return
    val filter = IntentFilter(Intent.ACTION_SCREEN_OFF)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(screenOffReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      registerReceiver(screenOffReceiver, filter)
    }
    screenOffRegistered = true
  }

  private fun unregisterScreenOffReceiver() {
    if (!screenOffRegistered) return
    try {
      unregisterReceiver(screenOffReceiver)
    } catch (_: IllegalArgumentException) {
    }
    screenOffRegistered = false
  }

  private fun ensureNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val manager = getSystemService(NotificationManager::class.java)
    val channel = NotificationChannel(
      MURMUR_CAPTURE_CHANNEL_ID,
      "Live translation",
      NotificationManager.IMPORTANCE_LOW
    )
    channel.description = "Keeps Murmur listening during live translation."
    manager.createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, MURMUR_CAPTURE_CHANNEL_ID)
    } else {
      Notification.Builder(this)
    }
    val isDevicePlayback = source == CAPTURE_SOURCE_DEVICE_PLAYBACK
    val stopIntent = Intent(this, MurmurForegroundService::class.java).apply {
      action = MURMUR_CAPTURE_STOP_ACTION
    }
    val stopPendingIntent = PendingIntent.getService(
      this,
      MURMUR_CAPTURE_STOP_REQUEST_CODE,
      stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    return builder
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentTitle(if (isDevicePlayback) "Murmur is capturing phone audio" else "Murmur is listening")
      .setContentText(if (isDevicePlayback) "Device Audio translation is active" else "Live microphone translation is active")
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .addAction(
        Notification.Action.Builder(
          android.R.drawable.ic_menu_close_clear_cancel,
          "Stop",
          stopPendingIntent
        ).build()
      )
      .build()
  }
}
