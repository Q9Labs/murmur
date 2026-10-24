package expo.modules.murmuraudio

internal enum class CaptureStartupStep(val value: String) {
  SERVICE_START("service_start"), FOREGROUND_PROMOTION("foreground_promotion"),
  PROJECTION_DATA("projection_data"), MEDIA_PROJECTION("media_projection"),
  PROJECTION_CALLBACK("projection_callback"), PLAYBACK_CONFIG("playback_config"),
  RECORDER_BUILD("recorder_build"), RECORDER_START("recorder_start"), CAPTURE_DISPATCH("capture_dispatch")
}

internal enum class CaptureStartupReason(val value: String) {
  EXCEPTION("exception"), RECORDER_UNINITIALIZED("recorder_uninitialized"),
  RECORDER_NOT_RECORDING("recorder_not_recording"), SERVICE_STOPPED("service_stopped"),
  START_TIMEOUT("start_timeout"), PROJECTION_REVOKED("projection_revoked"),
  SERVICE_DESTROYED("service_destroyed"), NOTIFICATION_STOP("notification_stop")
}

internal class CaptureStartupException(val reason: CaptureStartupReason, val code: Int) :
  IllegalStateException(reason.value)

internal fun captureStartupFailure(
  step: CaptureStartupStep,
  error: Throwable? = null,
  reason: CaptureStartupReason = CaptureStartupReason.EXCEPTION
): Map<String, Any?> {
  val domain = when {
    error == null || error is CaptureStartupException -> "none"
    error.javaClass.name == "android.app.ForegroundServiceStartNotAllowedException" -> "foreground_start_not_allowed"
    error is SecurityException -> "security"
    error is IllegalArgumentException -> "illegal_argument"
    error is IllegalStateException -> "illegal_state"
    error is UnsupportedOperationException -> "unsupported"
    else -> "other"
  }
  return mapOf(
    "platform" to "android", "step" to step.value, "error_domain" to domain,
    "error_code" to (if (error is CaptureStartupException) error.code else null),
    "reason" to (if (error is CaptureStartupException) error.reason.value else reason.value)
  )
}

internal fun captureStartupStopReason(reason: String): CaptureStartupReason = when (reason) {
  "device_playback_capture_revoked" -> CaptureStartupReason.PROJECTION_REVOKED
  "service_destroy" -> CaptureStartupReason.SERVICE_DESTROYED
  "notification_stop" -> CaptureStartupReason.NOTIFICATION_STOP
  else -> CaptureStartupReason.SERVICE_STOPPED
}
