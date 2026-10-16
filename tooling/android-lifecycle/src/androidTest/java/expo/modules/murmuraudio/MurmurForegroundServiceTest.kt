// cspell:ignore murmuraudio
package expo.modules.murmuraudio

import android.app.Activity
import android.app.ActivityManager
import android.app.Notification
import android.app.NotificationManager
import android.content.Intent
import android.os.SystemClock
import android.test.InstrumentationTestCase
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@Suppress("DEPRECATION")
class MurmurForegroundServiceTest : InstrumentationTestCase(), MurmurCaptureListener {
  private lateinit var activity: Activity
  private lateinit var stopped: CountDownLatch
  private var stopReason: String? = null
  private var stoppedSource: String? = null
  private var startupError: Throwable? = null

  override fun setUp() {
    super.setUp()
    stopped = CountDownLatch(1)
    stopReason = null
    stoppedSource = null
    startupError = null
    MurmurCaptureBridge.attach(this)
    val context = instrumentation.targetContext
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)!!
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_MULTIPLE_TASK)
    activity = instrumentation.startActivitySync(launch)
  }

  override fun tearDown() {
    MurmurCaptureBridge.stopCapture("test_cleanup")
    instrumentation.waitForIdleSync()
    instrumentation.runOnMainSync { activity.finish() }
    MurmurCaptureBridge.detach(this)
    super.tearDown()
  }

  fun testCancelBeforeServiceCreation() {
    cancelDuringQueuedStart(background = false)
  }

  fun testCancelFromModuleThreadBeforeServiceCreation() {
    cancelDuringQueuedStart(background = true)
  }

  fun testCancelDevicePlaybackBeforeProjectionStarts() {
    cancelDuringQueuedStart(background = false, source = CAPTURE_SOURCE_DEVICE_PLAYBACK)
  }

  fun testCancelledPlaybackDoesNotReplaceQueuedMicrophoneStart() {
    instrumentation.runOnMainSync {
      startService(CAPTURE_SOURCE_DEVICE_PLAYBACK)
      MurmurCaptureBridge.stopCapture("test_start_cancel")
      startService(CAPTURE_SOURCE_MICROPHONE)
    }
    val context = instrumentation.targetContext
    val manager = context.getSystemService(NotificationManager::class.java)
    val title = context.getString(R.string.murmur_capture_microphone_title)
    val deadline = SystemClock.uptimeMillis() + 5_000
    while (manager.activeNotifications.none {
        it.notification.extras.getString(Notification.EXTRA_TITLE) == title
      }) {
      assertTrue("New microphone startup did not promote", SystemClock.uptimeMillis() < deadline)
      SystemClock.sleep(20)
    }
    instrumentation.waitForIdleSync()
    assertNull("Cancelled playback must not initialize projection", startupError)
    assertEquals("An older cancellation must not stop the newer service", 1L, stopped.count)
    assertTrue(MurmurCaptureBridge.stopCapture("test_new_start_stop"))
    assertTrue("New service did not stop", stopped.await(5, TimeUnit.SECONDS))
    assertEquals("test_new_start_stop", stopReason)
    assertEquals(CAPTURE_SOURCE_MICROPHONE, stoppedSource)
  }

  fun testStopAfterForegroundPromotion() {
    instrumentation.runOnMainSync { startService() }
    val context = instrumentation.targetContext
    val manager = context.getSystemService(ActivityManager::class.java)
    val deadline = SystemClock.uptimeMillis() + 5_000
    while (!manager.getRunningServices(100).any {
        it.service.className == MurmurForegroundService::class.java.name && it.foreground
      }) {
      assertTrue("Service did not promote", SystemClock.uptimeMillis() < deadline)
      SystemClock.sleep(20)
    }
    assertTrue(MurmurCaptureBridge.stopCapture("test_normal_stop"))
    assertTrue("Service did not stop", stopped.await(5, TimeUnit.SECONDS))
    assertEquals("test_normal_stop", stopReason)
  }

  private fun cancelDuringQueuedStart(background: Boolean, source: String = CAPTURE_SOURCE_MICROPHONE) {
    var cancellationAccepted = false
    instrumentation.runOnMainSync {
      startService(source)
      // Service callbacks cannot run until this main-thread turn returns.
      val cancel = {
        cancellationAccepted = MurmurCaptureBridge.stopCapture("test_start_cancel")
        MurmurCaptureBridge.stopCapture("test_start_cancel")
      }
      if (background) {
        val thread = Thread { cancel() }
        thread.start()
        thread.join()
      } else {
        cancel()
      }
    }
    assertTrue("Pending startup must accept cancellation", cancellationAccepted)
    assertTrue("Cancelled startup did not stop", stopped.await(5, TimeUnit.SECONDS))
    assertEquals("test_start_cancel", stopReason)
    assertEquals(source, stoppedSource)
    assertNull("Cancelled startup must not initialize capture", startupError)
    instrumentation.waitForIdleSync()
    // Keep the target alive beyond the framework's foreground transition timeout.
    SystemClock.sleep(6_000)
  }

  private fun startService(source: String = CAPTURE_SOURCE_MICROPHONE) {
    val context = instrumentation.targetContext
    val intent = Intent(context, MurmurForegroundService::class.java)
      .putExtra(MURMUR_CAPTURE_SOURCE_EXTRA, source)
    MurmurCaptureBridge.startService(context, intent)
  }

  override fun onServiceCaptureStopped(source: String, reason: String) {
    stopReason = reason
    stoppedSource = source
    stopped.countDown()
  }

  override fun onServiceCaptureStarted(source: String) = Unit
  override fun onServiceCaptureFrame(source: String, data: ByteArray) = Unit
  override fun onServiceCaptureError(source: String, reason: String, error: Throwable?) {
    startupError = error
  }
}
