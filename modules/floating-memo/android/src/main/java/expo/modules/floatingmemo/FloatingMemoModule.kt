package expo.modules.floatingmemo

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Lite 版原生模块：只负责悬浮气泡 + 快速输入 + 撤回 + 通知栏关闭。
 * 不包含剪贴板监听，也不包含闲置自动休眠。
 */
class FloatingMemoModule : Module() {
  private var overlay: FloatingMemoOverlay? = null

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
      }
    )
    overlay = instance
    // 通知栏「关闭悬浮窗」按钮
    FloatingMemoActionBridge.closeHandler = {
      instance.hide()
      sendEvent("onDismiss", mapOf("reason" to "notificationAction"))
    }
    return instance
  }

  override fun definition() = ModuleDefinition {
    Name("FloatingMemo")

    Events("onSave", "onDismiss", "onUndo")

    AsyncFunction("hasOverlayPermission") {
      getOverlay().hasPermission()
    }

    AsyncFunction("requestOverlayPermission") {
      getOverlay().requestPermission()
    }

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

    OnDestroy {
      FloatingMemoActionBridge.closeHandler = null
      overlay?.destroy()
    }
  }
}
