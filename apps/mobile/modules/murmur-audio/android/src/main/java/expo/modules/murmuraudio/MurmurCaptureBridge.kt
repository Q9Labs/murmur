package expo.modules.murmuraudio

import android.content.Context

internal const val CAPTURE_SOURCE_MICROPHONE = "microphone"
internal const val CAPTURE_SOURCE_DEVICE_PLAYBACK = "device_playback"

internal interface MurmurCaptureListener {
  fun onServiceCaptureStarted(source: String)
  fun onServiceCaptureFrame(source: String, data: ByteArray)
  fun onServiceCaptureStopped(source: String, reason: String)
  fun onServiceCaptureError(source: String, reason: String, error: Throwable?)
}

internal object MurmurCaptureBridge {
  @Volatile private var listener: MurmurCaptureListener? = null
  @Volatile private var service: MurmurForegroundService? = null

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
    val captureService = service ?: return false
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
