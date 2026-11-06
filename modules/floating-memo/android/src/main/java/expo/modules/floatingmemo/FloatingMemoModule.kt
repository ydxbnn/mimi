package expo.modules.floatingmemo

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FloatingMemoModule : Module() {
  private var overlay: FloatingMemoOverlay? = null

  private fun getOverlay(): FloatingMemoOverlay {
    overlay?.let { return it }
    val ctx = appContext.reactContext?.applicationContext
      ?: throw IllegalStateException("React application context is not available yet.")
    return FloatingMemoOverlay(
      context = ctx,
      onSave = { text ->
        sendEvent("onSave", mapOf("text" to text))
      },
      onDismiss = {
        sendEvent("onDismiss", mapOf("reason" to "longPress"))
      }
    ).also { overlay = it }
  }

  override fun definition() = ModuleDefinition {
    Name("FloatingMemo")

    Events("onSave", "onDismiss")

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

    OnDestroy {
      overlay?.destroy()
    }
  }
}
