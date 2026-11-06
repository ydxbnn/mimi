package expo.modules.floatingmemo

import android.content.ClipboardManager
import android.content.Context
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FloatingMemoModule : Module() {
  private var overlay: FloatingMemoOverlay? = null

  // ---- 剪贴板监听状态 ----
  private var clipboardManager: ClipboardManager? = null
  private var clipboardListener: ClipboardManager.OnPrimaryClipChangedListener? = null
  private var clipboardContext: Context? = null
  private var lastClipboardContent: String? = null
  private val clipboardHandler = Handler(Looper.getMainLooper())
  private var pendingClipRead: Runnable? = null

  // 读剪贴板 / 正则过滤放到后台线程，避免阻塞主线程造成卡顿
  private val clipboardThread = HandlerThread("floating-memo-clipboard").apply { start() }
  private val clipboardBgHandler = Handler(clipboardThread.looper)

  private fun getOverlay(): FloatingMemoOverlay {
    overlay?.let { return it }
    val ctx = appContext.reactContext?.applicationContext
      ?: throw IllegalStateException("React application context is not available yet.")
    val instance = FloatingMemoOverlay(
      context = ctx,
      onSave = { text ->
        sendEvent("onSave", mapOf("text" to text))
      },
      onDismiss = {
        sendEvent("onDismiss", mapOf("reason" to "longPress"))
      },
      onUndo = {
        sendEvent("onUndo", mapOf("reason" to "undoButton"))
      },
      onAutoSleep = {
        sendEvent("onAutoSleep", mapOf("reason" to "idle"))
      }
    )
    overlay = instance
    // 让 AlarmManager 的广播能回调到当前实例
    FloatingMemoSleepBridge.handler = { instance.autoSleep() }
    // 通知栏「关闭悬浮窗」按钮
    FloatingMemoSleepBridge.closeHandler = {
      instance.hide()
      sendEvent("onDismiss", mapOf("reason" to "notificationAction"))
    }
    return instance
  }

  override fun definition() = ModuleDefinition {
    Name("FloatingMemo")

    Events("onSave", "onDismiss", "onUndo", "onClipboard", "onAutoSleep")

    // 是否已经授予「悬浮在其他应用上层」权限
    AsyncFunction("hasOverlayPermission") {
      getOverlay().hasPermission()
    }

    // 若无权限则跳转系统授权页，返回当前是否已有权限
    AsyncFunction("requestOverlayPermission") {
      getOverlay().requestPermission()
    }

    // 显示悬浮气泡；返回是否真正显示成功（无权限时返回 false）
    AsyncFunction("show") {
      val o = getOverlay()
      if (!o.hasPermission()) {
        return@AsyncFunction false
      }
      o.show()
      return@AsyncFunction true
    }

    AsyncFunction("hide") {
      getOverlay().hide()
    }

    AsyncFunction("isShowing") {
      getOverlay().isShowing()
    }

    AsyncFunction("setDarkMode") { dark: Boolean ->
      getOverlay().setDarkMode(dark)
    }

    // 设置闲置自动关闭时长（分钟，0 表示永不）
    AsyncFunction("setIdleTimeout") { minutes: Int ->
      getOverlay().setIdleTimeout(minutes)
    }

    // 自动记录剪贴板成功后的气泡微反馈
    AsyncFunction("flashBubble") {
      getOverlay().flashBubble()
    }

    // 开始 / 停止剪贴板监听
    AsyncFunction("startClipboardWatcher") {
      startClipboardWatcher()
    }

    AsyncFunction("stopClipboardWatcher") {
      stopClipboardWatcher()
    }

    OnDestroy {
      FloatingMemoSleepBridge.handler = null
      FloatingMemoSleepBridge.closeHandler = null
      stopClipboardWatcher()
      try {
        clipboardThread.quitSafely()
      } catch (_: Exception) {
        // 忽略
      }
      overlay?.destroy()
    }
  }

  // ---- 剪贴板监听 ----

  private fun startClipboardWatcher() {
    try {
      if (clipboardListener != null) return
      val ctx = appContext.reactContext ?: return
      val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
      clipboardContext = ctx
      clipboardManager = cm
      val listener = object : ClipboardManager.OnPrimaryClipChangedListener {
        override fun onPrimaryClipChanged() {
          scheduleClipboardRead()
        }
      }
      clipboardListener = listener
      cm.addPrimaryClipChangedListener(listener)
    } catch (_: Exception) {
      // 某些定制系统可能限制监听，忽略即可
    }
  }

  private fun stopClipboardWatcher() {
    try {
      clipboardListener?.let { clipboardManager?.removePrimaryClipChangedListener(it) }
    } catch (_: Exception) {
      // 忽略
    }
    clipboardListener = null
    pendingClipRead?.let { clipboardHandler.removeCallbacks(it) }
    pendingClipRead = null
  }

  /** 防抖：剪贴板连续变化时只处理最后一次，并切到后台线程读取 */
  private fun scheduleClipboardRead() {
    try {
      pendingClipRead?.let { clipboardHandler.removeCallbacks(it) }
      val runnable = Runnable {
        clipboardBgHandler.post { readClipboardNow() }
      }
      pendingClipRead = runnable
      clipboardHandler.postDelayed(runnable, 500L)
    } catch (_: Exception) {
      // 忽略
    }
  }

  private fun readClipboardNow() {
    try {
      val cm = clipboardManager ?: return
      val clip = cm.primaryClip ?: return
      if (clip.itemCount <= 0) return
      val ctx = clipboardContext ?: return
      val text = clip.getItemAt(0)?.coerceToText(ctx)?.toString()?.trim().orEmpty()
      if (text.isEmpty()) return

      // 防重复：与上次处理的内容完全一致则不触发，杜绝死循环
      if (text == lastClipboardContent) return
      lastClipboardContent = text

      // 不再做任何内容拦截：复制什么就记什么
      sendEvent("onClipboard", mapOf("text" to text))
      // 有新的剪贴板内容 → 重置闲置计时
      overlay?.resetAutoSleep()
    } catch (_: Exception) {
      // 安卓 10+ 后台读取可能被系统拒绝，静默失败，不影响 App
    }
  }
}
