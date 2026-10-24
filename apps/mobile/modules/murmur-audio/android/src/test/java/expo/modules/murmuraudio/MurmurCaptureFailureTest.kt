package expo.modules.murmuraudio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class MurmurCaptureFailureTest {
  @Test
  fun mapsOnlyNativeCategoriesNotMessagesOrClassNames() {
    val cases = listOf(
      SecurityException("private URL") to "security",
      IllegalStateException("private content") to "illegal_state",
      IllegalArgumentException("private token") to "illegal_argument",
      UnsupportedOperationException("private audio") to "unsupported",
      RuntimeException("private user") to "other"
    )
    for ((error, category) in cases) {
      val diagnostic = captureStartupFailure(CaptureStartupStep.MEDIA_PROJECTION, error)
      assertEquals(mapOf(
        "platform" to "android", "step" to "media_projection", "error_domain" to category,
        "error_code" to null, "reason" to "exception"
      ), diagnostic)
      assertFalse(diagnostic.toString().contains("private"))
    }
  }

  @Test
  fun boundsStopReasonsBeforeTheyCrossTheNativeBoundary() {
    assertEquals(CaptureStartupReason.PROJECTION_REVOKED,
      captureStartupStopReason("device_playback_capture_revoked"))
    assertEquals(CaptureStartupReason.SERVICE_DESTROYED, captureStartupStopReason("service_destroy"))
    assertEquals(CaptureStartupReason.NOTIFICATION_STOP, captureStartupStopReason("notification_stop"))
    assertEquals(CaptureStartupReason.SERVICE_STOPPED, captureStartupStopReason("private content"))
  }

  @Test
  fun preservesRecorderStateCodesAndNonExceptionStartupFailures() {
    assertEquals(mapOf(
      "platform" to "android", "step" to "recorder_start", "error_domain" to "none",
      "error_code" to 1, "reason" to "recorder_not_recording"
    ), captureStartupFailure(CaptureStartupStep.RECORDER_START,
      CaptureStartupException(CaptureStartupReason.RECORDER_NOT_RECORDING, 1)))
    assertEquals("start_timeout", captureStartupFailure(
      CaptureStartupStep.SERVICE_START, reason = CaptureStartupReason.START_TIMEOUT
    )["reason"])
  }
}
