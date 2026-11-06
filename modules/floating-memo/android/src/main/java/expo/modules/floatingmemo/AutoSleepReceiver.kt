package expo.modules.floatingmemo

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * 闲置超时闹钟的接收器：由 AlarmManager 在（熄屏/Doze 下也尽量准时的）时间点触发。
 */
class AutoSleepReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context?, intent: Intent?) {
    try {
      FloatingMemoSleepBridge.trigger()
    } catch (_: Exception) {
      // 忽略
    }
  }
}

/**
 * 让闹钟广播能回调到当前悬浮层实例。
 * 进程存活时 handler 才有值；进程已被回收时什么也不做（此时视图本来也不存在了）。
 */
object FloatingMemoSleepBridge {
  @Volatile
  var handler: (() -> Unit)? = null

  @Volatile
  var closeHandler: (() -> Unit)? = null

  fun trigger() {
    handler?.invoke()
  }

  fun triggerClose() {
    closeHandler?.invoke()
  }
}
