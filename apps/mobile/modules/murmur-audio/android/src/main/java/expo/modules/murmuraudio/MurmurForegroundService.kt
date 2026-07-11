package expo.modules.murmuraudio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

private const val MURMUR_CAPTURE_CHANNEL_ID = "murmur_live_capture"
private const val MURMUR_CAPTURE_NOTIFICATION_ID = 4127

class MurmurForegroundService : Service() {
  override fun onCreate() {
    super.onCreate()
    ensureNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        MURMUR_CAPTURE_NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
      )
    } else {
      startForeground(MURMUR_CAPTURE_NOTIFICATION_ID, notification)
    }
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

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
    return builder
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentTitle("Murmur is listening")
      .setContentText("Live translation is active")
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .build()
  }
}
