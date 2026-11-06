package expo.modules.floatingmemo

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * 通知栏「关闭悬浮窗」按钮的接收器：收到后关闭气泡并停止前台服务。
 */
class CloseOverlayReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context?, intent: Intent?) {
    try {
      FloatingMemoActionBridge.triggerClose()
    } catch (_: Exception) {
      // 忽略
    }
  }
}
