package expo.modules.floatingmemo

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * 前台服务：让悬浮气泡在切到其他应用后更不容易被系统回收。
 *
 * 所有系统调用都做了容错——若某个 ROM / 系统版本不允许前台服务，
 * 会退化为普通悬浮窗，功能不受影响，也不会崩溃。
 */
class FloatingMemoService : Service() {

  companion object {
    private const val CHANNEL_ID = "floating_memo_foreground"
    private const val NOTIFICATION_ID = 47001
    private const val CLOSE_REQUEST_CODE = 47003

    fun start(context: Context) {
      try {
        val intent = Intent(context, FloatingMemoService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
      } catch (_: Exception) {
        // 忽略：无法启动前台服务时，悬浮窗仍可正常使用
      }
    }

    fun stop(context: Context) {
      try {
        context.stopService(Intent(context, FloatingMemoService::class.java))
      } catch (_: Exception) {
        // 忽略
      }
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    try {
      val notification = buildNotification()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        // Android 14+ 必须显式声明前台服务类型
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        )
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (_: Exception) {
      // 某些 ROM 可能拒绝前台服务：停止自身，让悬浮窗继续以普通方式运行
      try {
        stopSelf()
      } catch (_: Exception) {
        // 忽略
      }
    }
    // 不要重启：进程被回收后若只重启服务而没有悬浮层，会变成僵尸通知
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    try {
      stopForeground(true)
    } catch (_: Exception) {
      // 忽略
    }
    super.onDestroy()
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    try {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val channel = NotificationChannel(
        CHANNEL_ID,
        "悬浮备忘",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        setShowBadge(false)
        description = "悬浮气泡运行时常驻，用于保持气泡不被系统回收"
      }
      manager.createNotificationChannel(channel)
    } catch (_: Exception) {
      // 忽略
    }
  }

  private fun buildNotification(): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    val bigText =
      "【使用须知】请勿在后台强制划掉本 App，否则悬浮窗将失效。" +
        "【隐私声明】本 App 无网络权限，所有数据保存在手机本地，绝不泄露。"

    return builder
      .setContentTitle("\uD83D\uDFE3 悬浮备忘录运行中")
      .setContentText("点击气泡随手记，数据纯本地且无网。")
      .setStyle(Notification.BigTextStyle().bigText(bigText))
      .setSmallIcon(android.R.drawable.ic_menu_edit)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .addAction(
        Notification.Action.Builder(
          android.R.drawable.ic_menu_close_clear_cancel,
          "关闭悬浮窗",
          closePendingIntent()
        ).build()
      )
      .build()
  }

  private fun closePendingIntent(): PendingIntent {
    val intent = Intent(this, CloseOverlayReceiver::class.java)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or
      (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
    return PendingIntent.getBroadcast(this, CLOSE_REQUEST_CODE, intent, flags)
  }
}
