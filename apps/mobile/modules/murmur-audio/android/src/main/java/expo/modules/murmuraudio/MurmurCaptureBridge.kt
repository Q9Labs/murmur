package expo.modules.murmuraudio

import android.content.Context
import android.content.Intent
import android.os.Build

internal const val CAPTURE_SOURCE_MICROPHONE = "microphone"
internal const val CAPTURE_SOURCE_DEVICE_PLAYBACK = "device_playback"
private const val CAPTURE_START_ID_EXTRA = "murmur_capture_start_id"

internal interface MurmurCaptureListener {
  fun onServiceCaptureStarted(source: String)
  fun onServiceCaptureFrame(source: String, data: ByteArray)
  fun onServiceCaptureStopped(source: String, reason: String)
  fun onServiceCaptureError(source: String, reason: String, error: Throwable?)
}

internal object MurmurCaptureBridge {
  @Volatile private var listener: MurmurCaptureListener? = null
  @Volatile private var service: MurmurForegroundService? = null
  @Volatile var startupFailure: Map<String, Any?>? = null
    private set

  fun clearStartupFailure() { startupFailure = null }

  fun recordStartupFailure(
    step: CaptureStartupStep,
    error: Throwable? = null,
    reason: CaptureStartupReason = CaptureStartupReason.EXCEPTION
  ) {
    startupFailure = captureStartupFailure(step, error, reason)
  }

  private var nextStartId = 0L
  private val pendingStarts = mutableMapOf<Long, String?>()

  fun startService(context: Context, intent: Intent) {
    val requestId = synchronized(this) {
      val id = ++nextStartId
      pendingStarts[id] = null
      intent.putExtra(CAPTURE_START_ID_EXTRA, id)
      id
    }
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    } catch (error: Throwable) {
      synchronized(this) {
        pendingStarts.remove(requestId)
      }
      throw error
    }
  }

  @Synchronized
  fun completeServiceStart(intent: Intent?): String? {
    val requestId = intent?.getLongExtra(CAPTURE_START_ID_EXTRA, -1L) ?: return null
    return pendingStarts.remove(requestId)
  }

  fun attach(listener: MurmurCaptureListener) {
    this.listener = listener
  }

  fun detach(listener: MurmurCaptureListener) {
    if (this.listener === listener) {
      this.listener = null
    }
  }

  fun attachService(service: MurmurForegroundService) {
    this.service = service
  }

  fun detachService(service: MurmurForegroundService) {
    if (this.service === service) {
      this.service = null
    }
  }

  fun notifyCaptureStarted(source: String) {
    listener?.onServiceCaptureStarted(source)
  }

  fun notifyCaptureFrame(source: String, data: ByteArray) {
    listener?.onServiceCaptureFrame(source, data)
  }

  fun notifyCaptureStopped(source: String, reason: String) {
    listener?.onServiceCaptureStopped(source, reason)
  }

  fun notifyCaptureError(source: String, reason: String, error: Throwable? = null) {
    listener?.onServiceCaptureError(source, reason, error)
  }

  fun stopCapture(reason: String): Boolean {
    val captureService = synchronized(this) {
      // Android can crash the process if a foreground-required start is stopped before promotion.
      if (pendingStarts.isNotEmpty()) {
        pendingStarts.keys.forEach { pendingStarts[it] = reason }
        return true
      }
      service
    } ?: return false
    captureService.requestStop(reason)
    return true
  }

  fun updateOverlayCaption(caption: String, rtl: Boolean): Map<String, Any?> {
    return service?.updateOverlayCaption(caption, rtl)
      ?: mapOf(
        "caption_updated" to false,
        "overlay_permission_granted" to false,
        "overlay_visible" to false
      )
  }

  fun diagnostics(context: Context): Map<String, Any?> {
    return service?.captureDiagnostics(context)
      ?: mapOf(
        "overlay_permission_granted" to MurmurOverlayController.hasPermission(context),
        "overlay_visible" to false,
        "projection_active" to false
      )
  }
}
